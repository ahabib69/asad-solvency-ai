import { Router } from 'express';
import * as store from '../lib/store.js';
import { stream, complete, ProviderError } from '../lib/llm.js';
import { solverPrompt, usefulPrompt, livePrompt, TITLE_PROMPT } from '../lib/prompts.js';
import { config } from '../config.js';

const router = Router();
const HISTORY_WINDOW = 30;

const promptFor = (mode, s) => (mode === 'useful' ? usefulPrompt(s) : mode === 'live' ? livePrompt(s) : solverPrompt(s));

function buildMessages(conv, settings) {
  const history = conv.messages.slice(-HISTORY_WINDOW).map((m) => ({
    role: m.role,
    content: m.meta?.prompt || m.content,
  }));
  return [{ role: 'system', content: promptFor(conv.mode, settings) }, ...history];
}

function cleanSettings(s = {}) {
  return {
    name: String(s.name || '').slice(0, 40),
    tone: ['balanced', 'direct', 'gentle', 'coach'].includes(s.tone) ? s.tone : 'balanced',
    language: String(s.language || 'auto').slice(0, 30),
  };
}

async function autoTitle(conv) {
  if (!conv.autoTitle) return;
  const firstUser = conv.messages.find((m) => m.role === 'user');
  if (!firstUser) return;
  try {
    const t = await complete({
      messages: [{ role: 'system', content: TITLE_PROMPT }, { role: 'user', content: firstUser.content.slice(0, 600) }],
      maxTokens: 20, temperature: 0.3,
    });
    const title = t.replace(/^["'\s]+|["'.\s]+$/g, '').slice(0, 60);
    if (title) { store.updateConversation(conv.id, { title }); conv.autoTitle = false; }
  } catch { /* keep fallback title */ }
}

function fallbackTitle(text) {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > 48 ? t.slice(0, 46).trimEnd() + '…' : t || 'New conversation';
}

// ---------- Streaming chat (Problem Solver + Make Yourself Useful) ----------
router.post('/chat', async (req, res) => {
  const { conversationId, message = '', display, mode = 'solver', regenerate = false } = req.body || {};
  const settings = cleanSettings(req.body?.settings);
  const text = String(message).slice(0, 12000).trim();

  let conv = conversationId ? store.getConversation(conversationId) : null;
  if (conversationId && !conv) return res.status(404).json({ error: 'Conversation not found' });
  if (!regenerate && !text) return res.status(400).json({ error: 'Message is empty' });

  if (!conv) {
    conv = store.createConversation({ title: fallbackTitle(display || text), mode: ['solver', 'useful', 'live'].includes(mode) ? mode : 'solver' });
    conv.autoTitle = true;
  }

  let userMsg = null;
  if (regenerate) {
    const last = conv.messages[conv.messages.length - 1];
    if (last?.role === 'assistant') store.removeMessage(conv.id, last.id);
    if (!conv.messages.length) return res.status(400).json({ error: 'Nothing to regenerate' });
  } else {
    userMsg = store.addMessage(conv.id, {
      role: 'user',
      content: String(display || text).slice(0, 12000),
      meta: display && display !== text ? { prompt: text } : undefined,
    });
  }

  // SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  send('meta', { conversationId: conv.id, title: conv.title, userMessageId: userMsg?.id || null });

  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });

  let full = '';
  try {
    full = await stream({
      messages: buildMessages(conv, settings),
      signal: controller.signal,
      onDelta: (d) => send('delta', { text: d }),
    });
    const saved = store.addMessage(conv.id, { role: 'assistant', content: full || '_(No response received.)_' });
    if (conv.autoTitle) await autoTitle(conv);
    send('done', { messageId: saved.id, conversationId: conv.id, title: store.getConversation(conv.id)?.title });
  } catch (e) {
    if (e?.name === 'AbortError') {
      if (full) store.addMessage(conv.id, { role: 'assistant', content: full + '\n\n_(stopped)_' });
    } else {
      const err = e instanceof ProviderError ? e : new ProviderError(e.message || 'Unknown error');
      if (!config.isProd) console.error('[chat]', err.message);
      send('error', { message: err.message, code: err.code });
    }
  } finally {
    res.end();
  }
});

// ---------- Live AI (spoken companion) ----------
const EMOTIONS = ['happy', 'curious', 'concerned', 'thinking', 'excited', 'calm', 'empathetic'];

router.post('/live', async (req, res, next) => {
  try {
    const { conversationId, message = '' } = req.body || {};
    const settings = cleanSettings(req.body?.settings);
    const text = String(message).slice(0, 4000).trim();
    if (!text) return res.status(400).json({ error: 'Message is empty' });

    let conv = conversationId ? store.getConversation(conversationId) : null;
    if (!conv) { conv = store.createConversation({ title: 'Live: ' + fallbackTitle(text), mode: 'live' }); }
    store.addMessage(conv.id, { role: 'user', content: text });

    const raw = await complete({ messages: buildMessages(conv, settings), model: config.llm.liveModel, maxTokens: 400 });
    let emotion = 'calm';
    const m = raw.match(/\[\[\s*emotion\s*:\s*([a-z]+)\s*\]\]/i);
    if (m && EMOTIONS.includes(m[1].toLowerCase())) emotion = m[1].toLowerCase();
    const reply = raw.replace(/\[\[[^\]]*\]\]/g, '').replace(/[*#_`>]/g, '').trim() || "Sorry, I lost my train of thought. Could you say that again?";
    const saved = store.addMessage(conv.id, { role: 'assistant', content: reply, meta: { emotion } });
    res.json({ conversationId: conv.id, messageId: saved.id, reply, emotion });
  } catch (e) { next(e); }
});

export default router;
