import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TABS = [
  ['improve', '✨ Prompt Improver'],
  ['translate', '🌐 Translate & Fix'],
  ['doc', '📄 Doc Q&A'],
  ['mystery', '📺 Mystery Video'],
];

async function api(url, body) {
  const r = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || 'Request failed (' + r.status + ')');
  return d;
}

function useRun() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [out, setOut] = useState('');
  const run = async (fn) => {
    setLoading(true); setErr(''); setOut('');
    try { setOut(await fn()); } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  return { loading, err, out, run };
}

function Result({ text, err }) {
  const [copied, setCopied] = useState(false);
  if (err) return <div className="tl-err">⚠ {err}</div>;
  if (!text) return null;
  return (
    <div className="tl-card">
      <div className="tl-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown></div>
      <button className="tl-btn ghost" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
        {copied ? 'Copied ✓' : 'Copy'}
      </button>
    </div>
  );
}

function Improver() {
  const [text, setText] = useState('');
  const [kind, setKind] = useState('veo3');
  const { loading, err, out, run } = useRun();
  return (
    <>
      <div className="tl-row">
        {[['veo3', 'Veo3 video'], ['image', 'Image'], ['general', 'General AI']].map(([k, l]) => (
          <button key={k} className={'tl-chip' + (kind === k ? ' on' : '')} onClick={() => setKind(k)}>{l}</button>
        ))}
      </div>
      <textarea className="tl-ta" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Tomar rough idea likho (Bangla/English/Banglish)..." />
      <button className="tl-btn" disabled={loading || !text.trim()} onClick={() => run(async () => (await api('/api/tools/improve', { text, kind })).result)}>
        {loading ? 'Improving...' : 'Improve prompt'}
      </button>
      <Result text={out} err={err} />
    </>
  );
}

function Translator() {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('fix');
  const { loading, err, out, run } = useRun();
  return (
    <>
      <div className="tl-row">
        {[['fix', 'Grammar fix'], ['bn2en', 'Bangla → English'], ['en2bn', 'English → Bangla'], ['banglish', 'Banglish → Bangla']].map(([k, l]) => (
          <button key={k} className={'tl-chip' + (mode === k ? ' on' : '')} onClick={() => setMode(k)}>{l}</button>
        ))}
      </div>
      <textarea className="tl-ta" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text paste koro..." />
      <button className="tl-btn" disabled={loading || !text.trim()} onClick={() => run(async () => (await api('/api/tools/translate', { text, mode })).result)}>
        {loading ? 'Working...' : 'Go'}
      </button>
      <Result text={out} err={err} />
    </>
  );
}

async function readFile(file) {
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let t = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const c = await (await pdf.getPage(i)).getTextContent();
      t += c.items.map((x) => x.str).join(' ') + '\n';
    }
    return t;
  }
  return file.text();
}

function DocQA() {
  const [name, setName] = useState('');
  const [doc, setDoc] = useState('');
  const [q, setQ] = useState('');
  const [fileErr, setFileErr] = useState('');
  const [busy, setBusy] = useState(false);
  const { loading, err, out, run } = useRun();
  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setFileErr(''); setDoc(''); setName(f.name);
    try {
      const t = (await readFile(f)).trim();
      if (t.length < 20) setFileErr('Ei file e text pawa jay nai (scan/image PDF hote pare).');
      else setDoc(t);
    } catch { setFileErr('File porte pari nai.'); }
    setBusy(false);
  };
  return (
    <>
      <input type="file" accept=".pdf,.txt,.md,.csv,.json,.html" onChange={onFile} className="tl-file" />
      {busy && <p className="tl-note">Reading file...</p>}
      {fileErr && <div className="tl-err">⚠ {fileErr}</div>}
      {doc && <p className="tl-note">✓ {name} ready ({doc.length.toLocaleString()} chars{doc.length > 24000 ? ', prothom 24,000 char use hobe' : ''})</p>}
      <textarea className="tl-ta" rows={3} value={q} onChange={(e) => setQ(e.target.value)} placeholder="File niye proshno koro..." />
      <button className="tl-btn" disabled={loading || !doc || !q.trim()} onClick={() => run(async () => (await api('/api/tools/docqa', { doc, question: q })).result)}>
        {loading ? 'Thinking...' : 'Ask'}
      </button>
      <Result text={out} err={err} />
    </>
  );
}

function Mystery() {
  const [n, setN] = useState(0);
  const [v, setV] = useState(null);
  const [on, setOn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const tune = async (k) => {
    setLoading(true); setErr(''); setOn(false); setN(k);
    try {
      const d = await api('/api/mystery?n=' + k);
      await new Promise((r) => setTimeout(r, 900));
      setV(d); setOn(true);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  };
  return (
    <>
      <div className="tv">
        <div className="tv-screen">
          {on && v ? (
            <iframe title="mystery" src={`https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&modestbranding=1`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
          ) : (
            <div className={'tv-noise' + (loading ? ' tuning' : '')}><span>{loading ? 'TUNING...' : 'NO SIGNAL'}</span></div>
          )}
        </div>
        <div className="tv-bar">
          <span className="tv-led" style={{ background: on ? '#4ade80' : '#7f1d1d' }} />
          <span className="tv-title">{on && v ? v.title : 'Mystery Video of the Day'}</span>
        </div>
      </div>
      {err && <div className="tl-err">⚠ {err}</div>}
      <div className="tl-row" style={{ justifyContent: 'center', marginTop: 14 }}>
        <button className="tl-btn" disabled={loading} onClick={() => tune(v ? n : 0)}>{on ? '⟳ Replay' : '⏻ Turn on TV'}</button>
        <button className="tl-btn ghost" disabled={loading} onClick={() => tune(n + 1)}>📡 Next channel</button>
      </div>
    </>
  );
}

export default function Tools() {
  const [tab, setTab] = useState('improve');
  return (
    <div className="tl-wrap">
      <style>{CSS}</style>
      <h1 className="tl-h">Useful Tools</h1>
      <div className="tl-tabs">
        {TABS.map(([k, l]) => (
          <button key={k} className={'tl-tab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'improve' && <Improver />}
      {tab === 'translate' && <Translator />}
      {tab === 'doc' && <DocQA />}
      {tab === 'mystery' && <Mystery />}
    </div>
  );
}

const CSS = `
.tl-wrap{max-width:820px;margin:0 auto;padding:24px 16px 60px;color:inherit}
.tl-h{font-size:26px;font-weight:700;margin:0 0 16px}
.tl-tabs,.tl-row{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}
.tl-tab,.tl-chip{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:inherit;padding:8px 14px;border-radius:999px;cursor:pointer;font-size:14px}
.tl-tab.on,.tl-chip.on{background:linear-gradient(135deg,#7c3aed,#06b6d4);border-color:transparent;color:#fff}
.tl-ta{width:100%;box-sizing:border-box;background:rgba(0,0,0,.25);color:inherit;border:1px solid rgba(255,255,255,.14);border-radius:12px;padding:12px;font:inherit;resize:vertical;margin-bottom:12px}
.tl-btn{background:linear-gradient(135deg,#7c3aed,#06b6d4);color:#fff;border:0;padding:10px 18px;border-radius:12px;cursor:pointer;font-weight:600}
.tl-btn.ghost{background:rgba(255,255,255,.08);color:inherit;border:1px solid rgba(255,255,255,.14);margin-top:10px}
.tl-btn:disabled{opacity:.5;cursor:not-allowed}
.tl-card{margin-top:16px;padding:16px;border-radius:14px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.tl-md p{margin:0 0 10px;line-height:1.6}.tl-md ul{padding-left:20px}
.tl-err{margin:10px 0;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4)}
.tl-note{opacity:.75;font-size:13px;margin:6px 0 12px}
.tl-file{margin-bottom:10px;color:inherit}
.tv{max-width:720px;margin:8px auto 0;padding:16px 16px 12px;border-radius:26px;background:linear-gradient(145deg,#4a3320,#1f140c);box-shadow:0 20px 60px rgba(0,0,0,.5)}
.tv-screen{position:relative;aspect-ratio:16/9;border-radius:16px;overflow:hidden;background:#000;box-shadow:inset 0 0 40px #000}
.tv-screen iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.tv-noise{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:repeating-linear-gradient(0deg,#1a1a1a 0 2px,#3a3a3a 2px 4px);opacity:.9}
.tv-noise.tuning{animation:tvshift .12s steps(2) infinite}
.tv-noise span{background:#000a;color:#fff;padding:4px 12px;border-radius:6px;letter-spacing:3px;font-size:13px}
@keyframes tvshift{to{background-position:0 6px;filter:brightness(1.4)}}
.tv-bar{display:flex;align-items:center;gap:10px;padding:10px 4px 0;color:#e7d6c4;font-size:13px}
.tv-led{width:10px;height:10px;border-radius:50%;flex:none}
.tv-title{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
`;
