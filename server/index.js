import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config, status } from './config.js';
import { IMAGES_DIR } from './lib/store.js';
import { ProviderError } from './lib/llm.js';
import chatRoutes from './routes/chat.js';
import conversationRoutes from './routes/conversations.js';
import imageRoutes from './routes/images.js';
import voiceRoutes from './routes/voice.js';
import browserRoutes from './routes/browser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'microphone=(self), camera=()');
  if (config.corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', config.corsOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '2mb' }));

// Simple in-memory rate limiter for AI endpoints (per IP / minute)
const hits = new Map();
const aiLimiter = (req, res, next) => {
  const key = req.ip;
  const nowMin = Math.floor(Date.now() / 60000);
  const entry = hits.get(key);
  if (!entry || entry.min !== nowMin) hits.set(key, { min: nowMin, n: 1 });
  else if (++entry.n > config.rateLimitPerMin) return res.status(429).json({ error: 'Too many requests â€” please slow down for a minute.', code: 'rate_limited' });
  next();
};
app.use(['/api/chat', '/api/live', '/api/images/generate', '/api/images/enhance', '/api/tts', '/api/transcribe'], aiLimiter);

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
app.get('/api/status', (_req, res) => res.json(status()));
app.use('/api', chatRoutes);
app.use('/api', conversationRoutes);
app.use('/api', imageRoutes);
app.use('/api', voiceRoutes);
app.use('/api', browserRoutes);
app.use('/generated', express.static(IMAGES_DIR, { maxAge: '7d' }));
app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route' }));

// Serve the built frontend in production
const dist = path.resolve(__dirname, '../dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err instanceof ProviderError ? err.status : err.status || 500;
  if (status >= 500 && status !== 503) console.error('[error]', err.message);
  res.status(status).json({ error: err.message || 'Server error', code: err.code || 'server_error' });
});

if (!process.env.VERCEL) app.listen(config.port, config.host, () => {
  const s = status();
  console.log(`\n  ASAD SOLVENCY API  â†’  http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${config.port}`);
  console.log(`  AI chat ........ ${s.llm.configured ? 'âœ” ' + s.llm.model + ' @ ' + s.llm.provider : 'âœ– not configured (set OPENAI_API_KEY)'}`);
  console.log(`  Images ......... ${s.images.configured ? 'âœ” ' + s.images.provider + ' / ' + s.images.model : 'âœ– not configured'}`);
  console.log(`  Neural voice ... ${s.voice.tts ? 'âœ” ' + s.voice.ttsModel : 'âœ– (browser voice fallback active)'}`);
  console.log(`  4K upscale ..... ${s.images.upscale4k ? 'âœ” Stability AI' : 'âœ– (optional: STABILITY_API_KEY)'}\n`);
});

export default app;
