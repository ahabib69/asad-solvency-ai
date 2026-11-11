import { NavLink, useNavigate } from 'react-router-dom';
import { Home, MessageSquareText, AudioLines, Sparkles, Lightbulb, History, Settings, ArrowRight, X, Globe } from 'lucide-react';
import Logo from '../ui/Logo.jsx';
import { useApp } from '../../context/AppContext.jsx';

export const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/solver', label: 'Problem Solver', icon: MessageSquareText, primary: true },
  { to: '/live', label: 'Live AI', icon: AudioLines, badge: 'NEW' },
  { to: '/studio', label: 'Creative Studio', icon: Sparkles },
  { to: '/useful', label: 'Make Yourself Useful', icon: Lightbulb },
  { to: '/browser', label: 'Web Browser', icon: Globe },
  { to: '/history', label: 'History', icon: History },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const { settings, setPremiumOpen, mobileNavOpen, setMobileNavOpen, avatarUrl, status, statusError } = useApp();
  const navigate = useNavigate();
  const collapsed = settings.sidebarCollapsed;
  const online = !statusError && status;

  return (
    <>
      <div className={`nav-scrim ${mobileNavOpen ? 'show' : ''}`} onClick={() => setMobileNavOpen(false)} />
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileNavOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <button className="logo-btn" onClick={() => { navigate('/'); setMobileNavOpen(false); }} aria-label="Home">
            <Logo compact={collapsed} />
          </button>
          <button className="icon-btn mobile-only" onClick={() => setMobileNavOpen(false)} aria-label="Close menu"><X size={18} /></button>
        </div>

        <nav className="nav">
          {NAV.map(({ to, label, icon: Icon, end, badge, primary }) => (
            <NavLink key={to} to={to} end={end} title={label}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${primary ? 'nav-primary' : ''}`}
              onClick={() => setMobileNavOpen(false)}>
              <Icon size={22} strokeWidth={1.7} />
              <span className="nav-label">{label}</span>
              {badge && <span className="badge-new">{badge}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="premium-card">
          <div className="premium-stars" />
          <div className="premium-avatar">
            <span className="crown">👑</span>
            <img src="/assets/avatar-onion.jpg" alt="" />
          </div>
          <h4 className="premium-title">Go Premium</h4>
          <p>Unlock unlimited features &amp; more power!</p>
          <button className="btn btn-primary btn-sm" onClick={() => setPremiumOpen(true)}>Upgrade Now <ArrowRight size={16} /></button>
        </div>

        <button className="profile" onClick={() => { navigate('/settings'); setMobileNavOpen(false); }}>
          <img src={avatarUrl} alt="Profile" className="avatar" />
          <div className="profile-meta">
            <strong>{settings.name || 'Friend'}</strong>
            <span className={online ? 'online' : 'offline'}><i /> {online ? 'Online' : 'Offline'}</span>
          </div>
        </button>
      </aside>
    </>
  );
}
