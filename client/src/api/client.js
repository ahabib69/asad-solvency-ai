// All network access goes through our own backend (/api). No provider keys in the browser.

export class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

async function request(path, { method = 'GET', body, headers, signal, raw } = {}) {
  const isForm = body instanceof FormData;
  let res;
  try {
    res = await fetch(path, {
      method, signal,
      headers: isForm ? headers : { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError('Cannot reach the Asad Solvency server. Is it running (npm run dev)?', 0, 'network');
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`, code;
    try { const j = await res.json(); msg = j.error || msg; code = j.code; } catch {}
    throw new ApiError(msg, res.status, code);
  }
  if (raw) return res;
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

export const api = {
  status: () => request('/api/status'),
  conversations: (q = '', mode = '') => request(`/api/conversations?q=${encodeURIComponent(q)}&mode=${encodeURIComponent(mode)}`),
  conversation: (id) => request(`/api/conversations/${id}`),
  renameConversation: (id, title) => request(`/api/conversations/${id}`, { method: 'PATCH', body: { title } }),
  pinConversation: (id, pinned) => request(`/api/conversations/${id}`, { method: 'PATCH', body: { pinned } }),
  deleteConversation: (id) => request(`/api/conversations/${id}`, { method: 'DELETE' }),
  clearConversations: () => request('/api/conversations', { method: 'DELETE' }),
  feedback: (cid, mid, value) => request(`/api/conversations/${cid}/messages/${mid}/feedback`, { method: 'POST', body: { value } }),
  live: (body, signal) => request('/api/live', { method: 'POST', body, signal }),
  images: () => request('/api/images'),
  deleteImage: (id) => request(`/api/images/${id}`, { method: 'DELETE' }),
  generateImage: (form, signal) => request('/api/images/generate', { method: 'POST', body: form, signal }),
  upscaleImage: (id) => request(`/api/images/${id}/upscale`, { method: 'POST' }),
  enhancePrompt: (prompt, style) => request('/api/images/enhance', { method: 'POST', body: { prompt, style } }),
  voices: () => request('/api/voices'),
  tts: (text, voice, speed, signal) => request('/api/tts', { method: 'POST', body: { text, voice, speed }, signal, raw: true }),
  transcribe: (blob, language) => {
    const fd = new FormData();
    fd.append('audio', blob, 'speech.webm');
    if (language) fd.append('language', language);
    return request('/api/transcribe', { method: 'POST', body: fd });
  },
};

/**
 * Stream a chat completion via Server-Sent Events over POST.
 * handlers: { onMeta, onDelta, onDone, onError }
 */
export async function streamChat(body, handlers = {}, signal) {
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (e.name === 'AbortError') return;
    handlers.onError?.({ message: 'Cannot reach the Asad Solvency server. Is it running?', code: 'network' });
    return;
  }
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try { msg = (await res.json()).error || msg; } catch {}
    handlers.onError?.({ message: msg, code: 'http_' + res.status });
    return;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const block = buf.slice(0, i);
        buf = buf.slice(i + 2);
        let event = 'message', data = '';
        for (const line of block.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        let parsed = {};
        try { parsed = JSON.parse(data || '{}'); } catch {}
        if (event === 'meta') handlers.onMeta?.(parsed);
        else if (event === 'delta') handlers.onDelta?.(parsed.text || '');
        else if (event === 'done') handlers.onDone?.(parsed);
        else if (event === 'error') handlers.onError?.(parsed);
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') handlers.onError?.({ message: 'Connection interrupted.', code: 'stream' });
  }
}
