// Web Browser helper: tells the frontend whether a URL may be shown inside an <iframe>.
// Browsers do not let a page detect a blocked cross-origin frame, so we check the
// target's X-Frame-Options / CSP frame-ancestors headers server-side.
import { Router } from 'express';
import dns from 'node:dns/promises';
import net from 'node:net';

const router = Router();
const cache = new Map(); // url -> { at, data }
const TTL = 10 * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublic(hostname) {
  if (/^localhost$|\.local$|\.internal$/i.test(hostname)) throw Object.assign(new Error('private'), { private: true });
  const addrs = net.isIP(hostname) ? [{ address: hostname }] : await dns.lookup(hostname, { all: true });
  if (addrs.some((a) => isPrivateIp(a.address))) throw Object.assign(new Error('private'), { private: true });
}

function analyse(headers, requesterHost) {
  const xfo = (headers.get('x-frame-options') || '').trim().toUpperCase();
  const csp = headers.get('content-security-policy') || '';
  const fa = csp.split(';').map((d) => d.trim()).find((d) => d.toLowerCase().startsWith('frame-ancestors'));
  if (fa) {
    const sources = fa.split(/\s+/).slice(1).map((s) => s.toLowerCase());
    const allowed = sources.some((s) => s === '*' || s === 'https:' || s === 'http:' ||
      (requesterHost && (s.replace(/^https?:\/\//, '').replace(/^\*\./, '') === requesterHost ||
        (s.includes('*.') && requesterHost.endsWith(s.split('*.')[1])))));
    return allowed
      ? { embeddable: true }
      : { embeddable: false, reason: `The site's security policy (frame-ancestors ${sources.join(' ') || "'none'"}) doesn't allow other websites to show it inside a frame.` };
  }
  if (xfo === 'DENY' || xfo === 'SAMEORIGIN' || xfo.startsWith('ALLOW-FROM')) {
    return { embeddable: false, reason: `The site sends "X-Frame-Options: ${xfo}", which stops other websites from showing it inside a frame.` };
  }
  return { embeddable: true };
}

async function readTitle(res) {
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html') || !res.body) { res.body?.cancel?.().catch(() => {}); return ''; }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let html = '';
  try {
    while (html.length < 120000) {
      const { value, done } = await reader.read();
      if (done) break;
      html += dec.decode(value, { stream: true });
      if (/<\/title>/i.test(html)) break;
    }
  } catch {}
  reader.cancel().catch(() => {});
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim().slice(0, 120) : '';
}

router.get('/browser/inspect', async (req, res) => {
  let url;
  try {
    url = new URL(String(req.query.url || ''));
    if (!/^https?:$/.test(url.protocol)) throw new Error();
  } catch { return res.status(400).json({ error: 'Invalid URL' }); }

  const key = url.href;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return res.json(hit.data);

  const requesterHost = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].split(':')[0];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    let current = url;
    let r;
    for (let hop = 0; hop < 6; hop++) {
      await assertPublic(current.hostname);
      r = await fetch(current, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9' } });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) { r.body?.cancel?.().catch(() => {}); current = new URL(loc, current); continue; }
      break;
    }
    const verdict = analyse(r.headers, requesterHost);
    const title = await readTitle(r);
    const data = { url: key, finalUrl: current.href, status: r.status, title, ...verdict };
    cache.set(key, { at: Date.now(), data });
    res.json(data);
  } catch (e) {
    // Couldn't check (offline, private address, timeout) — let the browser simply try the frame.
    res.json({ url: key, embeddable: null, reason: e.private ? 'private' : 'unreachable', title: '' });
  } finally { clearTimeout(timer); }
});

export default router;
