import { useEffect, useId, useRef } from 'react';

/**
 * Futuristic neon robotic companion ("SOL-X"): carbon helmet, neon visor eyes, antenna and hex reactor.
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
  const neon = { stopColor: 'var(--neon)' };
  const neonSoft = { stopColor: 'var(--neon-soft)' };
  const HEAD = 'M146 66 L254 66 L308 104 L328 190 L314 262 L262 318 L138 318 L86 262 L72 190 L92 104 Z';
  const VISOR = 'M124 126 L276 126 L306 152 L306 236 L276 272 L124 272 L94 236 L94 152 Z';
  const BODY = 'M26 460 L50 396 L118 364 L160 352 L240 352 L282 364 L350 396 L374 460 Z';

  return (
    <div className={`persona st-${state} emo-${emotion} ${compact ? 'compact' : ''} ${materialize ? 'materialize' : ''}`} style={{ width: size, height: size * 1.12 }}>
      <div className="persona-ring" ref={ringRef} />
      <div className="persona-orbit"><i /><i /><i /></div>
      <div className="persona-3d" ref={wrapRef}>
        <svg viewBox="0 0 400 460" width="100%" height="100%" role="img" aria-label={`AI companion, ${state}`}>
          <defs>
            <linearGradient id={g('carbon')} x1="0.15" y1="0" x2="0.85" y2="1">
              <stop offset="0" stopColor="#4a5380" />
              <stop offset="0.3" stopColor="#252c52" />
              <stop offset="0.7" stopColor="#10142e" />
              <stop offset="1" stopColor="#05071a" />
            </linearGradient>
            <radialGradient id={g('sheen')} cx="0.3" cy="0.18" r="0.65">
              <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.04" />
              <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={g('trim')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ff2bd6" />
              <stop offset="0.5" stopColor="#8b5cf6" />
              <stop offset="1" stopColor="#00e5ff" />
            </linearGradient>
            <radialGradient id={g('visor')} cx="0.5" cy="0.4" r="0.7">
              <stop offset="0" stopColor="#0d1740" />
              <stop offset="0.6" stopColor="#060b26" />
              <stop offset="1" stopColor="#02040f" />
            </radialGradient>
            <radialGradient id={g('eye')} cx="0.5" cy="0.45" r="0.62">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.3" style={neonSoft} />
              <stop offset="0.75" style={neon} />
              <stop offset="1" style={neon} stopOpacity="0.85" />
            </radialGradient>
            <radialGradient id={g('core')} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.35" style={neonSoft} />
              <stop offset="1" style={neon} stopOpacity="0" />
            </radialGradient>
            <radialGradient id={g('aura')} cx="0.5" cy="0.45" r="0.5">
              <stop offset="0" style={neon} stopOpacity="0.32" />
              <stop offset="0.5" stopColor="#8b5cf6" stopOpacity="0.14" />
              <stop offset="1" stopColor="#ff2bd6" stopOpacity="0" />
            </radialGradient>
            <filter id={g('glow')} x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4.5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <filter id={g('soft')} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7" /></filter>
            {[['L', 42], ['R', -42]].map(([k, cx]) => (
              <radialGradient key={k} id={g('lid' + k)} gradientUnits="userSpaceOnUse" cx={cx} cy="-9" r="120">
                <stop offset="0" stopColor="#0d1740" />
                <stop offset="0.6" stopColor="#060b26" />
                <stop offset="1" stopColor="#02040f" />
              </radialGradient>
            ))}
            <clipPath id={g('visorClip')}><path d={VISOR} /></clipPath>
          </defs>

          <ellipse cx="200" cy="210" rx="195" ry="205" fill={`url(#${g('aura')})`} ref={glowRef} />

          {/* neon floor rings */}
          {!compact && (
            <g className="floor-ring" opacity="0.85">
              <ellipse cx="200" cy="448" rx="150" ry="12" fill="none" style={{ stroke: 'var(--neon)' }} strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="6 10" />
              <ellipse cx="200" cy="448" rx="110" ry="8" fill="none" stroke="#ff2bd6" strokeOpacity="0.55" strokeWidth="1.2" />
            </g>
          )}

          {/* Body: angular shoulders + hex reactor */}
          <g className="body">
            <path d={BODY} fill={`url(#${g('carbon')})`} />
            <path d={BODY} fill="none" stroke={`url(#${g('trim')})`} strokeWidth="2.5" filter={`url(#${g('glow')})`} />
            <path d="M118 364 L132 398 L160 460 M282 364 L268 398 L240 460" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.4" fill="none" />
            <path d="M70 430 L104 410 M330 430 L296 410" style={{ stroke: 'var(--neon)' }} strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" filter={`url(#${g('glow')})`} />
            <polygon points="200,390 226,405 226,431 200,446 174,431 174,405" fill="#070a20" stroke="#ff2bd6" strokeOpacity="0.8" strokeWidth="1.6" />
            <circle cx="200" cy="418" r="24" fill={`url(#${g('core')})`} className="chest-core" />
            <circle cx="200" cy="418" r="8" fill="#ffffff" opacity="0.95" filter={`url(#${g('glow')})`} />
          </g>

          {/* Neck */}
          <g>
            <rect x="168" y="304" width="64" height="58" rx="10" fill="#0b0f26" />
            {[316, 330, 344].map((y) => <rect key={y} x="176" y={y} width="48" height="3" rx="1.5" style={{ fill: 'var(--neon)' }} opacity="0.65" />)}
          </g>

          {/* Head */}
          <g ref={headRef}>
            {/* antenna */}
            <path d="M200 66 L200 34" stroke="#8b5cf6" strokeWidth="3" strokeLinecap="round" />
            <circle cx="200" cy="27" r="7" fill="#ff2bd6" className="antenna-tip" filter={`url(#${g('glow')})`} />
            <circle cx="200" cy="27" r="2.6" fill="#ffffff" />
            {/* ear modules */}
            {[72, 328].map((cx) => (
              <g key={cx}>
                <polygon points={`${cx},166 ${cx + (cx < 200 ? -22 : 22)},181 ${cx + (cx < 200 ? -22 : 22)},211 ${cx},226 ${cx + (cx < 200 ? 4 : -4)},196`} fill={`url(#${g('carbon')})`} />
                <circle cx={cx + (cx < 200 ? -8 : 8)} cy="196" r="12" fill="#070a20" />
                <circle cx={cx + (cx < 200 ? -8 : 8)} cy="196" r="9" fill="none" style={{ stroke: 'var(--neon)', transformOrigin: `${cx + (cx < 200 ? -8 : 8)}px 196px` }} strokeWidth="2.5" strokeDasharray="9 6" className="ear-spin" filter={`url(#${g('glow')})`} />
              </g>
            ))}
            <path d={HEAD} fill={`url(#${g('carbon')})`} />
            <path d={HEAD} fill={`url(#${g('sheen')})`} />
            <path d={HEAD} fill="none" stroke={`url(#${g('trim')})`} strokeWidth="3" filter={`url(#${g('glow')})`} />
            {/* circuit lines on the cheeks */}
            <g fill="none" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
              <path d="M112 276 L132 296 L168 296" stroke="#ff2bd6" />
              <path d="M288 276 L268 296 L232 296" style={{ stroke: 'var(--neon)' }} />
              <path d="M104 120 L122 140 M296 120 L278 140" stroke="#8b5cf6" />
            </g>
            <circle cx="168" cy="296" r="2.6" fill="#ff2bd6" /><circle cx="232" cy="296" r="2.6" style={{ fill: 'var(--neon)' }} />
            {/* forehead light */}
            <path d="M178 92 L200 80 L222 92" fill="none" style={{ stroke: 'var(--neon)' }} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" className="forehead" filter={`url(#${g('glow')})`} />
            {/* visor */}
            <path d={VISOR} fill={`url(#${g('visor')})`} style={{ stroke: 'var(--neon)' }} strokeOpacity="0.8" strokeWidth="2.5" filter={`url(#${g('glow')})`} />
            <path d={VISOR} fill={`url(#${g('visor')})`} />

            <g clipPath={`url(#${g('visorClip')})`}>
              <ellipse cx="200" cy="200" rx="100" ry="62" style={{ fill: 'var(--neon)' }} opacity="0.1" filter={`url(#${g('soft')})`} />
              <g opacity="0.08">{Array.from({ length: 26 }, (_, i) => <rect key={i} x="90" y={126 + i * 6} width="220" height="1" style={{ fill: 'var(--neon-soft)' }} />)}</g>
              <rect className="visor-scan" x="90" y="118" width="220" height="3" style={{ fill: 'var(--neon)' }} opacity="0.35" filter={`url(#${g('soft')})`} />
              <g ref={faceRef}>
                {/* neon eyes */}
                {[{ cx: 152, side: 'l', eref: eyeLRef, pref: pupilLRef }, { cx: 248, side: 'r', eref: eyeRRef, pref: pupilRRef }].map(({ cx, side, eref, pref }) => (
                  <g key={side} transform={`translate(${cx} 192) scale(1.22)`}>
                    <g className={`brow brow-${side}`}><rect x="-21" y="-35" width="42" height="4.5" rx="2.25" style={{ fill: 'var(--neon)' }} opacity="0.9" filter={`url(#${g('glow')})`} /></g>
                    <g ref={eref}>
                      <rect x="-27" y="-17" width="54" height="34" rx="13" fill="none" style={{ stroke: 'var(--neon)' }} strokeWidth="3" opacity="0.9" filter={`url(#${g('glow')})`} />
                      <rect x="-23" y="-13" width="46" height="26" rx="10" fill={`url(#${g('eye')})`} filter={`url(#${g('glow')})`} />
                      <g ref={pref}>
                        <rect x="-3.5" y="-11" width="7" height="22" rx="3.5" fill="#050818" opacity="0.8" />
                        <circle cx="-8" cy="-5" r="3" fill="#ffffff" />
                      </g>
                    </g>
                    <g className={`lid-up lid-up-${side}`}><rect x="-42" y="-54" width="84" height="40" fill={`url(#${g(side === 'l' ? 'lidL' : 'lidR')})`} /></g>
                    <g className={`lid-low lid-low-${side}`}><ellipse cx="0" cy="30" rx="38" ry="19" fill={`url(#${g(side === 'l' ? 'lidL' : 'lidR')})`} /></g>
                  </g>
                ))}
                {/* mouth: neon equaliser */}
                <g filter={`url(#${g('glow')})`}>
                  {Array.from({ length: BARS }, (_, i) => (
                    <rect key={i} ref={(el) => (barsRef.current[i] = el)} x={200 - ((BARS - 1) / 2) * 9 + i * 9 - 2.5} y="244" width="5" height="3" rx="2.5" style={{ fill: 'var(--neon-soft)' }} />
                  ))}
                </g>
              </g>
              {/* glass glare */}
              <path d="M118 150 L228 134 L168 226 L120 212 Z" fill="#ffffff" opacity="0.06" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
