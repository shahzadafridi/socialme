import { PROVIDER_PRESETS } from '@/lib/core/constants';
import type { ProviderId, ProviderSettings } from '@/lib/core/types';
import { pickText, readSSE, safeJson } from '@/lib/core/ai/sse';

export class AiError extends Error {
  code: string;
  status?: number;

  constructor(message: string, code = 'error', status?: number) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
  }
}

export interface StreamOptions {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

function trimBase(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function withTimeout(signal: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), ms);
  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', onAbort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

async function toError(res: Response): Promise<AiError> {
  let detail = '';
  try {
    const text = await res.text();
    const json = safeJson(text) as any;
    detail =
      json?.error?.message ??
      json?.message ??
      json?.error?.[0]?.message ??
      text.slice(0, 240) ??
      '';
  } catch {
    detail = '';
  }

  const suffix = detail ? ` — ${detail}` : '';
  if (res.status === 401 || res.status === 403) {
    return new AiError(`API key rejected${suffix}`, 'auth', res.status);
  }
  if (res.status === 404) {
    return new AiError(`Model or endpoint not found${suffix}`, 'model', res.status);
  }
  if (res.status === 429) {
    return new AiError(`Rate limited by the provider${suffix}`, 'rate_limit', res.status);
  }
  if (res.status === 402) {
    return new AiError(`Provider says the account has no credit${suffix}`, 'billing', res.status);
  }
  if (res.status >= 500) {
    return new AiError(`Provider is having issues (${res.status})${suffix}`, 'provider', res.status);
  }
  return new AiError(`Request failed (${res.status})${suffix}`, 'http', res.status);
}

/**
 * Stream a completion from any configured provider.
 * Yields text deltas in order. Throws AiError with a user-friendly message.
 */
export async function* streamCompletion(
  provider: ProviderSettings,
  apiKey: string,
  opts: StreamOptions,
): AsyncGenerator<string> {
  const preset = PROVIDER_PRESETS[provider.id];
  const kind = preset?.kind ?? 'openai';
  const base = trimBase(provider.baseUrl || preset.baseUrl);

  if (!base) throw new AiError('No base URL configured for this provider.', 'config');
  if (!provider.model) throw new AiError('No model selected. Pick one in settings.', 'config');
  if (!apiKey && !preset.keyless) {
    throw new AiError(`Add your ${preset.label} API key in SocialMe settings.`, 'no_key');
  }

  const temperature = Math.min(2, Math.max(0, opts.temperature ?? provider.temperature ?? 0.8));
  const maxTokens = opts.maxTokens ?? 600;
  const { signal, cleanup } = withTimeout(opts.signal, 120_000);

  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let body: unknown;

  if (kind === 'anthropic') {
    url = `${base}/messages`;
    headers = {
      ...headers,
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    body = {
      model: provider.model,
      max_tokens: maxTokens,
      temperature,
      system: opts.system,
      messages: [{ role: 'user', content: opts.user }],
      stream: true,
    };
  } else if (kind === 'gemini') {
    url = `${base}/models/${encodeURIComponent(provider.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
    body = {
      systemInstruction: { parts: [{ text: opts.system }] },
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        topP: 0.95,
      },
    };
  } else {
    url = `${base}/chat/completions`;
    headers = { ...headers, Authorization: `Bearer ${apiKey}` };
    if (provider.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://socialme.app';
      headers['X-Title'] = 'SocialMe';
    }
    body = {
      model: provider.model,
      stream: true,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: opts.user },
      ],
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) throw await toError(res);

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('event-stream')) {
      // Some proxies ignore stream:true and return one JSON blob.
      const text = await res.text();
      const json = safeJson(text);
      const chunk = pickText(json);
      if (chunk) {
        yield chunk;
        return;
      }
      throw new AiError('Provider returned an unexpected response format.', 'format');
    }

    for await (const data of readSSE(res)) {
      const json = safeJson(data);
      if ((json as any)?.error) {
        throw new AiError(
          String((json as any).error?.message ?? 'Provider error'),
          'provider',
        );
      }
      const text = pickText(json);
      if (text) yield text;
    }
  } catch (error) {
    if (error instanceof AiError) throw error;
    const err = error as Error;
    if (err.name === 'AbortError' || /aborted/i.test(err.message)) {
      throw new AiError('Generation cancelled.', 'aborted');
    }
    if (/Failed to fetch|NetworkError|load failed/i.test(err.message)) {
      throw new AiError(
        `Could not reach ${PROVIDER_PRESETS[provider.id]?.label ?? 'the provider'}. Check your connection, VPN, or base URL.`,
        'network',
      );
    }
    throw new AiError(err.message || 'Unknown error', 'unknown');
  } finally {
    cleanup();
  }
}

/** Fetch available models so the user does not have to type IDs from memory. */
export async function listModels(
  provider: ProviderSettings,
  apiKey: string,
): Promise<string[]> {
  const preset = PROVIDER_PRESETS[provider.id];
  const kind = preset?.kind ?? 'openai';
  const base = trimBase(provider.baseUrl || preset.baseUrl);
  const { signal, cleanup } = withTimeout(undefined, 20_000);

  try {
    let url: string;
    let headers: Record<string, string> = {};

    if (kind === 'anthropic') {
      url = `${base}/models?limit=100`;
      headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      };
    } else if (kind === 'gemini') {
      url = `${base}/models?key=${encodeURIComponent(apiKey)}&pageSize=100`;
    } else {
      url = `${base}/models`;
      headers = { Authorization: `Bearer ${apiKey}` };
    }

    const res = await fetch(url, { headers, signal });
    if (!res.ok) throw await toError(res);
    const json = (await res.json()) as any;

    if (kind === 'anthropic') {
      return (json.data ?? []).map((m: any) => m.id).filter(Boolean);
    }
    if (kind === 'gemini') {
      return (json.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => String(m.name ?? '').replace(/^models\//, ''))
        .filter(Boolean);
    }
    // OpenAI-compatible
    return (json.data ?? [])
      .map((m: any) => (typeof m === 'string' ? m : m?.id))
      .filter((id: unknown): id is string => typeof id === 'string' && id.length > 0)
      .sort();
  } catch (error) {
    if (error instanceof AiError) throw error;
    throw new AiError((error as Error).message || 'Could not list models', 'network');
  } finally {
    cleanup();
  }
}

export async function testConnection(
  provider: ProviderSettings,
  apiKey: string,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const models = await listModels(provider, apiKey);
    if (models.length > 0) {
      return { ok: true, message: `Connected. ${models.length} models available.` };
    }
    // Fall back to a 1-token completion for providers without a models endpoint.
    let text = '';
    for await (const delta of streamCompletion(provider, apiKey, {
      system: 'Reply with the single word: ok',
      user: 'ping',
      maxTokens: 8,
      temperature: 0,
    })) {
      text += delta;
    }
    return { ok: true, message: `Connected. Model replied: "${text.trim().slice(0, 20)}"` };
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }
}
