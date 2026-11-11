import { useNavigate } from 'react-router-dom';
import { RefreshCw, MessageSquareText, Square, UserRound } from 'lucide-react';
import StructuredMarkdown from '../components/chat/StructuredMarkdown.jsx';
import ConfigNotice from '../components/ui/ConfigNotice.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useChatStream } from '../hooks/useChatStream.js';
import { USEFUL_ACTIONS } from '../lib/data.js';
import { useEffect, useRef, useState } from 'react';

const TIMES = ['10 min', '30 min', '1 hour', '2+ hours'];
const ENERGY = ['Low', 'Medium', 'High'];

export default function MakeUseful() {
  const { settings, updateSettings, status } = useApp();
  const navigate = useNavigate();
  const chat = useChatStream({ mode: 'useful' });
  const [active, setActive] = useState(null);
  const resultRef = useRef(null);
  useEffect(() => { if (active) setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }, [active, chat.conversationId]);
  const p = settings.usefulProfile;
  const setP = (patch) => updateSettings({ usefulProfile: { ...p, ...patch } });

  const run = async (action) => {
    setActive(action.id);
    await chat.load(null);
    const time = action.id === 'ten' ? '10 min' : p.time;
    const profile = [
      `Interests: ${p.interests || 'not specified'}`,
      `Skills: ${p.skills || 'not specified'}`,
      `Time available right now: ${time}`,
      `Energy level: ${p.energy}`,
      `Goal: ${p.goal || 'not specified'}`,
    ].join('\n');
    chat.send(`Request: ${action.title}\n\nMy profile:\n${profile}`, `${action.emoji} ${action.title} · ${time} · ${p.energy} energy`);
  };

  const last = chat.messages.filter((m) => m.role === 'assistant').pop();
  const activeAction = USEFUL_ACTIONS.find((a) => a.id === active);

  return (
    <div className="useful">
      <div className="page-head">
        <div>
          <span className="eyebrow">Make Yourself Useful</span>
          <h2>Stop scrolling. Start something that matters.</h2>
          <p className="muted">Tell me a little about you and I&rsquo;ll give you practical, personalised things to do — right now.</p>
        </div>
      </div>
      {status && !status.llm.configured && <ConfigNotice compact />}

      <div className="useful-grid">
        <div className="profile-card glass">
          <h4><UserRound size={18} /> Your profile</h4>
          <div className="form">
            <label>Interests<input value={p.interests} onChange={(e) => setP({ interests: e.target.value })} placeholder="e.g. football, design, cooking, tech" /></label>
            <label>Skills<input value={p.skills} onChange={(e) => setP({ skills: e.target.value })} placeholder="e.g. Canva, English, Excel, video editing" /></label>
            <label>Goal<input value={p.goal} onChange={(e) => setP({ goal: e.target.value })} placeholder="e.g. earn extra income, get fit, learn coding" /></label>
            <label>Time available
              <div className="seg">{TIMES.map((t) => <button key={t} className={p.time === t ? 'on' : ''} onClick={() => setP({ time: t })}>{t}</button>)}</div>
            </label>
            <label>Energy
              <div className="seg">{ENERGY.map((t) => <button key={t} className={p.energy === t ? 'on' : ''} onClick={() => setP({ energy: t })}>{t}</button>)}</div>
            </label>
            <p className="tiny muted">Saved on this device. The more specific you are, the better the ideas.</p>
          </div>
        </div>

        <div className="useful-main">
          <div className="action-grid">
            {USEFUL_ACTIONS.map((a) => (
              <button key={a.id} className={`action-card glass ${active === a.id ? 'on' : ''}`} onClick={() => run(a)} disabled={chat.busy}>
                <span className="action-emoji">{a.emoji}</span>
                <span>{a.title}</span>
              </button>
            ))}
          </div>

          {last && (
            <div className="useful-result glass" ref={resultRef}>
              <div className="row between">
                <strong>{activeAction ? `${activeAction.emoji} ${activeAction.title}` : 'Your plan'}</strong>
                <div className="row gap-sm">
                  {chat.busy ? (
                    <button className="btn btn-ghost btn-sm" onClick={chat.stop}><Square size={14} /> Stop</button>
                  ) : (
                    <>
                      {activeAction && <button className="btn btn-ghost btn-sm" onClick={() => run(activeAction)}><RefreshCw size={14} /> Give me others</button>}
                      {chat.conversationId && <button className="btn btn-primary btn-sm" onClick={() => navigate(`/solver/${chat.conversationId}`)}><MessageSquareText size={14} /> Discuss it</button>}
                    </>
                  )}
                </div>
              </div>
              {last.error ? <p className="error-text">{last.content}</p> : last.content ? <StructuredMarkdown content={last.content} streaming={chat.busy} /> : (
                <div className="thinking-dots"><span /><span /><span /><em>Finding something worth your time…</em></div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
