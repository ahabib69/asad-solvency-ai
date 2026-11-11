import { useEffect, useRef } from 'react';

/** Ambient floating particles. `intensity` 0..1, `attract` pulls particles to centre (listening). */
export default function ParticleField({ attractRef, density = 90 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv.getContext('2d');
    let w, h, raf, dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => { w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    resize();
    window.addEventListener('resize', resize);
    const reduce = document.documentElement.classList.contains('reduce-motion');
    const P = Array.from({ length: reduce ? 30 : density }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.8 + 0.3,
      vx: (Math.random() - 0.5) * 0.15, vy: -Math.random() * 0.35 - 0.05,
      hue: Math.random() < 0.65 ? 190 : 265, a: Math.random() * 0.6 + 0.2, tw: Math.random() * 6,
    }));
    const loop = (t) => {
      ctx.clearRect(0, 0, w, h);
      const pull = attractRef?.current || 0;
      const cx = w / 2, cy = h * 0.45;
      for (const p of P) {
        if (pull > 0) { p.vx += ((cx - p.x) / w) * 0.02 * pull; p.vy += ((cy - p.y) / h) * 0.02 * pull; }
        p.vx *= 0.99; p.vy = p.vy * 0.99 - 0.002;
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; p.vy = -Math.random() * 0.35 - 0.05; }
        if (p.x < -10) p.x = w + 10; if (p.x > w + 10) p.x = -10;
        const a = p.a * (0.6 + 0.4 * Math.sin(t / 700 + p.tw));
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 95%, 72%, ${a})`;
        ctx.shadowColor = `hsla(${p.hue}, 95%, 65%, 0.9)`;
        ctx.shadowBlur = 8;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [attractRef, density]);
  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}
