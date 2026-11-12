import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { UserRound, Brain, AudioLines, Palette, Database, PlugZap, CheckCircle2, XCircle, RefreshCw, Upload, Download, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext.jsx';
import { api } from '../api/client.js';
import { listBrowserVoices, voice, resolveEngine } from '../lib/voice.js';

const OPENAI_VOICES = ['nova', 'shimmer', 'coral', 'sage', 'alloy', 'ash', 'ballad', 'echo', 'fable', 'onyx'];
const LANGS = ['auto', 'English', 'Bangla', 'Hindi', 'Urdu', 'Arabic', 'Spanish', 'French', 'German'];

function Status({ ok, label, detail }) {
  return (
    <div className={`int-row ${ok ? 'ok' : 'no'}`}>
      {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
      <div><strong>{label}</strong><span className="tiny muted">{detail}</span></div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, status, statusError, refreshStatus, toast, refreshConversations, avatarUrl } = useApp();
  const { hash } = useLocation();
  const [voices, setVoices] = useState([]);
  const fileRef = useRef(null);

  useEffect(() => {
    const load = () => setVoices(listBrowserVoices());
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, []);
  useEffect(() => { if (hash) document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [hash]);

  const onAvatar = (f) => {
    if (!f) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 192;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
      updateSettings({ avatar: c.toDataURL('image/jpeg', 0.85) });
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(f);
  };

  const engine = resolveEngine(settings, status);
  const testVoice = () => { voice.unlock(); voice.speak(`Hi ${settings.name || 'there'}! This is my voice at ${settings.speechRate.toFixed(1)} times speed.`, { engine, openaiVoice: settings.openaiVoice, browserVoice: settings.browserVoice, rate: settings.speechRate, pitch: settings.speechPitch, onError: (e) => toast(e.message, 'error') }); };

  return (
    <div className="settings">
      <div className="page-head"><div><span className="eyebrow">Settings</span><h2>Make Asad Solvency yours</h2></div></div>

      <div className="settings-grid">
        <section className="set-card glass" id="profile">
          <h4><UserRound size={18} /> Profile</h4>
          <div className="row gap">
            <img src={avatarUrl} alt="" className="avatar xl" />
            <div className="col gap-sm">
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current?.click()}><Upload size={14} /> Change avatar</button>
              {settings.avatar && <button className="link-btn" onClick={() => updateSettings({ avatar: '' })}>Reset to onion 🧅</button>}
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onAvatar(e.target.files?.[0])} />
            </div>
          </div>
          <div className="form">
            <label>Your name<input value={settings.name} maxLength={40} onChange={(e) => updateSettings({ name: e.target.value })} /></label>
          </div>
        </section>

        <section className="set-card glass" id="ai">
          <h4><Brain size={18} /> AI behaviour</h4>
          <div className="form">
            <label>Response style
              <select value={settings.tone} onChange={(e) => updateSettings({ tone: e.target.value })}>
                <option value="balanced">Balanced — warm and direct</option>
                <option value="direct">Direct — straight to the point</option>
                <option value="gentle">Gentle — extra supportive</option>
                <option value="coach">Coach — push me to act</option>
              </select>
            </label>
            <label>Reply language
              <select value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}>
                {LANGS.map((l) => <option key={l} value={l}>{l === 'auto' ? 'Auto (match my language)' : l}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="set-card glass" id="voice">
          <h4><AudioLines size={18} /> Voice &amp; Live AI</h4>
          <div className="form">
            <label>Voice engine
              <select value={settings.voiceEngine} onChange={(e) => updateSettings({ voiceEngine: e.target.value })}>
                <option value="auto">Auto (neural if configured)</option>
                <option value="openai" disabled={!status?.voice?.tts}>Neural — OpenAI{!status?.voice?.tts ? ' (needs key)' : ''}</option>
                <option value="browser">Browser — free, built-in</option>
              </select>
            </label>
            {engine === 'openai' ? (
              <label>Neural voice
                <select value={settings.openaiVoice} onChange={(e) => updateSettings({ openaiVoice: e.target.value })}>
                  {OPENAI_VOICES.map((v) => <option key={v} value={v}>{v[0].toUpperCase() + v.slice(1)}</option>)}
                </select>
              </label>
            ) : (
              <label>Browser voice
                <select value={settings.browserVoice} onChange={(e) => updateSettings({ browserVoice: e.target.value })}>
                  <option value="">Auto-pick the most natural</option>
                  {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
              </label>
            )}
            <label>Speaking speed: {settings.speechRate.toFixed(2)}×<input type="range" min="0.6" max="1.6" step="0.05" value={settings.speechRate} onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })} /></label>
            <label className="check"><input type="checkbox" checked={settings.handsFree} onChange={(e) => updateSettings({ handsFree: e.target.checked })} /> Hands-free conversation (auto-listen after replies)</label>
            <label className="check"><input type="checkbox" checked={settings.liveMuted} onChange={(e) => updateSettings({ liveMuted: e.target.checked })} /> Mute AI voice (captions only)</label>
            <button className="btn btn-ghost btn-sm" onClick={testVoice}>▶ Test voice</button>
          </div>
        </section>

        <section className="set-card glass" id="appearance">
          <h4><Palette size={18} /> Appearance</h4>
          <div className="form">
            <label>Theme
              <div className="seg">
                <button className={settings.theme === 'dark' ? 'on' : ''} onClick={() => updateSettings({ theme: 'dark' })}>Midnight</button>
                <button className={settings.theme === 'light' ? 'on' : ''} onClick={() => updateSettings({ theme: 'light' })}>Light</button>
              </div>
            </label>
            <label>Live AI avatar
              <div className="seg">
                <button className={settings.personaMode === 'character' ? 'on' : ''} onClick={() => updateSettings({ personaMode: 'character' })}>Character</button>
                <button className={settings.personaMode !== 'character' ? 'on' : ''} onClick={() => updateSettings({ personaMode: 'robot' })}>Neon robot</button>
              </div>
            </label>
            <label className="check"><input type="checkbox" checked={settings.reduceMotion} onChange={(e) => updateSettings({ reduceMotion: e.target.checked })} /> Reduce motion &amp; animations</label>
            <label className="check"><input type="checkbox" checked={settings.showLivePanel} onChange={(e) => updateSettings({ showLivePanel: e.target.checked })} /> Show Live AI side panel</label>
            <label className="check"><input type="checkbox" checked={settings.sidebarCollapsed} onChange={(e) => updateSettings({ sidebarCollapsed: e.target.checked })} /> Compact sidebar</label>
          </div>
        </section>

        <section className="set-card glass wide" id="integrations">
          <div className="row between">
            <h4><PlugZap size={18} /> Integrations</h4>
            <button className="btn btn-ghost btn-xs" onClick={() => { refreshStatus(); toast('Status refreshed', 'success', 1500); }}><RefreshCw size={13} /> Re-check</button>
          </div>
          {statusError ? <Status ok={false} label="Backend server" detail={statusError} /> : !status ? <p className="muted">Checking…</p> : (
            <div className="int-grid">
              <Status ok label="Backend server" detail="Connected — API keys are kept server-side only." />
              <Status ok={status.llm.configured} label="Conversational AI" detail={status.llm.configured ? `${status.llm.model} via ${status.llm.provider}` : 'Set OPENAI_API_KEY or LLM_API_KEY in .env'} />
              <Status ok={status.images.configured} label="Image generation" detail={status.images.configured ? `${status.images.provider} · ${status.images.model}` : status.images.provider === 'stability' ? 'Set STABILITY_API_KEY in .env' : 'Set OPENAI_API_KEY in .env'} />
              <Status ok={status.voice.tts} label="Neural voice & Whisper STT" detail={status.voice.tts ? status.voice.ttsModel : 'Optional — browser voice is used instead'} />
              <Status ok={status.images.upscale4k} label="4K upscaling" detail={status.images.upscaleMode === 'ai' ? 'Stability AI conservative upscaler' : 'Built-in enlarger (no AI detail added). Add STABILITY_API_KEY for AI upscaling'} />
              <Status ok={!!(window.SpeechRecognition || window.webkitSpeechRecognition)} label="Browser speech recognition" detail={(window.SpeechRecognition || window.webkitSpeechRecognition) ? 'Available in this browser' : 'Not available — Whisper fallback used if configured'} />
            </div>
          )}
          <p className="tiny muted">Keys live in the <code>.env</code> file at the project root (copy <code>.env.example</code>). Restart the server after editing, then press Re-check.</p>
        </section>

        <section className="set-card glass wide" id="data">
          <h4><Database size={18} /> Your data</h4>
          <div className="row gap-sm wrap">
            <a className="btn btn-ghost btn-sm" href="/api/conversations/export" download><Download size={14} /> Export history (JSON)</a>
            <button className="btn btn-ghost btn-sm danger" onClick={async () => { if (!confirm('Delete all conversations?')) return; await api.clearConversations(); refreshConversations(); toast('History cleared', 'success'); }}><Trash2 size={14} /> Clear history</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { if (confirm('Reset all settings on this device?')) { localStorage.removeItem('asad.settings'); location.reload(); } }}>Reset settings</button>
          </div>
        </section>
      </div>
    </div>
  );
}
