import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import * as store from '../lib/store.js';
import { config } from '../config.js';
import { ProviderError, readProviderError, complete } from '../lib/llm.js';
import { ENHANCE_IMAGE_PROMPT } from '../lib/prompts.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(png|jpe?g|webp)$/.test(file.mimetype)),
});

// Style presets — appended to the user's prompt server-side.
export const STYLES = {
  photorealistic: 'Ultra-photorealistic photograph, natural skin texture, true-to-life colours, shot on a full-frame camera, 50mm lens, sharp focus, high dynamic range, 8k detail.',
  cinematic: 'Cinematic portrait, dramatic rim lighting, shallow depth of field, anamorphic bokeh, film colour grading, 85mm lens, moody atmosphere, editorial quality.',
  fantasy: 'Realistic fantasy environment, epic scale, volumetric god rays, atmospheric haze, intricate detail, matte-painting realism, awe-inspiring composition.',
  product: 'Professional commercial product photography, studio softbox lighting, clean gradient backdrop, crisp reflections, precise shadows, advertising quality.',
  character3d: 'High-end 3D animated character, Pixar-quality render, expressive face, subsurface scattering, soft global illumination, vibrant but tasteful colours.',
  transform: 'Transform the reference photo as described while keeping composition coherent and realistic.',
  none: '',
};

const OPENAI_SIZES = { '1:1': '1024x1024', '2:3': '1024x1536', '4:5': '1024x1536', '9:16': '1024x1536', '3:2': '1536x1024', '16:9': '1536x1024' };
const STABILITY_RATIOS = ['1:1', '2:3', '3:2', '4:5', '5:4', '9:16', '16:9', '21:9', '9:21'];
const IDENTITY_CLAUSE = ' IMPORTANT: Preserve the exact facial identity of the person in the reference photo — same face shape, eyes, nose, mouth, skin tone, age, hairline and distinguishing features. Do not beautify or change who they are.';

function saveB64(b64, ext = 'png') {
  const file = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(store.IMAGES_DIR, file), Buffer.from(b64, 'base64'));
  return file;
}
function saveBuffer(buf, ext = 'png') {
  const file = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  fs.writeFileSync(path.join(store.IMAGES_DIR, file), buf);
  return file;
}
const toBlob = (f) => new Blob([f.buffer], { type: f.mimetype });

async function openaiGenerate({ prompt, aspect, quality, refs, preserveIdentity }) {
  const { openaiKey, openaiBaseUrl, openaiModel } = config.images;
  if (!openaiKey) throw new ProviderError('Image generation is not configured. Add OPENAI_API_KEY to .env (or set IMAGE_PROVIDER=stability with STABILITY_API_KEY) and restart.', 503, 'not_configured');
  const size = OPENAI_SIZES[aspect] || '1024x1024';
  const isGptImage = openaiModel.startsWith('gpt-image');
  const q = isGptImage ? (quality === 'high' ? 'high' : 'medium') : (quality === 'high' ? 'hd' : 'standard');
  let res;
  if (refs.length) {
    const fd = new FormData();
    fd.append('model', openaiModel);
    fd.append('prompt', prompt);
    fd.append('size', size);
    if (isGptImage) {
      fd.append('quality', q);
      if (preserveIdentity) fd.append('input_fidelity', 'high');
    }
    refs.forEach((f, i) => fd.append(isGptImage ? 'image[]' : 'image', toBlob(f), f.originalname || `ref-${i}.png`));
    res = await fetch(`${openaiBaseUrl}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${openaiKey}` }, body: fd });
  } else {
    const body = { model: openaiModel, prompt, size, n: 1, quality: q };
    if (!isGptImage) body.response_format = 'b64_json';
    res = await fetch(`${openaiBaseUrl}/images/generations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  if (!res.ok) throw await readProviderError(res, 'OpenAI Images');
  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new ProviderError('The image provider returned no image data.');
  return { file: saveB64(b64, 'png'), size, revisedPrompt: data?.data?.[0]?.revised_prompt };
}

async function stabilityGenerate({ prompt, aspect, refs, negative }) {
  const { stabilityKey, stabilityModel } = config.images;
  if (!stabilityKey) throw new ProviderError('Stability AI is not configured. Add STABILITY_API_KEY to .env and restart.', 503, 'not_configured');
  const fd = new FormData();
  fd.append('prompt', prompt);
  fd.append('output_format', 'png');
  if (negative) fd.append('negative_prompt', negative);
  let endpoint = `https://api.stability.ai/v2beta/stable-image/generate/${stabilityModel}`;
  if (refs.length) {
    endpoint = 'https://api.stability.ai/v2beta/stable-image/generate/sd3';
    fd.append('mode', 'image-to-image');
    fd.append('image', toBlob(refs[0]), refs[0].originalname || 'ref.png');
    fd.append('strength', '0.6');
    fd.append('model', 'sd3.5-large');
  } else {
    fd.append('aspect_ratio', STABILITY_RATIOS.includes(aspect) ? aspect : '1:1');
  }
  const res = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${stabilityKey}`, Accept: 'image/*' }, body: fd });
  if (!res.ok) throw await readProviderError(res, 'Stability AI');
  const buf = Buffer.from(await res.arrayBuffer());
  return { file: saveBuffer(buf, 'png'), size: aspect };
}

// ---- Free provider: Pollinations (no API key, no billing; anonymous tier is rate-limited) ----
const FREE_SIZES = { '1:1': [1024, 1024], '2:3': [768, 1152], '4:5': [832, 1040], '5:4': [1040, 832], '3:2': [1152, 768], '9:16': [720, 1280], '16:9': [1280, 720], '21:9': [1344, 576], '9:21': [576, 1344] };

async function freeGenerate({ prompt, aspect, refs }) {
  if (refs.length) throw new ProviderError('Reference photos are not supported by the free image service. Remove the photo, or use the OpenAI provider.', 400, 'unsupported');
  const [w, h] = FREE_SIZES[aspect] || [1024, 1024];
  const seed = Math.floor(Math.random() * 1e9);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1500))}?width=${w}&height=${h}&model=flux&nologo=true&seed=${seed}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  let res;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36' } });
  } catch {
    throw new ProviderError('The free image service did not respond in time. Try again in a moment.', 504, 'timeout');
  } finally { clearTimeout(timer); }
  if (res.status === 429) throw new ProviderError('The free image service is busy (it allows about one image every 15 seconds). Wait a few seconds and try again.', 429, 'rate_limit');
  if (!res.ok) throw await readProviderError(res, 'Free image service');
  const ct = res.headers.get('content-type') || '';
  if (!ct.startsWith('image/')) throw new ProviderError('The free image service did not return an image. Try again in a moment.', 502, 'bad_response');
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = /png/.test(ct) ? 'png' : /webp/.test(ct) ? 'webp' : 'jpg';
  return { file: saveBuffer(buf, ext), size: aspect };
}

router.get('/images', (_req, res) => res.json(store.listImages()));

router.delete('/images/:id', (req, res) => res.json({ ok: store.deleteImage(req.params.id) }));

router.post('/images/generate', upload.array('references', 4), async (req, res, next) => {
  try {
    const userPrompt = String(req.body.prompt || '').trim().slice(0, 3000);
    if (!userPrompt) return res.status(400).json({ error: 'Please describe the image you want.' });
    const style = STYLES[req.body.style] !== undefined ? req.body.style : 'photorealistic';
    const aspect = String(req.body.aspect || '1:1');
    const quality = req.body.quality === 'high' ? 'high' : 'standard';
    const refs = req.files || [];
    const preserveIdentity = refs.length > 0 && req.body.preserveIdentity !== 'false';
    const provider = ['stability', 'free'].includes(config.images.provider) ? config.images.provider : 'openai';

    let prompt = `${userPrompt}\n\nStyle: ${STYLES[style]}`.trim();
    if (preserveIdentity) prompt += IDENTITY_CLAUSE;
    if (aspect && !['1:1'].includes(aspect)) prompt += ` Compose for a ${aspect} frame.`;

    const out = provider === 'free'
      ? await freeGenerate({ prompt, aspect, refs })
      : provider === 'stability'
        ? await stabilityGenerate({ prompt, aspect, refs, negative: req.body.negative })
        : await openaiGenerate({ prompt, aspect, quality, refs, preserveIdentity });

    const img = store.addImage({ file: out.file, url: `/generated/${out.file}`, prompt: userPrompt, style, aspect, quality, provider, size: out.size, edited: refs.length > 0 });
    res.json(img);
  } catch (e) { next(e); }
});

// 4K upscale via Stability AI "conservative" upscaler (outputs up to 4K, preserves detail).
router.post('/images/:id/upscale', async (req, res, next) => {
  try {
    if (!config.images.stabilityKey) throw new ProviderError('4K upscaling needs STABILITY_API_KEY in .env (Stability AI upscaler).', 503, 'not_configured');
    const img = store.getImage(req.params.id);
    if (!img) return res.status(404).json({ error: 'Image not found' });
    const buf = fs.readFileSync(path.join(store.IMAGES_DIR, img.file));
    const fd = new FormData();
    fd.append('image', new Blob([buf], { type: 'image/png' }), 'image.png');
    fd.append('prompt', img.prompt.slice(0, 1000));
    fd.append('output_format', 'png');
    const r = await fetch('https://api.stability.ai/v2beta/stable-image/upscale/conservative', {
      method: 'POST', headers: { Authorization: `Bearer ${config.images.stabilityKey}`, Accept: 'image/*' }, body: fd,
    });
    if (!r.ok) throw await readProviderError(r, 'Stability AI Upscale');
    const file = saveBuffer(Buffer.from(await r.arrayBuffer()), 'png');
    const up = store.addImage({ file, url: `/generated/${file}`, prompt: img.prompt, style: img.style, aspect: img.aspect, provider: 'stability-upscale', size: '4K', upscaledFrom: img.id });
    res.json(up);
  } catch (e) { next(e); }
});

router.post('/images/enhance', async (req, res, next) => {
  try {
    const idea = String(req.body?.prompt || '').trim().slice(0, 1500);
    if (!idea) return res.status(400).json({ error: 'Write a short idea first.' });
    const style = STYLES[req.body?.style] || '';
    const prompt = await complete({
      messages: [{ role: 'system', content: ENHANCE_IMAGE_PROMPT }, { role: 'user', content: `Idea: ${idea}\nDesired style: ${style}` }],
      maxTokens: 220, temperature: 0.8,
    });
    res.json({ prompt: prompt.replace(/^["']|["']$/g, '') });
  } catch (e) { next(e); }
});

export default router;
