// Run `npm run check` to verify which integrations are configured.
import '../server/config.js';
import { status } from '../server/config.js';
const s = status();
const line = (ok, label, hint) => console.log(`${ok ? '✅' : '⚠️ '} ${label}${ok ? '' : '  →  ' + hint}`);
console.log('\nASAD SOLVENCY — configuration check\n');
line(s.llm.configured, `AI chat (${s.llm.model} @ ${s.llm.provider})`, 'set OPENAI_API_KEY or LLM_API_KEY in .env');
line(s.images.configured, `Image generation (${s.images.provider})`, s.images.provider === 'stability' ? 'set STABILITY_API_KEY' : 'set OPENAI_API_KEY');
line(s.voice.tts, 'Neural voice + server speech-to-text (OpenAI)', 'optional — browser voice is used otherwise');
line(s.images.upscale4k, '4K upscaling (Stability AI)', 'optional — set STABILITY_API_KEY');
console.log('');
