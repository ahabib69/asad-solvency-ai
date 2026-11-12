import { useEffect, useRef } from 'react';

/**
 * "Living portrait" companion: a still character image brought to life with
 * breathing, pointer-follow 3D tilt, voice-reactive glow + nod, laugh shakes,
 * ember particles and a voice equaliser. (No lip-sync: it is one image, not a video.)
 * Same props as RobotPersona.
 */
const SRC = '/assets/character.jpg';
const BARS = 13;
const EMBERS = 16;

export default function CharacterPersona({ size = 420, state = 'idle', emotion = 'calm', getLevel, getMicLevel, compact = false, materialize = false }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const glowRef = useRef(null);
  const barsRef = useRef([]);
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

    const s = { ry: 0, rx: 0, lx: 0, ly: 0, lvl: 0, mic: 0, laughStart: -9999, nextLaugh: performance.now() + 3000 };
    let raf;
    const loop = (t) => {
      const { state: st, emotion: emo, getLevel: gl, getMicLevel: gm } = props.current;
      const idle = t - pointer.last > 4000;
      let tx = idle ? Math.sin(t / 2800) * 0.4 : pointer.x;
      let ty = idle ? Math.sin(t / 3600) * 0.2 : pointer.y;
      if (st === 'thinking') { tx = 0.4 + Math.sin(t / 600) * 0.1; ty = -0.3; }
      s.lx += (tx - s.lx) * 0.08; s.ly += (ty - s.ly) * 0.08;
      s.ry += (s.lx * 9 - s.ry) * 0.06; s.rx += (-s.ly * 6 - s.rx) * 0.06;

      const rawLvl = st === 'speaking' && gl ? gl() : 0;
      const rawMic = st === 'listening' && gm ? gm() : 0;
      s.lvl += (rawLvl - s.lvl) * 0.35;
      s.mic += (rawMic - s.mic) * 0.25;

      // laughing: shakes + bounce while the AI is speaking happily
      if (!reduce && st === 'speaking' && (emo === 'happy' || emo === 'excited') && s.lvl > 0.3 && t > s.nextLaugh) {
        s.laughStart = t; s.nextLaugh = t + 3200 + Math.random() * 3500;
      }
      const lp = (t - s.laughStart) / 1100;
      const laugh = lp >= 0 && lp < 1 ? (1 - lp) : 0;
      const shake = Math.sin(t / 40) * laugh;
      const bounce = Math.abs(Math.sin(t / 85)) * laugh;

      const m = reduce ? 0 : 1;
      const float = Math.sin(t / 1500) * 4 * m;
      if (wrapRef.current) wrapRef.current.style.transform = `perspective(1000px) rotateY(${s.ry}deg) rotateX(${s.rx}deg) translateY(${float - bounce * 7}px)`;

      const breath = Math.sin(t / 1700) * 0.006 * m;
      const nod = Math.sin(t / 240) * s.lvl * 1.1 * m;
      const scale = 1.08 + breath + s.lvl * 0.03 + s.mic * 0.012 + laugh * 0.012;
      if (imgRef.current) imgRef.current.style.transform = `translate(${-s.lx * 9 + shake * 4}px, ${-s.ly * 6}px) rotate(${nod + shake * 1.4}deg) scale(${scale})`;

      if (glowRef.current) glowRef.current.style.opacity = (0.35 + s.lvl * 0.75 + s.mic * 0.5 + Math.sin(t / 700) * 0.08 * m + laugh * 0.3).toFixed(3);

      for (let i = 0; i < BARS; i++) {
        const el = barsRef.current[i];
        if (!el) continue;
        const dx = (i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const env = Math.pow(Math.cos((dx * Math.PI) / 2), 0.9);
        const jitter = 0.55 + 0.45 * Math.sin(t * 0.02 + i * 1.9);
        const amp = Math.max(s.lvl, s.mic);
        const h = 3 + amp * 26 * env * jitter + (st === 'thinking' ? (Math.sin(t / 180 + i) + 1) * 3 : 0);
        el.style.height = `${h.toFixed(1)}px`;
        el.style.opacity = (0.45 + Math.min(0.55, amp * 0.9 + env * 0.15)).toFixed(2);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('pointermove', onMove); };
  }, []);

  return (
    <div className={`persona character st-${state} emo-${emotion} ${compact ? 'compact' : ''} ${materialize ? 'materialize' : ''}`} style={{ width: size, height: size * 1.12 }}>
      <div className="persona-3d" ref={wrapRef}>
        <div className="cp-frame" role="img" aria-label={`AI companion, ${state}`}>
          <img ref={imgRef} className="cp-img" src={SRC} alt="" draggable="false" />
          <div className="cp-glow" ref={glowRef} />
          <div className="cp-embers" aria-hidden="true">
            {Array.from({ length: EMBERS }, (_, i) => (
              <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${-((i * 53) % 90) / 10}s`, animationDuration: `${5 + ((i * 29) % 40) / 10}s`, width: `${2 + (i % 3)}px`, height: `${2 + (i % 3)}px` }} />
            ))}
          </div>
          <div className="cp-vignette" />
          {!compact && (
            <div className="cp-wave" aria-hidden="true">
              {Array.from({ length: BARS }, (_, i) => <i key={i} ref={(el) => (barsRef.current[i] = el)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
