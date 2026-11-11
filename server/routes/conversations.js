import { Router } from 'express';
import * as store from '../lib/store.js';

const router = Router();

router.get('/conversations', (req, res) => {
  res.json(store.listConversations({ q: String(req.query.q || ''), mode: String(req.query.mode || '') }));
});

router.get('/conversations/export', (_req, res) => {
  const all = store.listConversations().map((c) => store.getConversation(c.id));
  res.setHeader('Content-Disposition', 'attachment; filename="asad-solvency-history.json"');
  res.json({ exportedAt: new Date().toISOString(), conversations: all });
});

router.get('/conversations/:id', (req, res) => {
  const c = store.getConversation(req.params.id);
  if (!c) return res.status(404).json({ error: 'Conversation not found' });
  res.json(c);
});

router.patch('/conversations/:id', (req, res) => {
  const c = store.updateConversation(req.params.id, req.body || {});
  if (!c) return res.status(404).json({ error: 'Conversation not found' });
  res.json({ ok: true, id: c.id, title: c.title, pinned: c.pinned });
});

router.delete('/conversations/:id', (req, res) => {
  res.json({ ok: store.deleteConversation(req.params.id) });
});

router.delete('/conversations', (_req, res) => {
  store.clearConversations();
  res.json({ ok: true });
});

router.post('/conversations/:id/messages/:mid/feedback', (req, res) => {
  const v = req.body?.value;
  const m = store.updateMessage(req.params.id, req.params.mid, { feedback: v === 'up' || v === 'down' ? v : null });
  if (!m) return res.status(404).json({ error: 'Message not found' });
  res.json({ ok: true, feedback: m.feedback });
});

export default router;
