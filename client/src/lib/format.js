export function timeAgo(iso) {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60; if (m < 60) return `${Math.floor(m)} min ago`;
  const h = m / 60; if (h < 24) return `${Math.floor(h)} hour${h >= 2 ? 's' : ''} ago`;
  const d = h / 24; if (d < 7) return `${Math.floor(d)} day${d >= 2 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}

export const MODE_LABEL = { solver: 'Problem Solver', useful: 'Make Yourself Useful', live: 'Live AI' };

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  }
}
