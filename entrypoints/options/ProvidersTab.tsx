import { useState } from 'react';
import { PROVIDER_PRESETS } from '@/lib/core/constants';
import { testConnection } from '@/lib/core/ai/providers';
import { requestProviderAccess } from '@/lib/core/ai/access';
import type { ProviderId, Settings } from '@/lib/core/types';
import { Button, Card, Field, Input, Note, Slider } from '@/entrypoints/options/ui';
import { ProviderModelPicker } from './ProviderModelPicker';

type TestState = { state: 'idle' | 'testing' | 'ok' | 'error'; message?: string };

export function ProvidersTab({
  settings,
  secrets,
  onProvider,
  onActive,
  onSecret,
}: {
  settings: Settings;
  secrets: Partial<Record<ProviderId, string>>;
  onProvider: (id: ProviderId, patch: Partial<Settings['providers'][number]>) => void;
  onActive: (id: ProviderId) => void;
  onSecret: (id: ProviderId, value: string) => void;
}) {
  const [tests, setTests] = useState<Partial<Record<ProviderId, TestState>>>({});
  const [reveal, setReveal] = useState<Partial<Record<ProviderId, boolean>>>({});

  const runTest = async (id: ProviderId) => {
    const provider = settings.providers.find((p) => p.id === id);
    if (!provider) return;
    setTests((prev) => ({ ...prev, [id]: { state: 'testing' } }));
    let result;
    try {
      await requestProviderAccess(provider.baseUrl);
      result = await testConnection(provider, secrets[id] ?? '');
    } catch (error) { result = { ok: false, message: (error as Error).message }; }
    setTests((prev) => ({
      ...prev,
      [id]: { state: result.ok ? 'ok' : 'error', message: result.message },
    }));
  };

  return (
    <>
      <div>
        <h1>AI provider</h1>
        <p className="lede">
          SocialMe calls the model directly from your browser with your own API key. The key is stored
          in <code>chrome.storage.local</code> on this device and is sent only to the provider you pick.
        </p>
      </div>

      <Note>
        Comments and message replies are generated with short prompts, so a cheap model is usually enough.
        DeepSeek or GPT-4o-mini cost a fraction of a cent per draft. Use a stronger model only if the
        drafts feel flat.
      </Note>

      {settings.providers.map((provider) => {
        const preset = PROVIDER_PRESETS[provider.id];
        const active = provider.id === settings.activeProvider;
        const test = tests[provider.id] ?? { state: 'idle' as const };

        return (
          <div className="provider" key={provider.id} data-active={active}>
            <div className="provider__head">
              <span
                className="provider__radio"
                data-active={active}
                role="radio"
                aria-checked={active}
                tabIndex={0}
                onClick={() => onActive(provider.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') onActive(provider.id);
                }}
              />
              <span className="provider__name">{preset.label}</span>
              {active ? <span className="provider__badge">active</span> : null}
              {preset.keyUrl ? (
                <a
                  href={preset.keyUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)' }}
                >
                  Get a key →
                </a>
              ) : null}
            </div>

            <div className="provider__body">
              {preset.hint ? (
                <div style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>
                  {preset.hint}
                </div>
              ) : null}

              {!preset.keyless ? (
                <Field label="API key">
                  <div className="row">
                    <div style={{ flex: 1 }}>
                      <Input
                        value={secrets[provider.id] ?? ''}
                        onChange={(value) => onSecret(provider.id, value)}
                        placeholder={provider.id === 'openai' ? 'sk-…' : 'Paste your key'}
                        password={!reveal[provider.id]}
                        monospace
                      />
                    </div>
                    <Button
                      small
                      variant="ghost"
                      onClick={() =>
                        setReveal((prev) => ({ ...prev, [provider.id]: !prev[provider.id] }))
                      }
                    >
                      {reveal[provider.id] ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </Field>
              ) : null}

              <div className="grid-2">
                <div className="field">
                  <span className="field__label">Model</span>
                  <ProviderModelPicker provider={provider} apiKey={secrets[provider.id] ?? ''} active={active} onChange={(model) => onProvider(provider.id, { model })} />
                </div>
                <Field label="Base URL" hint="For a new host, use Test connection to grant access.">
                  <Input
                    value={provider.baseUrl}
                    onChange={(value) => onProvider(provider.id, { baseUrl: value })}
                    placeholder={preset.baseUrl}
                    monospace
                  />
                </Field>
              </div>

              <Field label="Creativity (temperature)">
                <Slider
                  value={provider.temperature}
                  min={0}
                  max={1.3}
                  step={0.05}
                  onChange={(value) => onProvider(provider.id, { temperature: value })}
                  format={(value) => value.toFixed(2)}
                />
              </Field>

              <div className="provider__actions">
                <Button small onClick={() => void runTest(provider.id)} disabled={test.state === 'testing'}>
                  {test.state === 'testing' ? 'Testing…' : 'Test connection'}
                </Button>
                {test.state !== 'idle' && test.state !== 'testing' ? (
                  <span className="provider__result" data-ok={test.state === 'ok'}>
                    {test.state === 'ok' ? '✓ ' : '✕ '}
                    {test.message}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}
