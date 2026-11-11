import { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Plus, History, AudioLines, ShieldCheck } from 'lucide-react';
import Composer from '../components/chat/Composer.jsx';
import MessageBubble from '../components/chat/MessageBubble.jsx';
import ConfigNotice from '../components/ui/ConfigNotice.jsx';
import { useChatStream } from '../hooks/useChatStream.js';
import { useApp } from '../context/AppContext.jsx';
import { CATEGORIES } from '../lib/data.js';

export default function ProblemSolver() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { settings, status } = useApp();
  const ownIdRef = useRef(undefined); // id currently shown (undefined = nothing loaded yet)
  const handledState = useRef(null);
  const scrollRef = useRef(null);
  const stickRef = useRef(true);

  const chat = useChatStream({
    mode: 'solver',
    onConversation: (cid) => { ownIdRef.current = cid; navigate(`/solver/${cid}`, { replace: true, state: {} }); },
  });

  // Load conversation from URL (unless it's the one we just created while streaming)
  useEffect(() => {
    const target = id || null;
    if (target === ownIdRef.current) return; // already showing it (or we just created it while streaming)
    ownIdRef.current = target;
    chat.load(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Prompts handed over from Home / search / pills
  useEffect(() => {
    const st = location.state || {};
    const key = st.initialMessage ? 'm:' + st.initialMessage + location.key : st.fresh ? 'f:' + st.fresh : null;
    if (!key || handledState.current === key) return;
    handledState.current = key;
    if (st.fresh) { ownIdRef.current = null; chat.load(null); if (id) navigate('/solver', { replace: true }); return; }
    const msg = st.initialMessage;
    (async () => {
      if (id) { ownIdRef.current = null; await chat.load(null); navigate('/solver', { replace: true, state: {} }); }
      chat.send(msg);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current && chat.messages.length) el.scrollTop = el.scrollHeight;
  }, [chat.messages]);

  const onScroll = () => {
    const el = scrollRef.current;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const newChat = () => { ownIdRef.current = null; chat.load(null); navigate('/solver'); };
  const empty = chat.messages.length === 0;
  const notConfigured = status && !status.llm.configured;

  return (
    <div className="solver">
      <div className="solver-head">
        <div>
          <span className="eyebrow">Problem Solver</span>
          <h2 className="solver-title">{empty ? 'New conversation' : chat.title || 'Conversation'}</h2>
        </div>
        <div className="row gap-sm">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/live')}><AudioLines size={16} /> <span className="hide-sm">Talk instead</span></button>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/history')}><History size={16} /> <span className="hide-sm">History</span></button>
          <button className="btn btn-primary btn-sm" onClick={newChat}><Plus size={16} /> New</button>
        </div>
      </div>

      <div className="thread" ref={scrollRef} onScroll={onScroll}>
        {empty ? (
          <div className="solver-welcome">
            <div className="welcome-orb" />
            <h1>Hello{settings.name ? `, ${settings.name}` : ''}! What&rsquo;s going on in your world today?</h1>
            <p className="lead">Life can get complicated. You don&rsquo;t have to figure everything out alone.</p>
            {notConfigured && <ConfigNotice />}
            <div className="solver-composer-hero">
              <Composer large autoFocus onSend={(t) => chat.send(t)} busy={chat.busy} onStop={chat.stop} />
            </div>
            <div className="cat-grid">
              {CATEGORIES.map((c) => (
                <div key={c.id} className="cat-card glass">
                  <h4><span>{c.emoji}</span> {c.title}</h4>
                  {c.examples.map((ex) => (
                    <button key={ex} className="example" onClick={() => chat.send(ex)}>{ex}</button>
                  ))}
                </div>
              ))}
            </div>
            <p className="tiny muted center privacy"><ShieldCheck size={14} /> Conversations are stored on your own server. Asad Solvency gives guidance, not professional medical, legal or financial advice.</p>
          </div>
        ) : (
          <div className="messages">
            {chat.messages.map((m, i) => (
              <MessageBubble
                key={m.id || m.tempId || i}
                msg={m}
                isLast={i === chat.messages.length - 1}
                streaming={chat.busy && i === chat.messages.length - 1 && m.role === 'assistant'}
                onRegenerate={!chat.busy ? chat.regenerate : undefined}
                onFeedback={chat.feedback}
              />
            ))}
          </div>
        )}
      </div>

      {!empty && (
        <div className="solver-dock">
          <Composer onSend={(t) => chat.send(t)} busy={chat.busy} onStop={chat.stop} placeholder="Reply, add details, or ask “what if…”" />
        </div>
      )}
    </div>
  );
}
