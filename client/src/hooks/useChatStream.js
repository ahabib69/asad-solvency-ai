// Shared streaming-chat state machine for Problem Solver and Make Yourself Useful.
import { useCallback, useRef, useState } from 'react';
import { api, streamChat } from '../api/client.js';
import { useApp } from '../context/AppContext.jsx';

export function useChatStream({ mode = 'solver', onConversation } = {}) {
  const { settings, refreshConversations, toast } = useApp();
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef(null);
  const convRef = useRef(null);
  convRef.current = conversationId;

  const load = useCallback(async (id) => {
    abortRef.current?.abort();
    setBusy(false);
    if (!id) { convRef.current = null; setMessages([]); setConversationId(null); setTitle(''); return null; }
    try {
      const c = await api.conversation(id);
      setMessages(c.messages);
      setConversationId(c.id);
      convRef.current = c.id;
      setTitle(c.title);
      return c;
    } catch (e) {
      toast(e.message, 'error');
      return null;
    }
  }, [toast]);

  const run = useCallback(async ({ message, display, regenerate = false }) => {
    if (busy) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    const tempAi = { id: null, tempId: 'ai-' + Date.now(), role: 'assistant', content: '' };
    setMessages((m) => {
      let next = m.filter((x) => !x.error);
      if (regenerate) { if (next[next.length - 1]?.role === 'assistant') next = next.slice(0, -1); }
      else next = [...next, { id: null, tempId: 'u-' + Date.now(), role: 'user', content: display || message }];
      return [...next, tempAi];
    });
    const patchAi = (fn) => setMessages((m) => m.map((x) => (x.tempId === tempAi.tempId ? fn(x) : x)));

    await streamChat(
      { conversationId: convRef.current, message, display, mode, regenerate, settings: { name: settings.name, tone: settings.tone, language: settings.language } },
      {
        onMeta: (meta) => {
          if (meta.conversationId !== convRef.current) { setConversationId(meta.conversationId); convRef.current = meta.conversationId; onConversation?.(meta.conversationId); }
          setTitle(meta.title);
          if (meta.userMessageId) setMessages((m) => { const c = [...m]; for (let i = c.length - 1; i >= 0; i--) if (c[i].role === 'user') { c[i] = { ...c[i], id: meta.userMessageId }; break; } return c; });
        },
        onDelta: (t) => patchAi((x) => ({ ...x, content: x.content + t })),
        onDone: (d) => { patchAi((x) => ({ ...x, id: d.messageId })); if (d.title) setTitle(d.title); },
        onError: (err) => patchAi((x) => ({ ...x, error: true, code: err.code, content: err.message || 'Something went wrong.' })),
      },
      controller.signal
    );
    if (controller.signal.aborted) patchAi((x) => ({ ...x, content: x.content ? x.content + '\n\n_(stopped)_' : '_(stopped)_' }));
    setBusy(false);
    refreshConversations();
  }, [busy, mode, settings.name, settings.tone, settings.language, refreshConversations, onConversation]);

  const send = useCallback((message, display) => run({ message, display }), [run]);
  const regenerate = useCallback(() => {
    if (convRef.current) return run({ regenerate: true });
    // conversation was never created (e.g. server offline) — resend the last user message
    let lastUser = null;
    setMessages((m) => {
      const idx = m.map((x) => x.role).lastIndexOf('user');
      if (idx < 0) return m;
      lastUser = m[idx];
      return m.slice(0, idx);
    });
    setTimeout(() => lastUser && run({ message: lastUser.content }), 0);
  }, [run]);
  const stop = useCallback(() => abortRef.current?.abort(), []);

  const feedback = useCallback(async (msg, value) => {
    if (!convRef.current || !msg.id) return;
    setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, feedback: value } : x)));
    try { await api.feedback(convRef.current, msg.id, value); if (value) toast(value === 'up' ? 'Thanks — glad it helped!' : 'Thanks for the feedback. Try Regenerate for a different angle.', 'success'); }
    catch (e) { toast(e.message, 'error'); }
  }, [toast]);

  return { messages, conversationId, title, busy, send, regenerate, stop, feedback, load, setTitle };
}
