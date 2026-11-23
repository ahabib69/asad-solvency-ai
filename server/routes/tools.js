import { Router } from 'express';
import { config } from '../config.js';

const r = Router();

async function ask(system, user, temperature = 0.6) {
  if (!config.llm.apiKey) { const e = new Error('AI not configured'); e.status = 503; throw e; }
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model: config.llm.model,
      temperature,
      max_tokens: config.llm.maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || 'AI provider error');
    e.status = res.status === 429 ? 429 : 502;
    throw e;
  }
  return (data.choices?.[0]?.message?.content || '').trim();
}

const need = (v, name = 'text') => {
  if (!v || !String(v).trim()) { const e = new Error(`${name} is required`); e.status = 400; throw e; }
  return String(v);
};

// ---------- 1. Prompt Improver ----------
const IMPROVE = {
  veo3: 'You rewrite rough ideas into one detailed, production-ready Veo 3 video prompt. Include: subject and consistent face/appearance details, action, setting, camera movement and lens, lighting, style/mood, audio (ambient, music, exact dialogue in quotes with language), and strict stability rules (no face drift, no extra hands/fingers, no text or subtitles, no watermark). Output the final prompt in one block, then one short line "Tip:" with a useful tweak.',
  image: 'You rewrite rough ideas into one detailed text-to-image prompt. Include: subject, composition, environment, lighting, color palette, lens/camera, style, quality keywords, and a short "Avoid:" list. Output the final prompt in one block, then one short line "Tip:".',
  general: 'You rewrite rough prompts for an AI assistant to be clear, specific and structured (role, task, context, constraints, output format). Output the improved prompt in one block, then one short line "Tip:".',
};
r.post('/tools/improve', async (req, res, next) => {
  try {
    const text = need(req.body?.text).slice(0, 6000);
    const sys = IMPROVE[req.body?.kind] || IMPROVE.general;
    res.json({ result: await ask(sys, text, 0.7) });
  } catch (e) { next(e); }
});

// ---------- 2. Translate + Grammar ----------
const TR = {
  bn2en: 'Translate the Bangla text to natural, fluent English. Output only the translation.',
  en2bn: 'Translate the English text to natural, fluent Bangla (Bangla script). Output only the translation.',
  banglish: 'The text is Bangla written in English letters (Banglish). Convert it to correct Bangla script, then give a natural English translation below it. Format: first the Bangla, then a line "English:" with the translation.',
  fix: 'Detect the language of the text. Fix grammar, spelling and punctuation without changing the meaning or tone. Output the corrected text first, then a short bullet list titled "Changes" (max 6 bullets).',
};
r.post('/tools/translate', async (req, res, next) => {
  try {
    const text = need(req.body?.text).slice(0, 6000);
    const sys = TR[req.body?.mode] || TR.fix;
    res.json({ result: await ask(sys, text, 0.3) });
  } catch (e) { next(e); }
});

// ---------- 3. Document Q&A (text extracted in the browser) ----------
r.post('/tools/docqa', async (req, res, next) => {
  try {
    const doc = need(req.body?.doc, 'doc').slice(0, 24000);
    const q = need(req.body?.question, 'question').slice(0, 1000);
    const sys = 'You answer questions using ONLY the provided document. If the answer is not in the document, say so clearly. Be concise, use bullets when helpful, and reply in the same language as the question.';
    res.json({ result: await ask(sys, `DOCUMENT:\n${doc}\n\nQUESTION: ${q}`, 0.2) });
  } catch (e) { next(e); }
});

// ---------- 4. Mystery Video of the Day ----------
// Well-known embeddable videos used when YOUTUBE_API_KEY is not set (or quota is over).
const FALLBACK = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0', 'kJQP7kiw5Fk', 'fJ9rUzIMcZQ', 'JGwWNGJdvx8', 'RgKAFK5djSk', 'OPf0YbXqDm0', '60ItHLz5WEA', 'hTWKbfoikeg', 'YQHsXMglC9A', 'pRpeEdMmmQ0'];
const QUERIES = ['most satisfying video', 'amazing talent show audition', 'funny animal moments', 'mind blowing science experiment', 'best live performance ever', 'incredible street magic', 'viral catchy song official video', 'unbelievable sports moments', 'oddly satisfying compilation', 'epic comedy sketch'];
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

r.get('/mystery', async (req, res, next) => {
  try {
    const n = Math.max(0, Number(req.query.n) || 0);
    const seed = hash(new Date().toISOString().slice(0, 10) + ':' + n);
    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
      try {
        const u = new URL('https://www.googleapis.com/youtube/v3/search');
        u.search = new URLSearchParams({
          part: 'snippet', type: 'video', videoEmbeddable: 'true', videoSyndicated: 'true',
          safeSearch: 'strict', order: 'viewCount', maxResults: '25',
          q: QUERIES[seed % QUERIES.length], key,
        }).toString();
        const d = await (await fetch(u)).json();
        const items = d.items || [];
        if (items.length) {
          const it = items[seed % items.length];
          return res.json({ id: it.id.videoId, title: it.snippet.title, channel: it.snippet.channelTitle, source: 'youtube' });
        }
      } catch { /* fall through to curated list */ }
    }
    res.json({ id: FALLBACK[seed % FALLBACK.length], title: 'Mystery pick', channel: '', source: 'curated' });
  } catch (e) { next(e); }
});

export default r;
