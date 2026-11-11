import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Sun, Moon, Bell, PanelLeftClose, PanelLeftOpen, X, PanelRightOpen, Menu, MessageSquareText, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import { NAV } from './Sidebar.jsx';
import { timeAgo, MODE_LABEL } from '../../lib/format.js';

export default function Topbar() {
  const { settings, updateSettings, notifications, setNotifications, conversations, setMobileNavOpen } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const wrapRef = useRef(null);
  const bellRef = useRef(null);
  const inputRef = useRef(null);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setSearchOpen(false);
      if (!bellRef.current?.contains(e.target)) setBellOpen(false);
    };
    const onKey = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); } };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, []);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return { pages: [], convs: conversations.slice(0, 4) };
    return {
      pages: NAV.filter((p) => p.label.toLowerCase().includes(n)),
      convs: conversations.filter((c) => c.title.toLowerCase().includes(n) || c.preview?.toLowerCase().includes(n)).slice(0, 6),
    };
  }, [q, conversations]);

  const go = (to, state) => { navigate(to, state ? { state } : undefined); setSearchOpen(false); setQ(''); };

  return (
    <header className="topbar">
      <button className="icon-btn mobile-only" onClick={() => setMobileNavOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
      <div className="search" ref={wrapRef}>
        <Search size={18} className="search-ico" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
          onFocus={() => setSearchOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && q.trim()) go('/solver', { initialMessage: q.trim() });
            if (e.key === 'Escape') { setSearchOpen(false); e.currentTarget.blur(); }
          }}
          placeholder="Search anything..."
          aria-label="Search"
        />
        <kbd className="desktop-only">Ctrl K</kbd>
        {searchOpen && (
          <div className="dropdown search-dd glass">
            {q.trim() && (
              <button className="dd-item dd-ask" onClick={() => go('/solver', { initialMessage: q.trim() })}>
                <MessageSquareText size={16} /> Ask Problem Solver: <strong>“{q.trim()}”</strong>
              </button>
            )}
            {results.pages.length > 0 && <div className="dd-label">Pages</div>}
            {results.pages.map((p) => (
              <button key={p.to} className="dd-item" onClick={() => go(p.to)}><p.icon size={16} /> {p.label}</button>
            ))}
            <div className="dd-label">{q.trim() ? 'Conversations' : 'Recent conversations'}</div>
            {results.convs.length === 0 && <div className="dd-empty">No conversations found.</div>}
            {results.convs.map((c) => (
              <button key={c.id} className="dd-item" onClick={() => go(`/solver/${c.id}`)}>
                <span className="dd-title">{c.title}</span>
                <span className="dd-sub">{MODE_LABEL[c.mode]} · {timeAgo(c.updatedAt)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="topbar-actions">
        <button className={`top-tab ${pathname.startsWith('/browser') ? 'on' : ''}`} onClick={() => navigate('/browser')} title="Web Browser">
          <Globe size={18} /> <span>Web Browser</span>
        </button>
        <button className="icon-btn" title={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })}>
          {settings.theme === 'dark' ? <Sun size={21} /> : <Moon size={21} />}
        </button>
        <div className="bell-wrap" ref={bellRef}>
          <button className="icon-btn" title="Notifications" onClick={() => setBellOpen((v) => !v)}>
            <Bell size={21} />
            {unread > 0 && <span className="bell-badge">{unread}</span>}
          </button>
          {bellOpen && (
            <div className="dropdown bell-dd glass">
              <div className="dd-head">
                <strong>Notifications</strong>
                <button className="link-btn" onClick={() => setNotifications((ns) => ns.map((n) => ({ ...n, read: true })))}>Mark all read</button>
              </div>
              {notifications.map((n) => (
                <button key={n.id} className={`dd-item notif ${n.read ? '' : 'unread'}`}
                  onClick={() => { setNotifications((ns) => ns.map((x) => x.id === n.id ? { ...x, read: true } : x)); setBellOpen(false); navigate(n.to); }}>
                  <span className="dd-title">{n.title}</span>
                  <span className="dd-sub">{n.body}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="icon-btn desktop-only" title={settings.sidebarCollapsed ? 'Expand sidebar' : 'Minimize sidebar'}
          onClick={() => updateSettings({ sidebarCollapsed: !settings.sidebarCollapsed })}>
          {settings.sidebarCollapsed ? <PanelLeftOpen size={21} /> : <PanelLeftClose size={21} />}
        </button>
        <button className="icon-btn wide-only" title={settings.showLivePanel ? 'Close Live AI panel' : 'Open Live AI panel'}
          onClick={() => updateSettings({ showLivePanel: !settings.showLivePanel })}>
          {settings.showLivePanel ? <X size={22} /> : <PanelRightOpen size={21} />}
        </button>
      </div>
    </header>
  );
}
