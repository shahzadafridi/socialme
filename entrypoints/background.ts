import { browser } from 'wxt/browser';
import { defineBackground } from 'wxt/utils/define-background';
import { AiError, streamCompletion } from '@/lib/core/ai/providers';
import { buildPrompt } from '@/lib/core/ai/prompt';
import {
  getApiKey,
  getSettings,
  invalidateSettingsCache,
  recordUsage,
  resolvePersona,
} from '@/lib/data/storage';
import type { GenerateRequest, PortMessage } from '@/lib/core/types';

export const MAX_REQUEST_CHARS = 12_000;

function sanitize(request: GenerateRequest): GenerateRequest {
  return {
    ...request,
    post: request.post
      ? { ...request.post, text: (request.post.text ?? '').slice(0, MAX_REQUEST_CHARS) }
      : undefined,
    extra: (request.extra ?? '').slice(0, 2_000),
    avoid: (request.avoid ?? []).slice(-3).map((d) => d.slice(0, 800)),
  };
}

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(async (details) => {
    invalidateSettingsCache();
    // Remove a debug key written by pre-0.5 builds.
    void browser.storage.local.remove('socialme.boot.v1');
    if (details.reason === 'install') {
      const settings = await getSettings();
      if (!settings.onboarded) {
        void browser.runtime.openOptionsPage();
      }
    }
  });

  browser.runtime.onMessage.addListener((message: any) => {
    if (message?.type === 'socialme:open-options') {
      void browser.runtime.openOptionsPage();
      return Promise.resolve({ ok: true });
    }
    if (message?.type === 'socialme:ping') {
      return Promise.resolve({ ok: true });
    }
    return undefined;
  });

  /**
   * Streaming generation port.
   * The content script owns the UI; the background owns the API key and the network call.
   */
  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== 'socialme:gen') return;

    let controller: AbortController | null = null;
    let closed = false;

    const send = (message: PortMessage) => {
      if (closed) return;
      try {
        port.postMessage(message);
      } catch {
        // port went away mid-stream
      }
    };

    port.onMessage.addListener(async (raw: any) => {
      if (raw?.type === 'cancel') {
        controller?.abort();
        return;
      }
      if (raw?.type !== 'start') return;

      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;

      try {
        const request = sanitize(raw.request as GenerateRequest);
        const settings = await getSettings();
        const provider =
          settings.providers.find((p) => p.id === settings.activeProvider) ??
          settings.providers[0];

        const apiKey = await getApiKey(provider.id);
        const persona = resolvePersona(settings, request.platform, request.personaId);
        const prompt = buildPrompt({
          request,
          persona,
          platform: request.platform,
          brand: settings.brand,
        });

        let full = '';
        for await (const delta of streamCompletion(provider, apiKey, {
          system: prompt.system,
          user: prompt.user,
          maxTokens: prompt.maxTokens,
          temperature: prompt.temperature,
          signal,
        })) {
          if (signal.aborted) break;
          full += delta;
          send({ type: 'delta', text: delta });
        }

        const cleaned = full.trim();
        if (!cleaned) {
          throw new AiError('The model returned an empty response. Try again.', 'empty');
        }

        void recordUsage(request.platform, 'generate');
        send({ type: 'done', text: cleaned });
      } catch (error) {
        const err = error as AiError;
        if (err?.code === 'aborted') {
          send({ type: 'error', error: 'Cancelled.', code: 'aborted' });
        } else {
          send({
            type: 'error',
            error: err?.message || 'Generation failed.',
            code: err?.code ?? 'unknown',
          });
        }
      }
    });

    port.onDisconnect.addListener(() => {
      closed = true;
      controller?.abort();
    });
  });
});
