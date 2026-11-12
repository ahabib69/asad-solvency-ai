import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, RotateCw, X, Home, Plus, Lock, Globe, ExternalLink, Search, ShieldAlert, Loader2, Info, Unlock, Download, Film, Music } from 'lucide-react';
import { LogoMark } from '../components/ui/Logo.jsx';
import { NEW_TAB, QUICK_LINKS, toUrl, embedUrl, hostOf, faviconFor, displayUrl, googleSearch } from '../lib/browser.js';

const STORE = 'asad.browser';
const RECENT = 'asad.browser.recent';
const MAX_TABS = 24;
const uid = () => Math.random().toString(36).slice(2, 10);
const makeTab = (url = NEW_TAB) => ({ id: uid(), history: [url], index: 0, reload: 0, force: false });
const cur = (t) => t.history[t.index];
const frameKey = (t) => `${t.id}:${t.index}:${t.reload}`;

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    if (s?.tabs?.length && s.tabs.every((t) => Array.isArray(t.history))) {
      return { tabs: s.tabs.map((t) => ({ ...t, force: false })), activeId: s.tabs.some((t) => t.id === s.activeId) ? s.activeId : s.tabs[0].id };
    }
  } catch {}
  const t = makeTab();
  return { tabs: [t], activeId: t.id };
}
const loadRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT)) || []; } catch { return []; } };

function Favicon({ url, size = 16 }) {
  const [err, setErr] = useState(false);
  useEffect(() => setErr(false), [url]);
  if (!url || url === NEW_TAB || err) return <Globe size={size} className="bw-fav-fallback" />;
  return <img className="bw-fav" src={faviconFor(url)} width={size} height={size} alt="" onError={() => setErr(true)} />;
}

export default function WebBrowser() {
  const goHome = useRouterNavigate();
  const [{ tabs, activeId }, setState] = useState(loadState);
  const [info, setInfo] = useState({});      // embedUrl -> { status, embeddable, reason, title }
  const [loaded, setLoaded] = useState({});  // frameKey -> true once the iframe fired onLoad
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [recent, setRecent] = useState(loadRecent);
  const omniRef = useRef(null);
  const pending = useRef(new Set());
  const tabsRef = useRef(null);

  const active = tabs.find((t) => t.id === activeId) || tabs[0];
  const activeUrl = cur(active);

  useEffect(() => { localStorage.setItem(STORE, JSON.stringify({ tabs, activeId })); }, [tabs, activeId]);
  useEffect(() => { localStorage.setItem(RECENT, JSON.stringify(recent.slice(0, 8))); }, [recent]);
  useEffect(() => { if (!editing) setDraft(displayUrl(activeUrl)); }, [activeUrl, active.id, editing]);

  // Ask the server whether each open page allows embedding (X-Frame-Options / CSP frame-ancestors).
  useEffect(() => {
    tabs.forEach((t) => {
      const u = cur(t);
      if (u === NEW_TAB) return;
      const lu = embedUrl(u);
      if (info[lu] || pending.current.has(lu)) return;
      pending.current.add(lu);
      setInfo((i) => ({ ...i, [lu]: { status: 'checking' } }));
      fetch('/api/browser/inspect?url=' + encodeURIComponent(lu))
        .then((r) => (r.ok ? r.json() : { embeddable: null }))
        .catch(() => ({ embeddable: null }))
        .then((d) => { pending.current.delete(lu); setInfo((i) => ({ ...i, [lu]: { status: 'done', ...d } })); });
    });
  }, [tabs, info]);

  // keep active tab visible in the strip
  useEffect(() => { tabsRef.current?.querySelector('.bw-tab.active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }, [activeId]);

  const updateTab = useCallback((id, fn) => setState((s) => ({ ...s, tabs: s.tabs.map((t) => (t.id === id ? fn(t) : t)) })), []);

  const remember = (url) => {
    if (url === NEW_TAB) return;
    setRecent((r) => [url, ...r.filter((x) => hostOf(x) !== hostOf(url))].slice(0, 8));
  };

  const navigate = useCallback((raw, id = activeId) => {
    const url = toUrl(raw);
    updateTab(id, (t) => (cur(t) === url
      ? { ...t, reload: t.reload + 1, force: false }
      : { ...t, history: [...t.history.slice(0, t.index + 1), url], index: t.index + 1, force: false }));
    remember(url);
    setEditing(false);
    omniRef.current?.blur();
  }, [activeId, updateTab]);

  const go = (delta) => updateTab(active.id, (t) => ({ ...t, index: Math.min(t.history.length - 1, Math.max(0, t.index + delta)), force: false }));

  const reload = () => {
    const lu = embedUrl(activeUrl);
    setInfo((i) => { const n = { ...i }; delete n[lu]; return n; });
    updateTab(active.id, (t) => ({ ...t, reload: t.reload + 1 }));
  };

  const newTab = (url) => {
    if (tabs.length >= MAX_TABS) return;
    const t = makeTab(url ? toUrl(url) : NEW_TAB);
    setState((s) => ({ tabs: [...s.tabs, t], activeId: t.id }));
    if (url) remember(toUrl(url));
    else setTimeout(() => omniRef.current?.focus(), 30);
  };

  const closeTab = (id) => setState((s) => {
    const idx = s.tabs.findIndex((t) => t.id === id);
    let next = s.tabs.filter((t) => t.id !== id);
    if (!next.length) next = [makeTab()];
    const nextActive = s.activeId === id ? (next[idx] || next[idx - 1] || next[0]).id : s.activeId;
    return { tabs: next, activeId: nextActive };
  });

  const openExternal = (url) => { if (url && url !== NEW_TAB) window.open(url, '_blank', 'noopener,noreferrer'); };

  // Keyboard shortcuts (browser-reserved combos like Ctrl+T can't be captured by a web page)
  useEffect(() => {
    const onKey = (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key.toLowerCase();
      if (k === 't') { e.preventDefault(); newTab(); }
      else if (k === 'w') { e.preventDefault(); closeTab(activeId); }
      else if (k === 'd') { e.preventDefault(); omniRef.current?.focus(); omniRef.current?.select(); }
      else if (/^[1-9]$/.test(k)) { e.preventDefault(); const t = tabs[Math.min(tabs.length, Number(k)) - 1]; if (t) setState((s) => ({ ...s, activeId: t.id })); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const tabTitle = (t) => {
    const u = cur(t);
    if (u === NEW_TAB) return 'New Tab';
    return info[embedUrl(u)]?.title || hostOf(u) || u;
  };
  const isLoading = (t) => {
    const u = cur(t);
    if (u === NEW_TAB) return false;
    const i = info[embedUrl(u)];
    if (!i || i.status === 'checking') return true;
    if (i.embeddable === false && !t.force) return false;
    return !loaded[frameKey(t)];
  };

  const secure = activeUrl.startsWith('https://');
  const activeLoading = isLoading(active);

  return (
    <div className="bw">
      {/* ---------- Tab strip ---------- */}
      <div className="bw-tabstrip" ref={tabsRef} role="tablist" aria-label="Browser tabs">
        <button className="bw-exit" onClick={() => goHome('/')} title="Back to ASAD SOLVENCY" aria-label="Back to ASAD SOLVENCY"><LogoMark size={22} /></button>
        {tabs.map((t, i) => {
          const on = t.id === active.id;
          const prevOn = i > 0 && tabs[i - 1].id === active.id;
          return (
            <div key={t.id} role="tab" aria-selected={on} title={tabTitle(t)}
              className={`bw-tab ${on ? 'active' : ''} ${i === 0 || on || prevOn ? 'no-sep' : ''}`}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); closeTab(t.id); } }}
              onClick={() => setState((s) => ({ ...s, activeId: t.id }))}>
              {on && <><span className="bw-curve l" /><span className="bw-curve r" /></>}
              {isLoading(t) ? <Loader2 size={15} className="spin bw-tab-spin" /> : <Favicon url={cur(t)} />}
              <span className="bw-tab-title">{tabTitle(t)}</span>
              <button className="bw-tab-close" aria-label="Close tab" onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}><X size={13} /></button>
            </div>
          );
        })}
        <button className="bw-newtab" onClick={() => newTab()} title="New tab (Alt+T)" disabled={tabs.length >= MAX_TABS}><Plus size={17} /></button>
      </div>

      {/* ---------- Toolbar ---------- */}
      <div className="bw-toolbar">
        <button className="bw-btn" onClick={() => go(-1)} disabled={active.index === 0} title="Back"><ArrowLeft size={18} /></button>
        <button className="bw-btn" onClick={() => go(1)} disabled={active.index >= active.history.length - 1} title="Forward"><ArrowRight size={18} /></button>
        <button className="bw-btn" onClick={reload} disabled={activeUrl === NEW_TAB} title="Refresh"><RotateCw size={17} className={activeLoading ? 'spin-slow' : ''} /></button>
        <button className="bw-btn" onClick={() => navigate(NEW_TAB)} title="Home"><Home size={18} /></button>

        <form className="bw-omni" onSubmit={(e) => { e.preventDefault(); navigate(draft); }}>
          <span className="bw-omni-ico" title={activeUrl === NEW_TAB ? '' : secure ? 'Connection is secure' : 'Not secure'}>
            {activeUrl === NEW_TAB || editing ? <Search size={15} /> : secure ? <Lock size={14} /> : <Unlock size={14} className="warn" />}
          </span>
          <input ref={omniRef} value={draft} spellCheck={false} autoComplete="off" aria-label="Address and search bar"
            placeholder="Search Google or type a URL"
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => { setEditing(true); e.target.select(); }}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(displayUrl(activeUrl)); e.currentTarget.blur(); } }} />
          {activeUrl !== NEW_TAB && !editing && (
            <button type="button" className="bw-omni-btn" title="Open this page in a new browser tab" onMouseDown={(e) => e.preventDefault()} onClick={() => openExternal(activeUrl)}><ExternalLink size={15} /></button>
          )}
          <button type="submit" className="bw-go">Go</button>
        </form>
        {activeLoading && <div className="bw-progress" />}
      </div>

      {/* ---------- Bookmarks / quick links ---------- */}
      <div className="bw-bookmarks">
        {QUICK_LINKS.map((q) => (
          <button key={q.name} className="bw-bm" onClick={() => navigate(q.url)} onAuxClick={(e) => e.button === 1 && newTab(q.url)} title={`${q.url} (middle-click: new tab)`}>
            <Favicon url={q.url} size={14} /> {q.name}
          </button>
        ))}
        <span className="bw-bm-hint" title="Websites decide whether they can be shown inside other sites. Back/Forward follow the addresses you open from this bar; links you click inside a page stay inside its frame.">
          <Info size={13} /> Alt+T new tab · Alt+W close
        </span>
      </div>


      {/* ---------- Downloadable media found on the current page ---------- */}
      {(() => {
        const media = info[embedUrl(activeUrl)]?.media || [];
        return media.length > 0 ? <MediaBar key={activeUrl} media={media} /> : null;
      })()}

      {/* ---------- Viewport (every tab stays mounted so pages keep their state) ---------- */}
      <div className="bw-viewport">
        {tabs.map((t) => {
          const u = cur(t);
          const on = t.id === active.id;
          const lu = embedUrl(u);
          const i = info[lu];
          let body;
          if (u === NEW_TAB) {
            body = on ? <NewTabPage onGo={(v) => navigate(v, t.id)} onNewTab={newTab} recent={recent} onClearRecent={() => setRecent([])} /> : null;
          } else if (!i || i.status === 'checking') {
            body = <div className="bw-connecting"><Loader2 size={28} className="spin" /><span>Connecting to {hostOf(u)}…</span></div>;
          } else if (i.embeddable === false && !t.force) {
            body = (
              <BlockedPage url={u} reason={i.reason} canGoBack={t.index > 0}
                onOpen={() => openExternal(u)} onBack={() => updateTab(t.id, (x) => ({ ...x, index: Math.max(0, x.index - 1) }))}
                onTryAnyway={() => updateTab(t.id, (x) => ({ ...x, force: true }))}
                onSearch={(q) => navigate(q, t.id)} />
            );
          } else {
            body = (
              <iframe key={frameKey(t)} className="bw-frame" src={lu} title={tabTitle(t)}
                onLoad={() => setLoaded((l) => ({ ...l, [frameKey(t)]: true }))}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-presentation allow-pointer-lock allow-storage-access-by-user-activation"
                allow="autoplay; fullscreen; picture-in-picture; encrypted-media; clipboard-write; web-share"
                referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
            );
          }
          return <div key={t.id} className={`bw-pane ${on ? 'on' : ''}`} aria-hidden={!on}>{body}</div>;
        })}
      </div>
    </div>
  );
}

const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n > 1024 ? `${Math.round(n / 1024)} KB` : '');
const dlHref = (m) => `/api/browser/download?url=${encodeURIComponent(m.url)}&name=${encodeURIComponent(m.name)}`;

function MediaBar({ media }) {
  const [open, setOpen] = useState(false);
  const first = media[0];
  const rest = media.slice(1);
  const Icon = (m) => (m.kind === 'audio' ? <Music size={15} /> : <Film size={15} />);
  return (
    <div className="bw-media">
      <div className="bw-media-main">
        <span className="bw-media-ico">{Icon(first)}</span>
        <span className="bw-media-text">
          <strong>{media.length > 1 ? `${media.length} downloadable files found` : `Downloadable ${first.kind} found`}</strong>
          <span className="tiny muted bw-media-name" title={first.name}>{first.name}{first.size ? ` · ${fmtSize(first.size)}` : ''}</span>
        </span>
        <a className="btn btn-primary btn-sm" href={dlHref(first)} download={first.name}><Download size={15} /> Download</a>
        {rest.length > 0 && <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : `+${rest.length} more`}</button>}
      </div>
      {open && (
        <div className="bw-media-list">
          {rest.map((m) => (
            <div key={m.url} className="bw-media-row">
              <span className="bw-media-ico">{Icon(m)}</span>
              <span className="bw-media-name tiny" title={m.url}>{m.name}</span>
              <a className="btn btn-ghost btn-sm" href={dlHref(m)} download={m.name}><Download size={14} /> Download</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewTabPage({ onGo, onNewTab, recent, onClearRecent }) {
  const [q, setQ] = useState('');
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="bw-ntp">
      <div className="bw-ntp-inner">
        <div className="bw-ntp-logo"><LogoMark size={64} /><div><strong>ASAD SOLVENCY</strong><span>Web Browser</span></div></div>
        <form className="bw-ntp-search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) onGo(q); }}>
          <Search size={19} />
          <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Google or type a URL" aria-label="Search or URL" />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!q.trim()}>Go</button>
        </form>
        <div className="bw-tiles">
          {QUICK_LINKS.map((l) => (
            <button key={l.name} className="bw-tile" onClick={() => onGo(l.url)} onAuxClick={(e) => e.button === 1 && onNewTab(l.url)}>
              <span className="bw-tile-ico"><Favicon url={l.url} size={28} /></span>
              <span>{l.name}</span>
            </button>
          ))}
        </div>
        {recent.length > 0 && (
          <div className="bw-recent">
            <div className="row between"><span className="tiny muted">Recently visited</span><button className="link-btn tiny" onClick={onClearRecent}>Clear</button></div>
            <div className="bw-recent-list">
              {recent.map((u) => (
                <button key={u} className="bw-recent-item" onClick={() => onGo(u)} title={u}><Favicon url={u} size={14} /> <span>{hostOf(u)}</span></button>
              ))}
            </div>
          </div>
        )}
        <p className="tiny muted bw-ntp-note">Tip: paste a YouTube video link and it plays right here. Some sites (like the YouTube homepage, GitHub or Facebook) don&rsquo;t allow embedding. You&rsquo;ll get a one-click &ldquo;Open in new tab&rdquo; for those.</p>
      </div>
    </div>
  );
}

function BlockedPage({ url, reason, canGoBack, onOpen, onBack, onTryAnyway, onSearch }) {
  const host = hostOf(url);
  const isYouTube = /(^|\.)youtube\.com$/.test(host);
  return (
    <div className="bw-blocked">
      <div className="bw-blocked-card glass">
        <div className="bw-blocked-ico"><ShieldAlert size={30} /><span className="bw-blocked-fav"><Favicon url={url} size={18} /></span></div>
        <h3>This site blocked embedding - Open in new tab</h3>
        <p className="muted"><strong>{host}</strong> doesn&rsquo;t allow other websites to display it inside a frame. {reason && reason !== 'private' && reason !== 'unreachable' ? <span className="bw-reason">{reason}</span> : null}</p>
        <div className="bw-blocked-actions">
          <button className="btn btn-primary" onClick={onOpen}><ExternalLink size={16} /> Open</button>
          {canGoBack && <button className="btn btn-ghost" onClick={onBack}><ArrowLeft size={16} /> Go back</button>}
          <button className="btn btn-ghost" onClick={onTryAnyway} title="Load the frame anyway (your browser will likely refuse)">Try anyway</button>
        </div>
        {isYouTube ? (
          <p className="tiny muted bw-tip">💡 Tip: paste a video link like <code>youtube.com/watch?v=…</code> or <code>youtu.be/…</code> and it plays right here.</p>
        ) : (
          <button className="link-btn tiny bw-tip" onClick={() => onSearch(googleSearch(host))}><Search size={13} /> Search Google for {host} instead</button>
        )}
      </div>
    </div>
  );
}
