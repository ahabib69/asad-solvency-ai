import { Router } from 'express';
import multer from 'multer';
import { config } from '../config.js';
import { ProviderError, readProviderError } from '../lib/llm.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

export const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer'];

const ensure = () => {
  if (!config.voice.openaiKey) throw new ProviderError('Neural voice is not configured. Add OPENAI_API_KEY to .env, or switch Voice engine to "Browser" in Settings.', 503, 'not_configured');
};

router.get('/voices', (_req, res) => res.json({ voices: OPENAI_VOICES, default: config.voice.ttsDefaultVoice, configured: Boolean(config.voice.openaiKey) }));

// Text -> speech (MP3 stream)
router.post('/tts', async (req, res, next) => {
  try {
    ensure();
    const text = String(req.body?.text || '').trim().slice(0, 4000);
    if (!text) return res.status(400).json({ error: 'No text' });
    const voice = OPENAI_VOICES.includes(req.body?.voice) ? req.body.voice : config.voice.ttsDefaultVoice;
    const speed = Math.min(2, Math.max(0.5, Number(req.body?.speed) || 1));
    const body = { model: config.voice.ttsModel, voice, input: text, speed, response_format: 'mp3' };
    if (config.voice.ttsModel.includes('gpt-4o')) {
      body.instructions = 'Speak warmly, intelligently and naturally, like a calm, caring and slightly futuristic companion. Clear articulation, gentle confidence.';
    }
    const r = await fetch(`${config.voice.openaiBaseUrl}/audio/speech`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.voice.openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw await readProviderError(r, 'OpenAI TTS');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    for await (const chunk of r.body) res.write(chunk);
    res.end();
  } catch (e) { next(e); }
});

// Speech -> text (used when the browser has no built-in SpeechRecognition, e.g. Firefox/Safari)
router.post('/transcribe', upload.single('audio'), async (req, res, next) => {
  try {
    ensure();
    if (!req.file) return res.status(400).json({ error: 'No audio uploaded' });
    const fd = new FormData();
    const ext = (req.file.mimetype.split('/')[1] || 'webm').split(';')[0];
    fd.append('file', new Blob([req.file.buffer], { type: req.file.mimetype }), `speech.${ext}`);
    fd.append('model', config.voice.sttModel);
    if (req.body?.language && req.body.language !== 'auto') fd.append('language', req.body.language.slice(0, 2));
    const r = await fetch(`${config.voice.openaiBaseUrl}/audio/transcriptions`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.voice.openaiKey}` }, body: fd,
    });
    if (!r.ok) throw await readProviderError(r, 'OpenAI Transcription');
    const data = await r.json();
    res.json({ text: (data.text || '').trim() });
  } catch (e) { next(e); }
});

export default router;
