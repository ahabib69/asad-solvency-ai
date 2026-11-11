import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Trash2, Pencil, Pin, PinOff, MessageSquareText, Headphones, Lightbulb, Download } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { timeAgo, MODE_LABEL } from '../lib/format.js';

const ICON = { solver: MessageSquareText, live: Headphones, useful: Lightbulb };

export default function HistoryPage() {
  const { refreshConversations, toast } = useApp();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [mode, setMode] = useState('');
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    try { setItems(await api.conversations(q, mode)); } catch (e) { toast(e.message, 'error'); setItems([]); }
  };
  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [q, mode]); // eslint-disable-line

  const act = async (fn, msg) => { try { await fn(); if (msg) toast(msg, 'success'); await load(); refreshConversations(); } catch (e) { toast(e.message, 'error'); } };

  return (
    <div className="history">
      <div className="page-head">
        <div><span className="eyebrow">Conversation History</span><h2>Every conversation, saved</h2></div>
        <div className="row gap-sm">
          <a className="btn btn-ghost btn-sm" href="/api/conversations/export" download><Download size={15} /> Export</a>
          <button className="btn btn-ghost btn-sm danger" onClick={() => { if (confirm('Delete ALL conversations? This cannot be undone.')) act(api.clearConversations, 'History cleared'); }}><Trash2 size={15} /> Clear all</button>
        </div>
      </div>

      <div className="history-filters">
        <div className="search inline"><Search size={17} className="search-ico" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search conversations and messages…" /></div>
        <div className="seg">
          {[['', 'All'], ['solver', 'Problem Solver'], ['live', 'Live AI'], ['useful', 'Useful']].map(([v, l]) => (
            <button key={v} className={mode === v ? 'on' : ''} onClick={() => setMode(v)}>{l}</button>
          ))}
        </div>
      </div>

      {items === null ? <div className="skeleton-list">{[1, 2, 3].map((i) => <div key={i} className="skeleton" />)}</div>
        : items.length === 0 ? (
          <div className="empty glass"><MessageSquareText size={34} /><p>No conversations {q || mode ? 'match your filters' : 'yet'}.</p>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/solver')}>Start solving a problem</button></div>
        ) : (
          <div className="history-list">
            {items.map((c) => {
              const Icon = ICON[c.mode] || MessageSquareText;
              return (
                <div key={c.id} className="h-item glass">
                  <div className={`h-ico m-${c.mode}`}><Icon size={20} /></div>
                  <div className="h-body" onClick={() => editing !== c.id && navigate(`/solver/${c.id}`)} role="button" tabIndex={0}>
                    {editing === c.id ? (
                      <input autoFocus defaultValue={c.title} onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => { if (e.key === 'Enter') { act(() => api.renameConversation(c.id, e.currentTarget.value)); setEditing(null); } if (e.key === 'Escape') setEditing(null); }}
                        onBlur={(e) => { act(() => api.renameConversation(c.id, e.currentTarget.value)); setEditing(null); }} />
                    ) : <strong>{c.pinned && '📌 '}{c.title}</strong>}
                    <p>{c.preview?.replace(/[#*_`>]/g, '').slice(0, 140) || 'No messages yet'}</p>
                    <span className="tiny muted">{MODE_LABEL[c.mode]} · {c.messageCount} messages · {timeAgo(c.updatedAt)}</span>
                  </div>
                  <div className="h-actions">
                    <button className="icon-btn sm" title={c.pinned ? 'Unpin' : 'Pin'} onClick={() => act(() => api.pinConversation(c.id, !c.pinned))}>{c.pinned ? <PinOff size={16} /> : <Pin size={16} />}</button>
                    <button className="icon-btn sm" title="Rename" onClick={() => setEditing(c.id)}><Pencil size={16} /></button>
                    <button className="icon-btn sm danger" title="Delete" onClick={() => { if (confirm('Delete this conversation?')) act(() => api.deleteConversation(c.id), 'Deleted'); }}><Trash2 size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}
