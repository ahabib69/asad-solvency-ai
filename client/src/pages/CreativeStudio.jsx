import { useEffect, useRef, useState } from 'react';
import { Sparkles, Upload, X, Download, Wand2, Loader2, Trash2, Maximize2, ImagePlus, ScanFace, RefreshCw } from 'lucide-react';
import ConfigNotice from '../components/ui/ConfigNotice.jsx';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';

const STYLES = [
  { id: 'photorealistic', label: 'Photorealistic', emoji: '📷' },
  { id: 'cinematic', label: 'Cinematic Portrait', emoji: '🎬' },
  { id: 'fantasy', label: 'Fantasy Environment', emoji: '🏔️' },
  { id: 'product', label: 'Product Photography', emoji: '🛍️' },
  { id: 'character3d', label: '3D Animated Character', emoji: '🧸' },
  { id: 'transform', label: 'Transform My Photo', emoji: '🪄' },
  { id: 'none', label: 'No preset', emoji: '✏️' },
];
const RATIOS = [
  { id: '1:1', w: 1, h: 1, label: 'Square' },
  { id: '2:3', w: 2, h: 3, label: 'Portrait' },
  { id: '9:16', w: 9, h: 16, label: 'Vertical' },
  { id: '3:2', w: 3, h: 2, label: 'Landscape' },
  { id: '16:9', w: 16, h: 9, label: 'Wide' },
];
const IDEAS = [
  'A confident young entrepreneur in a rooftop café at golden hour, city skyline behind, natural smile',
  'A floating crystal city above a misty ocean at sunrise, waterfalls pouring into clouds',
  'A matte black wireless headphone on a wet obsidian surface with blue rim light',
  'A cheerful 3D onion character wearing sunglasses, surfing a wave of stars',
];

export default function CreativeStudio() {
  const { status, toast } = useApp();
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('photorealistic');
  const [aspect, setAspect] = useState('1:1');
  const [quality, setQuality] = useState('high');
  const [refs, setRefs] = useState([]); // {file, url}
  const [preserve, setPreserve] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [upscaling, setUpscaling] = useState(false);
  const [current, setCurrent] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [drag, setDrag] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const fileRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => { api.images().then(setGallery).catch(() => {}); }, []);
  useEffect(() => () => refs.forEach((r) => URL.revokeObjectURL(r.url)), []); // eslint-disable-line
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const addFiles = (files) => {
    const ok = [...files].filter((f) => /^image\/(png|jpe?g|webp)$/.test(f.type) && f.size < 20 * 1024 * 1024);
    if (ok.length < files.length) toast('Only PNG, JPG or WEBP images under 20 MB are supported.', 'error');
    setRefs((r) => [...r, ...ok.map((file) => ({ file, url: URL.createObjectURL(file) }))].slice(0, 4));
    if (ok.length && style === 'photorealistic') setStyle('transform');
  };

  const generate = async () => {
    if (!prompt.trim()) { toast('Describe what you want to create first.', 'error'); return; }
    const fd = new FormData();
    fd.append('prompt', prompt.trim());
    fd.append('style', style);
    fd.append('aspect', aspect);
    fd.append('quality', quality);
    fd.append('preserveIdentity', String(preserve));
    refs.forEach((r) => fd.append('references', r.file));
    abortRef.current = new AbortController();
    setBusy(true);
    try {
      const img = await api.generateImage(fd, abortRef.current.signal);
      setCurrent(img);
      setGallery((g) => [img, ...g]);
      toast('Image created ✨', 'success');
    } catch (e) {
      if (e.name !== 'AbortError') toast(e.message, 'error', 8000);
    } finally { setBusy(false); }
  };

  const enhance = async () => {
    if (!prompt.trim()) { toast('Write a short idea first, then enhance it.', 'error'); return; }
    setEnhancing(true);
    try { const r = await api.enhancePrompt(prompt, style); if (r.prompt) setPrompt(r.prompt); }
    catch (e) { toast(e.message, 'error'); }
    finally { setEnhancing(false); }
  };

  const upscale = async () => {
    if (!current) return;
    setUpscaling(true);
    try { const img = await api.upscaleImage(current.id); setCurrent(img); setGallery((g) => [img, ...g]); toast('Upscaled to 4K', 'success'); }
    catch (e) { toast(e.message, 'error', 7000); }
    finally { setUpscaling(false); }
  };

  const remove = async (img) => {
    await api.deleteImage(img.id).catch(() => {});
    setGallery((g) => g.filter((x) => x.id !== img.id));
    if (current?.id === img.id) setCurrent(null);
  };

  const useAsReference = async (img) => {
    const blob = await (await fetch(img.url)).blob();
    addFiles([new File([blob], `ref-${img.id}.png`, { type: blob.type || 'image/png' })]);
  };

  const r = RATIOS.find((x) => x.id === aspect) || RATIOS[0];
  const notConfigured = status && !status.images.configured;

  return (
    <div className="studio">
      <div className="page-head">
        <div>
          <span className="eyebrow">4K Creative Studio</span>
          <h2>Turn ideas into stunning images</h2>
          <p className="muted">Photoreal portraits, fantasy worlds, product shots and 3D characters — or transform your own photos while keeping your face.</p>
        </div>
        {status?.images?.configured && <span className="chip">Engine: {status.images.model}</span>}
      </div>
      {notConfigured && <ConfigNotice title="Image generation needs an API key">Add <code>OPENAI_API_KEY</code> (gpt-image-1) or set <code>IMAGE_PROVIDER=stability</code> with <code>STABILITY_API_KEY</code> in <code>.env</code>, then restart. </ConfigNotice>}

      <div className="studio-grid">
        <div className="studio-controls glass">
          <label className="field-label">Prompt</label>
          <div className="prompt-box">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} maxLength={3000}
              placeholder="Describe your image… e.g. “Me as an astronaut on Mars at sunset, cinematic, photoreal”" />
            <div className="prompt-tools">
              <span className="tiny muted">{prompt.length}/3000</span>
              <button className="btn btn-ghost btn-xs" onClick={enhance} disabled={enhancing}>{enhancing ? <Loader2 size={14} className="spin" /> : <Wand2 size={14} />} Enhance prompt</button>
            </div>
          </div>
          <div className="ideas">{IDEAS.map((i) => <button key={i} className="idea" onClick={() => setPrompt(i)}>{i.split(',')[0]}</button>)}</div>

          <label className="field-label">Style</label>
          <div className="style-grid">
            {STYLES.map((s) => (
              <button key={s.id} className={`style-chip ${style === s.id ? 'on' : ''}`} onClick={() => setStyle(s.id)}><span>{s.emoji}</span>{s.label}</button>
            ))}
          </div>

          <label className="field-label">Aspect ratio</label>
          <div className="ratio-row">
            {RATIOS.map((x) => (
              <button key={x.id} className={`ratio ${aspect === x.id ? 'on' : ''}`} onClick={() => setAspect(x.id)} title={x.label}>
                <span className="ratio-shape" style={{ aspectRatio: `${x.w}/${x.h}`, [x.w >= x.h ? 'width' : 'height']: 26 }} />
                {x.id}
              </button>
            ))}
          </div>

          <label className="field-label">Reference photos <span className="muted tiny">(optional, up to 4)</span></label>
          <div className={`dropzone ${drag ? 'drag' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
            <Upload size={20} /> <span>Drop images or <u>browse</u></span>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>
          {refs.length > 0 && (
            <>
              <div className="ref-row">
                {refs.map((x, i) => (
                  <div key={x.url} className="ref-thumb"><img src={x.url} alt="" />
                    <button onClick={() => { URL.revokeObjectURL(x.url); setRefs((r) => r.filter((_, j) => j !== i)); }} aria-label="Remove"><X size={12} /></button>
                  </div>
                ))}
              </div>
              <label className="check"><input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} /> <ScanFace size={15} /> Preserve facial identity (high-fidelity)</label>
            </>
          )}

          <div className="row between">
            <label className="field-label" style={{ margin: 0 }}>Quality</label>
            <div className="seg">
              <button className={quality === 'standard' ? 'on' : ''} onClick={() => setQuality('standard')}>Fast</button>
              <button className={quality === 'high' ? 'on' : ''} onClick={() => setQuality('high')}>High</button>
            </div>
          </div>

          <button className="btn btn-primary btn-lg w-full generate-btn" onClick={generate} disabled={busy}>
            {busy ? <><Loader2 size={18} className="spin" /> Generating… {elapsed}s</> : <><Sparkles size={18} /> Generate</>}
          </button>
          {busy && <button className="link-btn center w-full" onClick={() => abortRef.current?.abort()}>Cancel</button>}
        </div>

        <div className="studio-canvas glass">
          <div className={`canvas-frame ${busy ? 'loading' : ''}`} style={{ aspectRatio: current && !busy ? undefined : `${r.w}/${r.h}` }}>
            {busy ? (
              <div className="gen-anim"><div className="gen-orb" /><p>Composing light, texture and detail…</p><span className="tiny muted">High-quality renders can take 20–60 seconds.</span></div>
            ) : current ? (
              <img src={current.url} alt={current.prompt} />
            ) : (
              <div className="canvas-empty"><ImagePlus size={44} /><p>Your creation will appear here</p><span className="tiny muted">Pick a style, choose a ratio and hit Generate.</span></div>
            )}
          </div>
          {current && !busy && (
            <div className="canvas-actions">
              <a className="btn btn-primary btn-sm" href={current.url} download={`asad-solvency-${current.id}.png`}><Download size={15} /> Download</a>
              <button className="btn btn-ghost btn-sm" onClick={upscale} disabled={upscaling || current.size === '4K'} title={status?.images?.upscale4k ? '' : 'Requires STABILITY_API_KEY'}>
                {upscaling ? <Loader2 size={15} className="spin" /> : <Maximize2 size={15} />} {current.size === '4K' ? '4K ✓' : 'Upscale to 4K'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => useAsReference(current)}><ImagePlus size={15} /> Use as reference</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setPrompt(current.prompt); generate(); }}><RefreshCw size={15} /> Variation</button>
              <button className="btn btn-ghost btn-sm danger" onClick={() => remove(current)}><Trash2 size={15} /></button>
            </div>
          )}
          {current && <p className="tiny muted cap">{current.prompt} · {current.size} · {current.provider}</p>}
        </div>
      </div>

      <div className="gallery-head"><h3>Your gallery</h3><span className="muted tiny">{gallery.length} image{gallery.length === 1 ? '' : 's'}</span></div>
      {gallery.length === 0 ? <p className="muted tiny">Generated images are saved on your server and appear here.</p> : (
        <div className="gallery">
          {gallery.map((g) => (
            <button key={g.id} className={`g-item ${current?.id === g.id ? 'on' : ''}`} onClick={() => setCurrent(g)}>
              <img src={g.url} alt={g.prompt} loading="lazy" />
              {g.size === '4K' && <span className="g-badge">4K</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
