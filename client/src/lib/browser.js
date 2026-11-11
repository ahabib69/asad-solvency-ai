// URL helpers for the in-app Web Browser.
export const NEW_TAB = 'asad://newtab';

export const QUICK_LINKS = [
  { name: 'Google', url: 'https://www.google.com/', host: 'google.com' },
  { name: 'YouTube', url: 'https://www.youtube.com/', host: 'youtube.com' },
  { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Main_Page', host: 'wikipedia.org' },
];

const looksLikeUrl = (s) =>
  /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ||
  /^localhost(:\d+)?(\/|$)/i.test(s) ||
  /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(s) ||
  (/^[^\s/]+\.[a-z]{2,}(:\d+)?(\/\S*)?$/i.test(s) && !/\s/.test(s));

/** Turn whatever the user typed into a URL (or a Google search). */
export function toUrl(input) {
  const s = String(input || '').trim();
  if (!s) return NEW_TAB;
  if (s === NEW_TAB) return s;
  if (looksLikeUrl(s)) {
    const withProto = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`;
    try {
      const u = new URL(withProto);
      if (!/^https?:$/.test(u.protocol)) return googleSearch(s);
      return u.href;
    } catch { /* fall through to search */ }
  }
  return googleSearch(s);
}

export const googleSearch = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;

/**
 * Some big sites block framing on their normal pages but offer an embeddable variant.
 * We transparently load that variant while showing the normal URL in the address bar.
 */
export function embedUrl(url) {
  if (url === NEW_TAB) return url;
  let u;
  try { u = new URL(url); } catch { return url; }
  const host = u.hostname.replace(/^www\./, '');
  // Google: igu=1 enables Google's embeddable mode for home + search
  if (host === 'google.com' && (u.pathname === '/' || u.pathname === '/webhp' || u.pathname === '/search')) {
    u.hostname = 'www.google.com';
    u.searchParams.set('igu', '1');
    return u.href;
  }
  // YouTube videos → official embeddable player
  let vid = null;
  if ((host === 'youtube.com' || host === 'm.youtube.com') && u.pathname === '/watch') vid = u.searchParams.get('v');
  else if ((host === 'youtube.com' || host === 'm.youtube.com') && u.pathname.startsWith('/shorts/')) vid = u.pathname.split('/')[2];
  else if (host === 'youtu.be') vid = u.pathname.slice(1);
  if (vid) {
    const start = u.searchParams.get('t');
    return `https://www.youtube.com/embed/${encodeURIComponent(vid)}?autoplay=1&rel=0${start ? `&start=${parseInt(start, 10) || 0}` : ''}`;
  }
  return url;
}

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}

export const faviconFor = (url) => {
  const h = hostOf(url);
  return h ? `https://www.google.com/s2/favicons?domain=${h}&sz=64` : '';
};

/** Pretty text for the address bar. */
export function displayUrl(url) {
  if (url === NEW_TAB) return '';
  return url;
}
