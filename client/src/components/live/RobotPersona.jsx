import { useEffect, useId, useRef } from 'react';

/**
 * Original holographic robotic companion ("SOL").
 * Pure SVG + requestAnimationFrame — no external avatar service needed.
 * Props:
 *   state:   'idle' | 'listening' | 'thinking' | 'speaking'
 *   emotion: 'happy' | 'curious' | 'concerned' | 'thinking' | 'excited' | 'calm' | 'empathetic'
 *   getLevel():    0..1 mouth openness (real audio amplitude while speaking)
 *   getMicLevel(): 0..1 microphone level while listening
 */
const SMILE = { happy: 1, excited: 1.25, calm: 0.45, concerned: -0.55, empathetic: 0.15, curious: 0.3, thinking: -0.05 };
const BARS = 11;

export default function RobotPersona({ size = 420, state = 'idle', emotion = 'calm', getLevel, getMicLevel, compact = false, materialize = false }) {
  const uid = useId().replace(/:/g, '');
  const wrapRef = useRef(null);
  const headRef = useRef(null);
  const faceRef = useRef(null);
  const eyeLRef = useRef(null);
  const eyeRRef = useRef(null);
  const pupilLRef = useRef(null);
  const pupilRRef = useRef(null);
  const barsRef = useRef([]);
  const ringRef = useRef(null);
  const glowRef = useRef(null);
  const props = useRef({ state, emotion, getLevel, getMicLevel });
  props.current = { state, emotion, getLevel, getMicLevel };

  useEffect(() => {
    const reduce = document.documentElement.classList.contains('reduce-motion');
    const pointer = { x: 0, y: 0, last: 0 };
    const onMove = (e) => {
      const r = wrapRef.current?.getBoundingClientRect();
      if (!r) return;
      pointer.x = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
      pointer.y = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
      pointer.last = performance.now();
    };
    window.addEventListener('pointermove', onMove);

    const s = { rx: 0, ry: 0, rz: 0, lx: 0, ly: 0, blink: 1, nextBlink: performance.now() + 2000, blinkStart: 0, smile: 0, ring: 0 };
    let raf;
    const loop = (t) => {
      const { state: st, emotion: emo, getLevel: gl, getMicLevel: gm } = props.current;
      const idle = t - pointer.last > 4000;
      // Where to look
      let tx = idle ? Math.sin(t / 2600) * 0.35 : pointer.x;
      let ty = idle ? Math.sin(t / 3400) * 0.2 : pointer.y;
      let tz = 0;
      if (st === 'thinking') { tx = 0.55 + Math.sin(t / 500) * 0.12; ty = -0.55; tz = 5; }
      if (st === 'listening') { tx *= 0.4; ty = ty * 0.4 + 0.05; tz = -4; }
      if (emo === 'curious' && st !== 'thinking') tz = 7;
      if (emo === 'empathetic' || emo === 'concerned') tz = tz || -3;
      const sway = reduce ? 0 : 1;
      const tRy = tx * 16 + Math.sin(t / 1900) * 2.5 * sway;
      const tRx = -ty * 10 + Math.sin(t / 2500) * 1.6 * sway;
      s.ry += (tRy - s.ry) * 0.06; s.rx += (tRx - s.rx) * 0.06; s.rz += (tz - s.rz) * 0.05;
      s.lx += (tx - s.lx) * 0.12; s.ly += (ty - s.ly) * 0.12;
      const float = reduce ? 0 : Math.sin(t / 1400) * 5;

      if (wrapRef.current) wrapRef.current.style.transform = `perspective(1100px) rotateY(${s.ry}deg) rotateX(${s.rx}deg) translateY(${float}px)`;
      if (headRef.current) headRef.current.setAttribute('transform', `rotate(${s.rz} 200 300) translate(${s.ry * 0.35} ${-s.rx * 0.3})`);
      if (faceRef.current) faceRef.current.setAttribute('transform', `translate(${s.lx * 9 + s.ry * 0.25} ${s.ly * 6})`);
      const px = s.lx * 6, py = s.ly * 4;
      pupilLRef.current?.setAttribute('transform', `translate(${px} ${py})`);
      pupilRRef.current?.setAttribute('transform', `translate(${px} ${py})`);

      // Blinking
      if (t > s.nextBlink) { s.blinkStart = t; s.nextBlink = t + 2200 + Math.random() * 3800; }
      const bp = (t - s.blinkStart) / 170;
      let blink = bp >= 0 && bp < 1 ? Math.abs(1 - bp * 2) : 1;
      let eyeScale = st === 'listening' ? 1.12 : st === 'thinking' ? 0.78 : 1;
      if (emo === 'excited') eyeScale *= 1.1;
      const sy = Math.max(0.08, blink) * eyeScale;
      eyeLRef.current?.setAttribute('transform', `scale(1 ${sy})`);
      eyeRRef.current?.setAttribute('transform', `scale(${emo === 'curious' ? 1.06 : 1} ${sy * (emo === 'curious' ? 1.12 : 1)})`);

      // Mouth (lip-sync bars)
      const lvl = st === 'speaking' && gl ? gl() : (gl ? gl() * 0.6 : 0);
      s.smile += ((SMILE[emo] ?? 0.3) - s.smile) * 0.08;
      for (let i = 0; i < BARS; i++) {
        const el = barsRef.current[i];
        if (!el) continue;
        const dx = (i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const env = Math.pow(Math.cos((dx * Math.PI) / 2), 0.8);
        const jitter = 0.62 + 0.38 * Math.sin(t * 0.021 + i * 1.7);
        const h = 3.2 + lvl * 30 * env * jitter;
        const yOff = -s.smile * dx * dx * 9;
        el.setAttribute('height', h.toFixed(2));
        el.setAttribute('y', (246 + yOff - h / 2).toFixed(2));
        el.setAttribute('opacity', (0.55 + Math.min(0.45, lvl * 0.8 + env * 0.2)).toFixed(2));
      }

      // Listening ripple + speaking glow
      const mic = st === 'listening' && gm ? gm() : 0;
      s.ring += ((st === 'listening' ? 1 + mic * 0.35 : st === 'speaking' ? 1 + lvl * 0.08 : 0.94) - s.ring) * 0.15;
      if (ringRef.current) {
        ringRef.current.style.transform = `scale(${s.ring})`;
        ringRef.current.style.opacity = st === 'listening' ? 0.5 + mic * 0.5 : st === 'speaking' ? 0.35 + lvl * 0.5 : 0.18;
      }
      if (glowRef.current) glowRef.current.setAttribute('opacity', (0.55 + (st === 'speaking' ? lvl * 0.45 : st === 'listening' ? mic * 0.4 : 0.1 * Math.sin(t / 800))).toFixed(2));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); };
  }, []);

  const g = (n) => `${n}-${uid}`;

  return (
    <div className={`persona st-${state} emo-${emotion} ${compact ? 'compact' : ''} ${materialize ? 'materialize' : ''}`} style={{ width: size, height: size * 1.12 }}>
      <div className="persona-ring" ref={ringRef} />
      <div className="persona-orbit"><i /><i /><i /></div>
      <div className="persona-3d" ref={wrapRef}>
        <svg viewBox="0 0 400 460" width="100%" height="100%" role="img" aria-label={`AI companion, ${state}`}>
          <defs>
            <linearGradient id={g('metal')} x1="0.2" y1="0" x2="0.8" y2="1">
              <stop offset="0" stopColor="#f4f7ff" />
              <stop offset="0.32" stopColor="#c3cde3" />
              <stop offset="0.68" stopColor="#66749a" />
              <stop offset="1" stopColor="#1d2340" />
            </linearGradient>
            <radialGradient id={g('sheen')} cx="0.32" cy="0.22" r="0.7">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.75" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.06" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={g('violetEdge')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.55" stopColor="#8B5CF6" stopOpacity="0" />
              <stop offset="1" stopColor="#8B5CF6" stopOpacity="0.55" />
            </linearGradient>
            <linearGradient id={g('cyanEdge')} x1="1" y1="0" x2="0" y2="0">
              <stop offset="0.6" stopColor="#22d3ee" stopOpacity="0" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0.45" />
            </linearGradient>
            <radialGradient id={g('visor')} cx="0.5" cy="0.42" r="0.65">
              <stop offset="0" stopColor="#13234d" />
              <stop offset="0.6" stopColor="#081028" />
              <stop offset="1" stopColor="#03060f" />
            </radialGradient>
            <radialGradient id={g('eye')} cx="0.5" cy="0.45" r="0.6">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.35" stopColor="#a5f3fc" />
              <stop offset="0.8" stopColor="#22d3ee" />
              <stop offset="1" stopColor="#0284c7" />
            </radialGradient>
            <radialGradient id={g('core')} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#f5d0fe" />
              <stop offset="0.4" stopColor="#a78bfa" />
              <stop offset="1" stopColor="#7c3aed" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={g('aura')} cx="0.5" cy="0.45" r="0.5">
              <stop offset="0" stopColor="#22d3ee" stopOpacity="0.35" />
              <stop offset="0.5" stopColor="#3B82F6" stopOpacity="0.12" />
              <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
            </radialGradient>
            <filter id={g('glow')} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id={g('soft')} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6" /></filter>
            {[['L', 42], ['R', -42]].map(([k, cx]) => (
              <radialGradient key={k} id={g('lid' + k)} gradientUnits="userSpaceOnUse" cx={cx} cy="-9" r="120">
                <stop offset="0" stopColor="#13234d" />
                <stop offset="0.6" stopColor="#081028" />
                <stop offset="1" stopColor="#03060f" />
              </radialGradient>
            ))}
            <clipPath id={g('visorClip')}>
              <path d="M200 118 C 268 118 298 146 298 192 C 298 240 270 272 200 272 C 130 272 102 240 102 192 C 102 146 132 118 200 118 Z" />
            </clipPath>
          </defs>

          <ellipse cx="200" cy="210" rx="190" ry="200" fill={`url(#${g('aura')})`} ref={glowRef} />

          {/* Holographic floor ring */}
          {!compact && (
            <g className="floor-ring" opacity="0.8">
              <ellipse cx="200" cy="448" rx="150" ry="12" fill="none" stroke="#22d3ee" strokeOpacity="0.5" strokeWidth="1.5" strokeDasharray="6 10" />
              <ellipse cx="200" cy="448" rx="110" ry="8" fill="none" stroke="#8B5CF6" strokeOpacity="0.5" strokeWidth="1" />
            </g>
          )}

          {/* Shoulders / upper body */}
          <g className="body">
            <path d="M34 460 C 44 392 106 362 162 352 L238 352 C 294 362 356 392 366 460 Z" fill={`url(#${g('metal')})`} opacity="0.92" />
            <path d="M34 460 C 44 392 106 362 162 352 L238 352 C 294 362 356 392 366 460 Z" fill={`url(#${g('violetEdge')})`} />
            <path d="M34 460 C 44 392 106 362 162 352 L238 352 C 294 362 356 392 366 460 Z" fill={`url(#${g('cyanEdge')})`} />
            <path d="M120 372 C 150 400 160 430 158 460 M280 372 C 250 400 240 430 242 460" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="1.4" fill="none" />
            <path d="M162 352 C 175 380 225 380 238 352" stroke="#22d3ee" strokeOpacity="0.7" strokeWidth="2" fill="none" filter={`url(#${g('glow')})`} />
            <circle cx="200" cy="418" r="26" fill={`url(#${g('core')})`} className="chest-core" />
            <circle cx="200" cy="418" r="9" fill="#f0e7ff" opacity="0.9" filter={`url(#${g('glow')})`} />
          </g>

          {/* Neck */}
          <g>
            <rect x="170" y="300" width="60" height="60" rx="12" fill="#151a30" />
            {[316, 330, 344].map((y) => <rect key={y} x="176" y={y} width="48" height="3" rx="1.5" fill="#22d3ee" opacity="0.55" />)}
          </g>

          {/* Head */}
          <g ref={headRef}>
            {/* ear pods */}
            {[80, 320].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy="196" r="26" fill={`url(#${g('metal')})`} />
                <circle cx={cx} cy="196" r="15" fill="#0a1024" />
                <circle cx={cx} cy="196" r="11" fill="none" stroke="#22d3ee" strokeWidth="2.5" strokeDasharray="10 6" className="ear-spin" filter={`url(#${g('glow')})`} style={{ transformOrigin: `${cx}px 196px` }} />
              </g>
            ))}
            <path d="M200 58 C 282 58 322 112 322 186 C 322 256 286 318 200 318 C 114 318 78 256 78 186 C 78 112 118 58 200 58 Z" fill={`url(#${g('metal')})`} />
            <path d="M200 58 C 282 58 322 112 322 186 C 322 256 286 318 200 318 C 114 318 78 256 78 186 C 78 112 118 58 200 58 Z" fill={`url(#${g('violetEdge')})`} />
            <path d="M200 58 C 282 58 322 112 322 186 C 322 256 286 318 200 318 C 114 318 78 256 78 186 C 78 112 118 58 200 58 Z" fill={`url(#${g('cyanEdge')})`} />
            <path d="M200 58 C 282 58 322 112 322 186 C 322 256 286 318 200 318 C 114 318 78 256 78 186 C 78 112 118 58 200 58 Z" fill={`url(#${g('sheen')})`} />
            <path d="M200 58 C 282 58 322 112 322 186 C 322 256 286 318 200 318 C 114 318 78 256 78 186 C 78 112 118 58 200 58 Z" fill="none" stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1.5" />
            {/* panel seams */}
            <path d="M112 252 Q 150 300 200 304 Q 250 300 288 252" stroke="#0b1022" strokeOpacity="0.35" strokeWidth="1.5" fill="none" />
            <path d="M200 58 L200 104" stroke="#0b1022" strokeOpacity="0.25" strokeWidth="1.5" />
            {/* forehead light */}
            <rect x="180" y="96" width="40" height="7" rx="3.5" fill="#a78bfa" className="forehead" filter={`url(#${g('glow')})`} />
            {/* visor */}
            <path d="M200 118 C 268 118 298 146 298 192 C 298 240 270 272 200 272 C 130 272 102 240 102 192 C 102 146 132 118 200 118 Z" fill={`url(#${g('visor')})`} stroke="#38bdf8" strokeOpacity="0.55" strokeWidth="2" />

            <g clipPath={`url(#${g('visorClip')})`}>
              <ellipse cx="200" cy="200" rx="90" ry="60" fill="#22d3ee" opacity="0.06" filter={`url(#${g('soft')})`} />
              {/* scanlines */}
              <g opacity="0.07">{Array.from({ length: 26 }, (_, i) => <rect key={i} x="100" y={120 + i * 6} width="200" height="1" fill="#a5f3fc" />)}</g>
              <g ref={faceRef}>
                {/* eyes */}
                {[{ cx: 158, side: 'l', eref: eyeLRef, pref: pupilLRef }, { cx: 242, side: 'r', eref: eyeRRef, pref: pupilRRef }].map(({ cx, side, eref, pref }) => (
                  <g key={side} transform={`translate(${cx} 192)`}>
                    <g className={`brow brow-${side}`}><rect x="-20" y="-34" width="40" height="4.5" rx="2.25" fill="#67e8f9" opacity="0.85" filter={`url(#${g('glow')})`} /></g>
                    <g ref={eref}>
                      <rect x="-25" y="-15" width="50" height="30" rx="15" fill={`url(#${g('eye')})`} filter={`url(#${g('glow')})`} />
                      <g ref={pref}>
                        <circle cx="0" cy="0" r="7.5" fill="#ffffff" opacity="0.95" />
                        <circle cx="-3" cy="-3" r="2.5" fill="#ffffff" />
                      </g>
                    </g>
                    <g className={`lid-up lid-up-${side}`}><rect x="-40" y="-52" width="80" height="38" fill={`url(#${g(side === 'l' ? 'lidL' : 'lidR')})`} /></g>
                    <g className={`lid-low lid-low-${side}`}><ellipse cx="0" cy="30" rx="36" ry="19" fill={`url(#${g(side === 'l' ? 'lidL' : 'lidR')})`} /></g>
                  </g>
                ))}
                {/* mouth: lip-sync equaliser */}
                <g filter={`url(#${g('glow')})`}>
                  {Array.from({ length: BARS }, (_, i) => (
                    <rect key={i} ref={(el) => (barsRef.current[i] = el)} x={200 - ((BARS - 1) / 2) * 9 + i * 9 - 2.5} y="244" width="5" height="3" rx="2.5" fill="#67e8f9" />
                  ))}
                </g>
              </g>
              {/* glass glare */}
              <path d="M120 150 C 150 128 190 122 230 124 L 160 210 C 140 200 120 180 120 150 Z" fill="#ffffff" opacity="0.07" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
