import { useNavigate } from 'react-router-dom';
import { AudioLines, Plus, Volume2, VolumeX, Mic, Phone, Settings } from 'lucide-react';
import { useApp } from '../../context/AppContext.jsx';
import RobotPersona from '../live/RobotPersona.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import { LIVE_GREETING } from '../../lib/data.js';

export default function LivePanel() {
  const { settings, updateSettings, status, statusError } = useApp();
  const navigate = useNavigate();
  const online = status && !statusError;
  const ready = online && status.llm.configured;

  return (
    <aside className="live-panel">
      <div className="lp-head">
        <div className="lp-title"><AudioLines size={22} /> Live AI</div>
        <span className={`lp-status ${ready ? 'on' : online ? 'warn' : 'off'}`}><i /> {ready ? 'Online' : online ? 'Setup needed' : 'Offline'}</span>
      </div>

      <div className="lp-stage">
        <img src="/assets/hero-galaxy.jpg" alt="" className="lp-bg" />
        <button className="lp-persona" onClick={() => navigate('/live')} aria-label="Open Live AI">
          <RobotPersona size={220} compact state="idle" emotion="happy" />
        </button>
        <div className="lp-bubble glass">{LIVE_GREETING.replace('Welcome', '\nWelcome')}</div>
      </div>

      <div className="lp-controls glass">
        <button className="icon-btn" title="New conversation" onClick={() => navigate('/solver', { state: { fresh: Date.now() } })}><Plus size={21} /></button>
        <button className="icon-btn" title={settings.liveMuted ? 'Unmute AI voice' : 'Mute AI voice'} onClick={() => updateSettings({ liveMuted: !settings.liveMuted })}>
          {settings.liveMuted ? <VolumeX size={21} /> : <Volume2 size={21} />}
        </button>
        <button className="lp-mic" title="Talk to Live AI" onClick={() => navigate('/live', { state: { autoListen: true } })}><Mic size={24} /></button>
        <button className="lp-call" title="Start a live session" onClick={() => navigate('/live')}><Phone size={19} /></button>
        <button className="icon-btn" title="Voice settings" onClick={() => navigate('/settings#voice')}><Settings size={21} /></button>
      </div>

      <div className="lp-banner">
        <img src="/assets/banner-moon.jpg" alt="" />
        <div className="lp-banner-text">
          <h4>Dream Bigger.<span className="spark">✦</span><br />Solve Smarter.</h4>
          <p>With Asad Solvency</p>
        </div>
        <div className="lp-banner-logo"><LogoMark size={40} /></div>
      </div>
    </aside>
  );
}
