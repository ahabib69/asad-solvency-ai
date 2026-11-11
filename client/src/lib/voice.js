// Unified text-to-speech engine with real-time "mouth level" output for lip-sync.
//  - "openai": server-side neural TTS (/api/tts) played through Web Audio; mouth driven by actual audio amplitude.
//  - "browser": Web Speech API speechSynthesis; mouth driven by word-boundary events + procedural motion.
import { api } from '../api/client.js';

const PREFERRED = [/natural/i, /neural/i, /google uk english female/i, /google us english/i, /samantha/i, /aria/i, /jenny/i, /zira/i];

export function listBrowserVoices() {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices();
}

export function pickBrowserVoice(uri, lang = 'en') {
  const voices = listBrowserVoices();
  if (uri) { const v = voices.find((x) => x.voiceURI === uri); if (v) return v; }
  const langVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  for (const re of PREFERRED) { const v = langVoices.find((x) => re.test(x.name)); if (v) return v; }
  return langVoices[0] || voices[0] || null;
}

function splitSentences(text) {
  const parts = text.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]*["')\]]*\s*/g) || [text];
  const out = [];
  let cur = '';
  for (const p of parts) {
    if ((cur + p).length > 220 && cur) { out.push(cur.trim()); cur = p; } else cur += p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

class VoiceEngine {
  constructor() {
    this.level = 0;
    this.speaking = false;
    this._pulse = 0;
    this._token = 0;
    this._audio = null;
    this._ctx = null;
    this._analyser = null;
    this._data = null;
    this._mode = null;
    this._abort = null;
  }

  /** Current mouth openness 0..1 (call every animation frame). */
  getLevel() {
    if (!this.speaking) { this.level *= 0.82; return this.level; }
    let target = 0;
    if (this._mode === 'openai' && this._analyser) {
      this._analyser.getByteTimeDomainData(this._data);
      let sum = 0;
      for (let i = 0; i < this._data.length; i++) { const v = (this._data[i] - 128) / 128; sum += v * v; }
      target = Math.min(1, Math.sqrt(sum / this._data.length) * 4.2);
    } else if (this._mode === 'browser') {
      const t = performance.now() / 1000;
      this._pulse *= 0.9;
      target = Math.min(1, 0.22 + 0.32 * Math.abs(Math.sin(t * 13.5)) * (0.6 + 0.4 * Math.sin(t * 3.1)) + this._pulse * 0.55);
    }
    this.level += (target - this.level) * 0.45;
    return this.level;
  }

  _ensureAudioGraph() {
    if (this._audio) return;
    this._audio = new Audio();
    this._audio.crossOrigin = 'anonymous';
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._ctx = new Ctx();
      const src = this._ctx.createMediaElementSource(this._audio);
      this._analyser = this._ctx.createAnalyser();
      this._analyser.fftSize = 1024;
      this._data = new Uint8Array(this._analyser.fftSize);
      src.connect(this._analyser);
      this._analyser.connect(this._ctx.destination);
    } catch { /* analyser unavailable: mouth falls back to procedural */ }
  }

  /** Unlock audio on a user gesture (call from click handlers). */
  unlock() {
    this._ensureAudioGraph();
    this._ctx?.resume?.();
    if ('speechSynthesis' in window) { try { window.speechSynthesis.resume(); } catch {} }
  }

  stop() {
    this._token++;
    this._abort?.abort();
    if (this._audio) { this._audio.pause(); this._audio.removeAttribute('src'); }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this.speaking = false;
  }

  /**
   * Speak text. opts: { engine: 'openai'|'browser', openaiVoice, browserVoice, rate, pitch, lang, onStart, onEnd, onError }
   * Resolves when speech finishes (or is interrupted).
   */
  async speak(text, opts = {}) {
    this.stop();
    const token = ++this._token;
    const clean = String(text).replace(/[*#_`>]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').trim();
    if (!clean) return;
    if (opts.engine === 'openai') {
      try { await this._speakOpenAI(clean, opts, token); return; }
      catch (e) {
        if (e.name === 'AbortError' || token !== this._token) return;
        opts.onError?.(e, 'openai');
        // graceful fallback to the browser voice
      }
    }
    await this._speakBrowser(clean, opts, token);
  }

  async _speakOpenAI(text, opts, token) {
    this._ensureAudioGraph();
    await this._ctx?.resume?.();
    this._abort = new AbortController();
    const res = await api.tts(text, opts.openaiVoice, opts.rate, this._abort.signal);
    const blob = await res.blob();
    if (token !== this._token) return;
    const url = URL.createObjectURL(blob);
    this._mode = 'openai';
    await new Promise((resolve, reject) => {
      const a = this._audio;
      a.onplay = () => { this.speaking = true; opts.onStart?.(); };
      a.onended = () => { this.speaking = false; URL.revokeObjectURL(url); opts.onEnd?.(); resolve(); };
      a.onerror = () => { this.speaking = false; reject(new Error('Audio playback failed')); };
      a.onpause = () => { if (token !== this._token) { this.speaking = false; resolve(); } };
      a.src = url;
      a.play().catch(reject);
    });
  }

  _speakBrowser(text, opts, token) {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) { opts.onError?.(new Error('This browser has no speech synthesis.'), 'browser'); resolve(); return; }
      const synth = window.speechSynthesis;
      const voice = pickBrowserVoice(opts.browserVoice, (opts.lang || 'en').slice(0, 2));
      const chunks = splitSentences(text);
      this._mode = 'browser';
      let i = 0;
      let started = false;
      const next = () => {
        if (token !== this._token) { this.speaking = false; resolve(); return; }
        if (i >= chunks.length) { this.speaking = false; opts.onEnd?.(); resolve(); return; }
        const u = new SpeechSynthesisUtterance(chunks[i++]);
        if (voice) { u.voice = voice; u.lang = voice.lang; }
        u.rate = Math.min(2, Math.max(0.5, opts.rate || 1));
        u.pitch = Math.min(2, Math.max(0, opts.pitch || 1));
        u.onstart = () => { this.speaking = true; if (!started) { started = true; opts.onStart?.(); } };
        u.onboundary = () => { this._pulse = 1; };
        u.onend = next;
        u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') opts.onError?.(new Error(e.error), 'browser'); next(); };
        synth.speak(u);
      };
      next();
    });
  }
}

export const voice = new VoiceEngine();

export function resolveEngine(settings, status) {
  if (settings.voiceEngine === 'browser') return 'browser';
  if (settings.voiceEngine === 'openai') return status?.voice?.tts ? 'openai' : 'browser';
  return status?.voice?.tts ? 'openai' : 'browser';
}
