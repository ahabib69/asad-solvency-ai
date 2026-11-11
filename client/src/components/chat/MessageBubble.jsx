import { useState } from 'react';
import { Copy, Check, RefreshCw, ThumbsUp, ThumbsDown, Volume2, Square, AlertTriangle } from 'lucide-react';
import StructuredMarkdown from './StructuredMarkdown.jsx';
import { LogoMark } from '../ui/Logo.jsx';
import { copyText } from '../../lib/format.js';
import { useApp } from '../../context/AppContext.jsx';
import { voice, resolveEngine } from '../../lib/voice.js';

export default function MessageBubble({ msg, isLast, streaming, onRegenerate, onFeedback }) {
  const { avatarUrl, settings, status, toast } = useApp();
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  if (msg.role === 'user') {
    return (
      <div className="msg msg-user">
        <div className="bubble-user">{msg.content}</div>
        <img src={avatarUrl} alt="" className="avatar sm" />
      </div>
    );
  }

  if (msg.error) {
    return (
      <div className="msg msg-ai">
        <div className="ai-avatar"><LogoMark size={26} /></div>
        <div className="bubble-ai error">
          <div className="err-line"><AlertTriangle size={18} /> <span>{msg.content}</span></div>
          {onRegenerate && <button className="btn btn-ghost btn-sm" onClick={onRegenerate}><RefreshCw size={14} /> Try again</button>}
        </div>
      </div>
    );
  }

  const speak = async () => {
    if (speaking) { voice.stop(); setSpeaking(false); return; }
    voice.unlock();
    setSpeaking(true);
    await voice.speak(msg.content, {
      engine: resolveEngine(settings, status), openaiVoice: settings.openaiVoice, browserVoice: settings.browserVoice,
      rate: settings.speechRate, pitch: settings.speechPitch, onError: (e) => toast('Voice: ' + e.message, 'error'),
    });
    setSpeaking(false);
  };

  return (
    <div className="msg msg-ai">
      <div className="ai-avatar"><LogoMark size={26} /></div>
      <div className="bubble-ai">
        {msg.content ? <StructuredMarkdown content={msg.content} streaming={streaming} /> : (
          <div className="thinking-dots" aria-label="Thinking"><span /><span /><span /><em>Analysing your situation…</em></div>
        )}
        {!streaming && msg.content && (
          <div className="msg-tools">
            <button className="tool" title="Copy" onClick={async () => { await copyText(msg.content); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check size={15} /> : <Copy size={15} />} <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            {isLast && onRegenerate && <button className="tool" title="Regenerate" onClick={onRegenerate}><RefreshCw size={15} /> <span>Regenerate</span></button>}
            <button className="tool" title={speaking ? 'Stop reading' : 'Read aloud'} onClick={speak}>{speaking ? <Square size={14} /> : <Volume2 size={15} />} <span>{speaking ? 'Stop' : 'Listen'}</span></button>
            {msg.id && onFeedback && (
              <>
                <button className={`tool ${msg.feedback === 'up' ? 'on' : ''}`} title="Helpful" onClick={() => onFeedback(msg, msg.feedback === 'up' ? null : 'up')}><ThumbsUp size={15} /></button>
                <button className={`tool ${msg.feedback === 'down' ? 'on down' : ''}`} title="Not helpful" onClick={() => onFeedback(msg, msg.feedback === 'down' ? null : 'down')}><ThumbsDown size={15} /></button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
