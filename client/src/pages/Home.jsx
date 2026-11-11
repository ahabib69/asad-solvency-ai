import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Clock, ArrowRight, ChevronRight, Headphones, Image as ImageIcon, CheckCircle2, MessageSquareText, BarChart3, FileText, Lightbulb } from 'lucide-react';
import Composer from '../components/chat/Composer.jsx';
import ConfigNotice from '../components/ui/ConfigNotice.jsx';
import { useApp } from '../context/AppContext.jsx';
import { QUICK_PROBLEMS, CATEGORIES } from '../lib/data.js';
import { timeAgo } from '../lib/format.js';

const STARTERS = [
  { title: 'Relationship advice', icon: MessageSquareText, prompt: "I need relationship advice — something's been bothering me." },
  { title: 'Business idea', icon: BarChart3, prompt: 'Help me find a business idea that suits me.' },
  { title: 'Project help', icon: FileText, prompt: 'I need help planning and finishing a project.' },
];
const iconFor = (c) => (c.mode === 'live' ? Headphones : c.mode === 'useful' ? Lightbulb : /business|money|income|budget/i.test(c.title) ? BarChart3 : /project|work|plan/i.test(c.title) ? FileText : MessageSquareText);

export default function Home() {
  const { settings, conversations, avatarUrl, status } = useApp();
  const navigate = useNavigate();
  const ask = (text) => navigate('/solver', { state: { initialMessage: text } });
  const recent = conversations.slice(0, 3);

  const suggestions = useMemo(() => {
    const day = new Date().getDate();
    return CATEGORIES.map((c, i) => ({ cat: c.title, emoji: c.emoji, text: c.examples[(day + i) % c.examples.length] })).slice(0, 3);
  }, []);

  return (
    <div className="home">
      <section className="hero">
        <img className="hero-bg" src="/assets/hero-galaxy.jpg" alt="" />
        <div className="hero-shade" />
        <div className="hero-greet">
          <img src={avatarUrl} alt="" className="avatar lg" />
          <div>
            <h1>Hello, {settings.name || 'friend'}! <span className="wave">👋</span></h1>
            <p>Life can get complicated. You don&rsquo;t have to figure everything out alone.</p>
          </div>
        </div>
        <div className="hero-solver">
          <h2>What&rsquo;s going on in your world today?</h2>
          <Composer large onSend={ask} placeholder="Tell me what's happening. No problem is too complicated to start discussing..." />
        </div>
      </section>

      {status && !status.llm.configured && <ConfigNotice compact />}

      <section className="pills">
        {QUICK_PROBLEMS.map(({ label, icon: Icon, color, prompt }) => (
          <button key={label} className={`pill pill-${color}`} onClick={() => ask(prompt)}>
            <Icon size={20} /> <span>{label}</span>
          </button>
        ))}
      </section>

      <section className="home-grid">
        <div className="panel glass quick">
          <div className="panel-head">
            <Zap size={26} className="zap" />
            <div><h3>Quick Access</h3><p>Explore powerful features</p></div>
          </div>
          <div className="qa-cards">
            <div className="qa-card qa-live">
              <div className="qa-ico"><Headphones size={34} /></div>
              <h4>Live AI</h4><p>Talk with your AI companion</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/live')}>Start Now <ArrowRight size={15} /></button>
            </div>
            <div className="qa-card qa-studio">
              <div className="qa-ico"><ImageIcon size={34} /></div>
              <h4>4K Creative Studio</h4><p>Generate stunning images</p>
              <button className="btn btn-blue btn-sm" onClick={() => navigate('/studio')}>Create Now <ArrowRight size={15} /></button>
            </div>
            <div className="qa-card qa-useful">
              <div className="qa-ico green"><CheckCircle2 size={34} /></div>
              <h4>Make Yourself Useful</h4><p>Get productive with AI</p>
              <button className="btn btn-primary btn-sm" onClick={() => navigate('/useful')}>Explore <ArrowRight size={15} /></button>
            </div>
          </div>
        </div>

        <div className="panel glass recent">
          <div className="panel-head between">
            <div className="row gap-sm"><Clock size={24} /><h3>Recent Conversations</h3></div>
            <button className="link-btn" onClick={() => navigate('/history')}>View all <ArrowRight size={15} /></button>
          </div>
          <div className="recent-list">
            {recent.length > 0 ? recent.map((c) => {
              const Icon = iconFor(c);
              return (
                <button key={c.id} className="recent-item" onClick={() => navigate(`/solver/${c.id}`)}>
                  <Icon size={22} className="ri-ico" />
                  <div><strong>{c.title}</strong><span>{timeAgo(c.updatedAt)}</span></div>
                  <ChevronRight size={18} />
                </button>
              );
            }) : (
              <>
                <p className="tiny muted ri-empty">No conversations yet — start one:</p>
                {STARTERS.map(({ title, icon: Icon, prompt }) => (
                  <button key={title} className="recent-item" onClick={() => ask(prompt)}>
                    <Icon size={22} className="ri-ico" />
                    <div><strong>{title}</strong><span>Tap to start</span></div>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </section>

      <section className="suggest">
        <h3 className="section-title"><Lightbulb size={20} /> Useful suggestions for today</h3>
        <div className="suggest-grid">
          {suggestions.map((s) => (
            <button key={s.text} className="suggest-card glass" onClick={() => ask(s.text)}>
              <span className="tiny muted">{s.emoji} {s.cat}</span>
              <span>{s.text}</span>
              <ArrowRight size={16} className="sg-arrow" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
