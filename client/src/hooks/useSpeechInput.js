// Real microphone input:
//  - "browser": Web Speech API (Chrome, Edge, Safari) with live interim transcripts.
//  - "server":  MediaRecorder + voice-activity detection -> /api/transcribe (Whisper). Works in Firefox.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';

const SR = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;

export function useSpeechInput({ serverSTT = false, lang = 'en-US', onFinal, onInterim, onError } = {}) {
  const mode = SR ? 'browser' : serverSTT && typeof MediaRecorder !== 'undefined' ? 'server' : 'none';
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const levelRef = useRef(0);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(0);
  const cbs = useRef({ onFinal, onInterim, onError });
  cbs.current = { onFinal, onInterim, onError };

  const stopMeter = () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    levelRef.current = 0;
  };

  const startMeter = async (onTick) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      const data = new Uint8Array(an.fftSize);
      const loop = () => {
        an.getByteTimeDomainData(data);
        let s = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; s += v * v; }
        const lvl = Math.min(1, Math.sqrt(s / data.length) * 5);
        levelRef.current += (lvl - levelRef.current) * 0.35;
        onTick?.(levelRef.current);
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
      const origStop = stream.getTracks()[0].stop.bind(stream.getTracks()[0]);
      stream.getTracks()[0].stop = () => { origStop(); ctx.close().catch(() => {}); };
      return stream;
    } catch (e) {
      throw new Error(e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow mic access in your browser to talk.' : 'No microphone available: ' + e.message);
    }
  };

  const stop = useCallback(() => {
    if (mode === 'browser') { try { recRef.current?.stop(); } catch {} }
    if (mode === 'server') { try { if (recRef.current?.state === 'recording') recRef.current.stop(); } catch {} }
    if (mode !== 'server') stopMeter();
  }, [mode]);

  const start = useCallback(async () => {
    if (listening) return;
    if (mode === 'none') {
      cbs.current.onError?.(new Error('Voice input is not supported in this browser. Use Chrome/Edge, or add OPENAI_API_KEY for server speech-to-text.'));
      return;
    }
    if (mode === 'browser') {
      const rec = new SR();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = '';
      rec.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
        }
        cbs.current.onInterim?.((finalText + ' ' + interim).trim());
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        cbs.current.onError?.(new Error(e.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Speech recognition error: ' + e.error));
      };
      rec.onend = () => {
        setListening(false);
        stopMeter();
        if (finalText.trim()) cbs.current.onFinal?.(finalText.trim());
        else cbs.current.onInterim?.('');
      };
      recRef.current = rec;
      try {
        rec.start();
        setListening(true);
        startMeter().catch(() => {}); // level meter is cosmetic
      } catch (e) { cbs.current.onError?.(e); }
      return;
    }
    // server mode: record + VAD
    try {
      let heard = false, silenceSince = 0;
      const startedAt = performance.now();
      const stream = await startMeter((lvl) => {
        const t = performance.now();
        if (lvl > 0.12) { heard = true; silenceSince = 0; }
        else if (heard) { silenceSince ||= t; if (t - silenceSince > 1400) stop(); }
        if (t - startedAt > 30000 || (!heard && t - startedAt > 8000)) stop();
      });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        setListening(false);
        stopMeter();
        if (!heard) { cbs.current.onInterim?.(''); return; }
        setTranscribing(true);
        try {
          const { text } = await api.transcribe(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), lang.slice(0, 2));
          if (text) cbs.current.onFinal?.(text);
        } catch (e) { cbs.current.onError?.(e); }
        finally { setTranscribing(false); }
      };
      recRef.current = rec;
      rec.start(250);
      setListening(true);
    } catch (e) { cbs.current.onError?.(e); setListening(false); }
  }, [listening, mode, lang, stop]);

  useEffect(() => () => { try { recRef.current?.abort?.(); recRef.current?.stop?.(); } catch {} stopMeter(); }, []);

  return { mode, supported: mode !== 'none', listening, transcribing, start, stop, levelRef };
}
