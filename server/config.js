// Centralised, server-only configuration. API keys NEVER leave the server.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const env = (k, d = '') => (process.env[k] ?? d).toString().trim();

const openaiKey = env('OPENAI_API_KEY');

export const config = {
  port: Number(env('PORT', '8787')),
  host: env('HOST', '0.0.0.0'),
  isProd: env('NODE_ENV') === 'production',
  corsOrigin: env('CORS_ORIGIN'),
  dataDir: env('DATA_DIR', process.env.VERCEL ? '/tmp/asad-data' : fileURLToPath(new URL('./data/', import.meta.url))),

  // ---- Conversational AI (any OpenAI-compatible Chat Completions API) ----
  llm: {
    apiKey: env('LLM_API_KEY') || openaiKey,
    baseUrl: env('LLM_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
    model: env('LLM_MODEL', 'gpt-4o-mini'),
    liveModel: env('LLM_LIVE_MODEL') || env('LLM_MODEL', 'gpt-4o-mini'),
    temperature: Number(env('LLM_TEMPERATURE', '0.7')),
    maxTokens: Number(env('LLM_MAX_TOKENS', '1800')),
  },

  // ---- Image generation ----
  images: {
    provider: env('IMAGE_PROVIDER', 'openai'), // 'openai' | 'stability' | 'free'
    openaiKey,
    openaiBaseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
    openaiModel: env('OPENAI_IMAGE_MODEL', 'gpt-image-1'),
    stabilityKey: env('STABILITY_API_KEY'),
    stabilityModel: env('STABILITY_MODEL', 'core'), // 'core' | 'ultra'
  },

  // ---- Voice (server-side neural TTS + speech-to-text) ----
  voice: {
    openaiKey,
    openaiBaseUrl: env('OPENAI_BASE_URL', 'https://api.openai.com/v1').replace(/\/+$/, ''),
    ttsModel: env('OPENAI_TTS_MODEL', 'gpt-4o-mini-tts'),
    ttsDefaultVoice: env('OPENAI_TTS_VOICE', 'nova'),
    sttModel: env('OPENAI_STT_MODEL', 'whisper-1'),
  },

  rateLimitPerMin: Number(env('RATE_LIMIT_PER_MIN', '60')),
};

export const status = () => ({
  llm: {
    configured: Boolean(config.llm.apiKey),
    model: config.llm.model,
    liveModel: config.llm.liveModel,
    provider: safeHost(config.llm.baseUrl),
  },
  images: {
    provider: config.images.provider,
    configured:
      config.images.provider === 'free'
        ? true
        : config.images.provider === 'stability'
          ? Boolean(config.images.stabilityKey)
          : Boolean(config.images.openaiKey),
    model: config.images.provider === 'free' ? 'flux (free)' : config.images.provider === 'stability' ? `stable-image-${config.images.stabilityModel}` : config.images.openaiModel,
    upscale4k: true,
    upscaleMode: config.images.stabilityKey ? 'ai' : 'basic',
  },
  voice: {
    tts: Boolean(config.voice.openaiKey),
    stt: Boolean(config.voice.openaiKey),
    ttsModel: config.voice.ttsModel,
    browserFallback: true,
  },
});

function safeHost(u) {
  try { return new URL(u).host; } catch { return u; }
}
