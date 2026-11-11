import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mic, MicOff, Volume2, VolumeX, Keyboard, MessagesSquare, Settings2, PhoneOff, SendHorizontal, X, Loader2, Sparkles } from 'lucide-react';
import RobotPersona from '../components/live/RobotPersona.jsx';
import ParticleField from '../components/live/ParticleField.jsx';
import ConfigNotice from '../components/ui/ConfigNotice.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useSpeechInput } from '../hooks/useSpeechInput.js';
import { voice, resolveEngine, listBrowserVoices } from '../lib/voice.js';
import { api } from '../api/client.js';
import { LIVE_GREETING } from '../lib/data.js';

const OPENAI_VOICES = ['nova', 'shimmer', 'coral', 'sage', 'alloy', 'ash', 'ballad', 'echo', 'fable', 'onyx'];
const STATE_LABEL = { idle: 'Ready', listening: 'Listening…', thinking: 'Thinking…', speaking: 'Speaking' };
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

function usePersonaSize() {
  const calc = () => Math.round(Math.max(220, Math.min(470, window.innerHeight * 0.48, window.innerWidth * 0.82)));
  const [size, setSize] = useState(calc);
  useEffect(() => { const r = () => setSize(calc()); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  return size;
}

export default function LiveAI() {
  const { settings, updateSettings, status, toast, hasInteracted, refreshConversations } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const size = usePersonaSize();

  const [needsTap, setNeedsTap] = useState(() => !hasInteracted());
  const [visible, setVisible] = useState(false);
  const [materialized, setMaterialized] = useState(false);
  const [state, setState] = useState('idle');
  const [emotion, setEmotion] = useState('calm');
  const [caption, setCaption] = useState('');
  const [interim, setInterim] = useState('');
  const [transcript, setTranscript] = useState([]);
  const [showText, setShowText] = useState(false);
  const [text, setText] = useState('');
  const [drawer, setDrawer] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [browserVoices, setBrowserVoices] = useState([]);

  const convRef = useRef(null);
  const voiceErrRef = useRef('');
  const endedRef = useRef(false);
  const attractRef = useRef(0);
  const settingsRef = useRef(settings); settingsRef.current = settings;
  const statusRef = useRef(status); statusRef.current = status;
  const handleUserRef = useRef(() => {});
  const timers = useRef([]);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const speech = useSpeechInput({
    serverSTT: !!status?.voice?.stt,
    lang: settings.language && settings.language !== 'auto' ? settings.language : navigator.language || 'en-US',
    onInterim: (t) => setInterim(t),
    onFinal: (t) => handleUserRef.current(t),
    onError: (e) => { toast(e.message, 'error', 6000); setState('idle'); },
  });
  const speechRef = useRef(speech); speechRef.current = speech;

  useEffect(() => { setState((s) => (speech.listening ? 'listening' : s === 'listening' ? (speech.transcribing ? 'thinking' : 'idle') : s)); }, [speech.listening, speech.transcribing]);
  useEffect(() => { attractRef.current = state === 'listening' ? 1 : state === 'thinking' ? 0.4 : 0; }, [state]);

  const maybeListen = useCallback(() => {
    if (endedRef.current || !settingsRef.current.handsFree || !speechRef.current.supported) return;
    later(() => { if (!endedRef.current) speechRef.current.start(); }, 380);
  }, []);

  const speak = useCallback(async (line, emo) => {
    setEmotion(emo || 'calm');
    setCaption(line);
    const s = settingsRef.current;
    if (s.liveMuted) { setState('idle'); maybeListen(); return; }
    setState('speaking');
    await voice.speak(line, {
      engine: resolveEngine(s, statusRef.current),
      openaiVoice: s.openaiVoice, browserVoice: s.browserVoice, rate: s.speechRate, pitch: s.speechPitch,
      lang: s.language !== 'auto' ? s.language : navigator.language,
      onError: (e, src) => {
        const key = src + e.message;
        if (voiceErrRef.current === key) return; // only warn once per problem
        voiceErrRef.current = key;
        toast(src === 'openai' ? 'Neural voice unavailable, using browser voice: ' + e.message : 'Browser voice failed (' + e.message + '). Check your system voices or switch to the neural voice.', 'info', 5000);
      },
    });
    if (endedRef.current) return;
    setState((st) => (st === 'speaking' ? 'idle' : st));
    maybeListen();
  }, [maybeListen, toast]);

  handleUserRef.current = async (raw) => {
    const said = raw.trim();
    setInterim('');
    if (!said || endedRef.current) return;
    voice.stop();
    setTranscript((t) => [...t, { role: 'user', text: said }]);
    setState('thinking');
    setEmotion('thinking');
    setCaption('');
    if (statusRef.current && !statusRef.current.llm.configured) {
      const msg = "I can hear you, but my AI brain isn't connected yet. Please add your API key to the dot env file and restart the server. Then I'll be able to really help.";
      setTranscript((t) => [...t, { role: 'ai', text: msg, emotion: 'concerned' }]);
      speak(msg, 'concerned');
      return;
    }
    try {
      const s = settingsRef.current;
      const r = await api.live({ conversationId: convRef.current, message: said, settings: { name: s.name, tone: s.tone, language: s.language } });
      if (endedRef.current) return;
      convRef.current = r.conversationId;
      setTranscript((t) => [...t, { role: 'ai', text: r.reply, emotion: r.emotion }]);
      speak(r.reply, r.emotion);
    } catch (e) {
      if (endedRef.current) return;
      setState('idle');
      setEmotion('concerned');
      setCaption(e.message);
      toast(e.message, 'error', 6500);
    }
  };

  const begin = useCallback(() => {
    voice.unlock();
    setNeedsTap(false);
    later(() => setVisible(true), 30);
    later(() => setMaterialized(true), 650);
    later(() => {
      setTranscript([{ role: 'ai', text: LIVE_GREETING, emotion: 'happy' }]);
      speak(LIVE_GREETING, 'happy').then(() => {
        if (location.state?.autoListen && !settingsRef.current.handsFree && !endedRef.current) speechRef.current.start();
      });
    }, 1700);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

  useEffect(() => {
    endedRef.current = false;
    if (!needsTap) begin();
    const tick = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => {
      endedRef.current = true;
      clearInterval(tick);
      timers.current.forEach(clearTimeout);
      timers.current = [];
      voice.stop();
      speechRef.current.stop();
      refreshConversations();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const load = () => setBrowserVoices(listBrowserVoices());
    load();
    window.speechSynthesis?.addEventListener?.('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener?.('voiceschanged', load);
  }, []);

  const end = () => {
    endedRef.current = true;
    voice.stop();
    speech.stop();
    setExiting(true);
    setTimeout(() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/')), 420);
  };

  const toggleMic = () => {
    voice.unlock();
    if (speech.listening) { speech.stop(); return; }
    if (state === 'speaking') voice.stop(); // barge-in
    if (state === 'thinking') return;
    speech.start();
  };

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input, textarea, select')) return;
      if (e.code === 'Space') { e.preventDefault(); toggleMic(); }
      if (e.key === 'Escape') { if (drawer) setDrawer(null); else end(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sendText = () => {
    const t = text.trim();
    if (!t || state === 'thinking') return;
    setText('');
    handleUserRef.current(t);
  };

  const engine = resolveEngine(settings, status);
  const notConfigured = status && !status.llm.configured;

  return (
    <div className={`live ${visible ? 'in' : ''} ${exiting ? 'out' : ''}`}>
      <div className="live-bg" />
      <ParticleField attractRef={attractRef} />

      <header className="live-top">
        <button className="icon-btn" onClick={end} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="live-brand"><Sparkles size={16} /> LIVE AI <span className="muted">· Asad Solvency</span></div>
        <div className="row gap-sm">
          <span className={`state-chip st-${state}`}><i />{STATE_LABEL[state]}</span>
          <span className="timer">{fmt(elapsed)}</span>
        </div>
      </header>

      {notConfigured && <div className="live-notice"><ConfigNotice compact title="AI brain not connected">Voice and the avatar work, but replies need <code>OPENAI_API_KEY</code> (or <code>LLM_API_KEY</code>) in <code>.env</code>. </ConfigNotice></div>}

      <div className="live-stage">
        <RobotPersona size={size} state={state} emotion={emotion} materialize={materialized}
          getLevel={() => voice.getLevel()} getMicLevel={() => speech.levelRef.current} />
        {!materialized && !needsTap && <div className="materializing">Initialising companion…</div>}
      </div>

      <div className="live-captions" aria-live="polite">
        {interim ? <p className="cap-user">“{interim}”</p>
          : state === 'thinking' ? <p className="cap-thinking"><Loader2 size={16} className="spin" /> {speech.transcribing ? 'Transcribing…' : 'Thinking about that…'}</p>
          : caption ? <p className="cap-ai">{caption}</p> : null}
      </div>

      {showText && (
        <div className="live-text glass">
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendText()} placeholder="Type to your companion…" />
          <button className="send-btn" onClick={sendText} disabled={!text.trim()}><SendHorizontal size={18} /></button>
        </div>
      )}

      <div className="live-dock">
        <button className={`dock-btn ${settings.liveMuted ? 'on' : ''}`} onClick={() => { updateSettings({ liveMuted: !settings.liveMuted }); if (!settings.liveMuted) voice.stop(); }} title={settings.liveMuted ? 'Unmute voice' : 'Mute voice'}>
          {settings.liveMuted ? <VolumeX size={22} /> : <Volume2 size={22} />}<span>{settings.liveMuted ? 'Muted' : 'Voice'}</span>
        </button>
        <button className={`dock-btn ${showText ? 'on' : ''}`} onClick={() => setShowText((v) => !v)} title="Type instead"><Keyboard size={22} /><span>Type</span></button>
        <button className={`mic-btn ${state}`} onClick={toggleMic} disabled={!speech.supported} title={speech.supported ? 'Tap to talk (Space)' : 'Voice input unsupported in this browser'}>
          <span className="mic-wave" />
          {speech.listening ? <MicOff size={30} /> : <Mic size={30} />}
        </button>
        <button className={`dock-btn ${drawer === 'history' ? 'on' : ''}`} onClick={() => setDrawer(drawer === 'history' ? null : 'history')} title="Transcript"><MessagesSquare size={22} /><span>Transcript</span></button>
        <button className={`dock-btn ${drawer === 'settings' ? 'on' : ''}`} onClick={() => setDrawer(drawer === 'settings' ? null : 'settings')} title="Voice settings"><Settings2 size={22} /><span>Voice</span></button>
        <button className="end-btn" onClick={end} title="End session (Esc)"><PhoneOff size={22} /></button>
      </div>
      <p className="live-hint tiny muted">
        {speech.supported ? `Tap the mic or press Space to talk · ${speech.mode === 'browser' ? 'Browser speech recognition' : 'Whisper transcription'} · ${engine === 'openai' ? 'Neural voice' : 'Browser voice'}` : 'Voice input needs Chrome/Edge or an OpenAI key — you can still type.'}
      </p>

      <aside className={`live-drawer glass ${drawer ? 'open' : ''}`}>
        <div className="drawer-head">
          <strong>{drawer === 'settings' ? 'Voice & conversation' : 'Conversation transcript'}</strong>
          <button className="icon-btn" onClick={() => setDrawer(null)}><X size={18} /></button>
        </div>
        {drawer === 'history' && (
          <div className="transcript">
            {transcript.length === 0 && <p className="muted tiny">Nothing yet.</p>}
            {transcript.map((t, i) => (
              <div key={i} className={`tr tr-${t.role}`}><span>{t.role === 'ai' ? 'AI' : settings.name || 'You'}</span><p>{t.text}</p></div>
            ))}
            {convRef.current && <button className="btn btn-ghost btn-sm w-full" onClick={() => navigate(`/solver/${convRef.current}`)}>Continue in Problem Solver →</button>}
          </div>
        )}
        {drawer === 'settings' && (
          <div className="form">
            <label>Voice engine
              <select value={settings.voiceEngine} onChange={(e) => updateSettings({ voiceEngine: e.target.value })}>
                <option value="auto">Auto (best available)</option>
                <option value="openai" disabled={!status?.voice?.tts}>Neural (OpenAI){!status?.voice?.tts ? ' — needs key' : ''}</option>
                <option value="browser">Browser (free, offline)</option>
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
                  {browserVoices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                </select>
              </label>
            )}
            <label>Speaking speed: {settings.speechRate.toFixed(2)}×
              <input type="range" min="0.6" max="1.6" step="0.05" value={settings.speechRate} onChange={(e) => updateSettings({ speechRate: Number(e.target.value) })} />
            </label>
            {engine === 'browser' && (
              <label>Pitch: {settings.speechPitch.toFixed(2)}
                <input type="range" min="0.6" max="1.4" step="0.05" value={settings.speechPitch} onChange={(e) => updateSettings({ speechPitch: Number(e.target.value) })} />
              </label>
            )}
            <label className="check"><input type="checkbox" checked={settings.handsFree} onChange={(e) => updateSettings({ handsFree: e.target.checked })} /> Hands-free: listen automatically after the AI speaks</label>
            <button className="btn btn-ghost btn-sm" onClick={() => speak("This is how I sound. I'm here whenever you need me.", 'happy')}>▶ Test voice</button>
          </div>
        )}
      </aside>

      {needsTap && (
        <div className="tap-start">
          <button className="btn btn-primary btn-lg" onClick={begin}><Mic size={20} /> Start Live session</button>
          <p className="muted tiny">Your browser needs a tap before audio can play.</p>
        </div>
      )}
    </div>
  );
}
