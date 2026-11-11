// Provider-agnostic client for any OpenAI-compatible Chat Completions API
// (OpenAI, OpenRouter, Groq, Together, Mistral, DeepSeek, local Ollama/LM Studio, ...).
import { config } from '../config.js';

export class ProviderError extends Error {
  constructor(message, status = 502, code = 'provider_error') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function assertLlmConfigured() {
  if (!config.llm.apiKey) {
    throw new ProviderError(
      'AI is not configured yet. Add OPENAI_API_KEY (or LLM_API_KEY + LLM_BASE_URL) to the .env file in the project root, then restart the server.',
      503,
      'not_configured'
    );
  }
}

export async function readProviderError(res, label = 'AI provider') {
  let detail = '';
  try {
    const txt = await res.text();
    try {
      const j = JSON.parse(txt);
      detail = j?.error?.message || j?.message || j?.errors?.join?.(', ') || j?.name || txt;
    } catch { detail = txt; }
  } catch {}
  detail = String(detail).slice(0, 400);
  if (res.status === 401 || res.status === 403)
    return new ProviderError(`${label} rejected the API key (HTTP ${res.status}). Check the key in your .env file. ${detail}`, 401, 'auth');
  if (res.status === 429)
    return new ProviderError(`${label} rate limit or quota exceeded. Wait a moment or check your billing. ${detail}`, 429, 'rate_limited');
  if (res.status === 404)
    return new ProviderError(`${label}: model or endpoint not found (HTTP 404). Check the model name in .env. ${detail}`, 502, 'not_found');
  return new ProviderError(`${label} error (HTTP ${res.status}): ${detail}`, 502, 'provider_error');
}

/** Non-streaming completion. Returns the assistant text. */
export async function complete({ messages, model, temperature, maxTokens, signal }) {
  assertLlmConfigured();
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model: model || config.llm.model,
      messages,
      temperature: temperature ?? config.llm.temperature,
      max_tokens: maxTokens ?? config.llm.maxTokens,
    }),
  }).catch((e) => { throw networkError(e); });
  if (!res.ok) throw await readProviderError(res);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || '';
}

/** Streaming completion. Calls onDelta(text) for each token chunk; resolves with full text. */
export async function stream({ messages, model, temperature, maxTokens, signal, onDelta }) {
  assertLlmConfigured();
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.llm.apiKey}` },
    body: JSON.stringify({
      model: model || config.llm.model,
      messages,
      stream: true,
      temperature: temperature ?? config.llm.temperature,
      max_tokens: maxTokens ?? config.llm.maxTokens,
    }),
  }).catch((e) => { throw networkError(e); });
  if (!res.ok) throw await readProviderError(res);

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return full;
      try {
        const j = JSON.parse(payload);
        const delta = j?.choices?.[0]?.delta?.content;
        if (delta) { full += delta; onDelta?.(delta); }
      } catch { /* ignore keep-alives / partial lines */ }
    }
  }
  return full;
}

function networkError(e) {
  if (e?.name === 'AbortError') return e;
  return new ProviderError(`Could not reach the AI provider (${e?.cause?.code || e.message}). Check LLM_BASE_URL and your internet connection.`, 502, 'network');
}
