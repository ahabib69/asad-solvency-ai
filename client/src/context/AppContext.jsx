import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';

const DEFAULT_SETTINGS = {
  name: 'Asad',
  avatar: '',              // custom avatar data-URL ('' = onion default)
  tone: 'balanced',        // balanced | direct | gentle | coach
  language: 'auto',
  theme: 'dark',           // dark | light
  reduceMotion: false,
  personaMode: 'robot',    // character | robot (Live AI avatar)
  voiceEngine: 'auto',     // auto | openai | browser
  openaiVoice: 'nova',
  browserVoice: '',        // voiceURI
  speechRate: 1,
  speechPitch: 1,
  handsFree: true,         // auto-listen after the AI finishes speaking
  liveMuted: false,
  showLivePanel: true,
  sidebarCollapsed: false,
  usefulProfile: { interests: '', skills: '', time: '30 min', goal: '', energy: 'Medium' },
};

const DEFAULT_NOTIFICATIONS = [
  { id: 'n1', title: 'Live AI is here ✨', body: 'Talk face-to-face with your holographic AI companion.', to: '/live', read: false },
  { id: 'n2', title: 'Welcome to Asad Solvency', body: 'Every problem has a way forward. Start in the Problem Solver.', to: '/solver', read: false },
];

const AppCtx = createContext(null);
const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_SETTINGS, ...load('asad.settings', {}) }));
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [conversations, setConversations] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState(() => load('asad.notifications', DEFAULT_NOTIFICATIONS));
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const interacted = useRef(false);

  useEffect(() => { localStorage.setItem('asad.settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem('asad.notifications', JSON.stringify(notifications)); }, [notifications]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle('reduce-motion', !!settings.reduceMotion);
  }, [settings.theme, settings.reduceMotion]);
  useEffect(() => {
    const mark = () => { interacted.current = true; };
    window.addEventListener('pointerdown', mark, { once: true });
    window.addEventListener('keydown', mark, { once: true });
    return () => { window.removeEventListener('pointerdown', mark); window.removeEventListener('keydown', mark); };
  }, []);

  const updateSettings = useCallback((patch) => setSettings((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })), []);

  const toast = useCallback((message, type = 'info', ms = 4200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), ms);
  }, []);

  const refreshStatus = useCallback(async () => {
    try { setStatus(await api.status()); setStatusError(''); }
    catch (e) { setStatusError(e.message); }
  }, []);

  const refreshConversations = useCallback(async () => {
    try { setConversations(await api.conversations()); } catch { /* server offline handled by status */ }
  }, []);

  useEffect(() => { refreshStatus(); refreshConversations(); }, [refreshStatus, refreshConversations]);

  const value = useMemo(() => ({
    settings, updateSettings, status, statusError, refreshStatus,
    conversations, refreshConversations, setConversations,
    toasts, toast, dismissToast: (id) => setToasts((t) => t.filter((x) => x.id !== id)),
    notifications, setNotifications,
    premiumOpen, setPremiumOpen, mobileNavOpen, setMobileNavOpen,
    hasInteracted: () => interacted.current,
    avatarUrl: settings.avatar || '/assets/avatar-onion.jpg',
  }), [settings, updateSettings, status, statusError, refreshStatus, conversations, refreshConversations, toasts, toast, notifications, premiumOpen, mobileNavOpen]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export const useApp = () => useContext(AppCtx);
