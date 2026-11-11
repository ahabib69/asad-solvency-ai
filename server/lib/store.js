// Tiny durable JSON store (atomic writes). Swap for Postgres/SQLite in production
// by re-implementing this module's exported functions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';

const DB_FILE = path.join(config.dataDir, 'db.json');
export const IMAGES_DIR = path.join(config.dataDir, 'images');

fs.mkdirSync(IMAGES_DIR, { recursive: true });

let db = { conversations: [], images: [] };
try {
  if (fs.existsSync(DB_FILE)) db = { ...db, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
} catch (e) {
  console.error('[store] Could not read db.json, starting fresh:', e.message);
  try { fs.copyFileSync(DB_FILE, DB_FILE + '.corrupt-' + Date.now()); } catch {}
}

let timer = null;
function persist() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 120);
}

export const uid = (p = '') => p + crypto.randomBytes(8).toString('hex');
const now = () => new Date().toISOString();

// ---------- Conversations ----------
export function listConversations({ q = '', mode = '' } = {}) {
  const needle = q.toLowerCase();
  return db.conversations
    .filter((c) => (!mode || c.mode === mode))
    .filter((c) => !needle || c.title.toLowerCase().includes(needle) ||
      c.messages.some((m) => m.content.toLowerCase().includes(needle)))
    .sort((a, b) => (b.pinned - a.pinned) || b.updatedAt.localeCompare(a.updatedAt))
    .map(({ messages, ...c }) => ({
      ...c,
      messageCount: messages.length,
      preview: (messages.findLast?.((m) => m.role === 'assistant') || messages[messages.length - 1] || {}).content?.slice(0, 160) || '',
    }));
}

export const getConversation = (id) => db.conversations.find((c) => c.id === id) || null;

export function createConversation({ title = 'New conversation', mode = 'solver' } = {}) {
  const c = { id: uid('c_'), title, mode, pinned: false, createdAt: now(), updatedAt: now(), messages: [] };
  db.conversations.push(c);
  persist();
  return c;
}

export function updateConversation(id, patch) {
  const c = getConversation(id);
  if (!c) return null;
  if (typeof patch.title === 'string' && patch.title.trim()) c.title = patch.title.trim().slice(0, 120);
  if (typeof patch.pinned === 'boolean') c.pinned = patch.pinned;
  c.updatedAt = now();
  persist();
  return c;
}

export function deleteConversation(id) {
  const before = db.conversations.length;
  db.conversations = db.conversations.filter((c) => c.id !== id);
  persist();
  return db.conversations.length !== before;
}

export function clearConversations() {
  db.conversations = [];
  persist();
}

export function addMessage(convId, { role, content, meta }) {
  const c = getConversation(convId);
  if (!c) return null;
  const m = { id: uid('m_'), role, content, createdAt: now(), ...(meta ? { meta } : {}) };
  c.messages.push(m);
  c.updatedAt = now();
  persist();
  return m;
}

export function updateMessage(convId, msgId, patch) {
  const c = getConversation(convId);
  const m = c?.messages.find((x) => x.id === msgId);
  if (!m) return null;
  Object.assign(m, patch);
  persist();
  return m;
}

export function removeMessage(convId, msgId) {
  const c = getConversation(convId);
  if (!c) return;
  c.messages = c.messages.filter((m) => m.id !== msgId);
  persist();
}

// ---------- Images ----------
export function addImage(meta) {
  const img = { id: uid('i_'), createdAt: now(), ...meta };
  db.images.unshift(img);
  persist();
  return img;
}
export const listImages = () => db.images;
export const getImage = (id) => db.images.find((i) => i.id === id) || null;
export function deleteImage(id) {
  const img = getImage(id);
  if (!img) return false;
  db.images = db.images.filter((i) => i.id !== id);
  try { fs.unlinkSync(path.join(IMAGES_DIR, img.file)); } catch {}
  persist();
  return true;
}
