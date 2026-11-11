import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, MicOff, Square, Loader2 } from 'lucide-react';
import { useSpeechInput } from '../../hooks/useSpeechInput.js';
import { useApp } from '../../context/AppContext.jsx';

export default function Composer({ onSend, onStop, busy, placeholder, autoFocus, large, initialValue = '' }) {
  const { status, toast } = useApp();
  const [value, setValue] = useState(initialValue);
  const ta = useRef(null);
  const baseRef = useRef('');
  const speech = useSpeechInput({
    serverSTT: !!status?.voice?.stt,
    onInterim: (t) => setValue((baseRef.current + ' ' + t).trim()),
    onFinal: (t) => setValue((baseRef.current + ' ' + t).trim()),
    onError: (e) => toast(e.message, 'error'),
  });

  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, large ? 260 : 200) + 'px';
  }, [value, large]);

  useEffect(() => { if (autoFocus) ta.current?.focus(); }, [autoFocus]);

  const submit = () => {
    const v = value.trim();
    if (!v || busy) return;
    if (speech.listening) speech.stop();
    onSend(v);
    setValue('');
  };

  return (
    <div className={`composer glass ${large ? 'large' : ''} ${speech.listening ? 'is-listening' : ''}`}>
      <textarea
        ref={ta}
        rows={large ? 3 : 1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
        placeholder={placeholder || 'Tell me what\u2019s happening. No problem is too complicated to start discussing...'}
        aria-label="Message"
      />
      <div className="composer-actions">
        <span className="tiny muted composer-hint">{speech.listening ? 'Listening… speak now' : speech.transcribing ? 'Transcribing…' : 'Enter to send · Shift+Enter for new line'}</span>
        {speech.supported && (
          <button type="button" className={`icon-btn ${speech.listening ? 'rec' : ''}`} title={speech.listening ? 'Stop dictation' : 'Dictate with your voice'}
            onClick={() => { if (speech.listening) speech.stop(); else { baseRef.current = value; speech.start(); } }}>
            {speech.transcribing ? <Loader2 size={19} className="spin" /> : speech.listening ? <MicOff size={19} /> : <Mic size={19} />}
          </button>
        )}
        {busy ? (
          <button type="button" className="send-btn stop" onClick={onStop} title="Stop generating"><Square size={16} fill="currentColor" /></button>
        ) : (
          <button type="button" className="send-btn" onClick={submit} disabled={!value.trim()} title="Send"><ArrowUp size={20} /></button>
        )}
      </div>
    </div>
  );
}
