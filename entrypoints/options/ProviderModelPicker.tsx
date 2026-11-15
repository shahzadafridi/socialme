import { useCallback, useEffect, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { listModels } from '@/lib/core/ai/providers';
import { providerOrigin, requestProviderAccess } from '@/lib/core/ai/access';
import { PROVIDER_PRESETS } from '@/lib/core/constants';
import type { ProviderSettings } from '@/lib/core/types';
import { Button, Input } from './ui';

export function ProviderModelPicker({ provider, apiKey, active, onChange }: {
  provider: ProviderSettings;
  apiKey: string;
  active: boolean;
  onChange: (model: string) => void;
}) {
  const [models, setModels] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error' | 'permission' | 'no-key'>('idle');
  const [message, setMessage] = useState('');
  const [manual, setManual] = useState(false);
  const current = useRef<AbortController | null>(null);
  const lastLoaded = useRef(0);
  const preset = PROVIDER_PRESETS[provider.id];
  const { id, baseUrl } = provider;
  const load = useCallback(async (allowPermission = false) => {
    if (current.current && !allowPermission) return;
    current.current?.abort();
    const run = new AbortController();
    current.current = run;
    if (!apiKey.trim() && !PROVIDER_PRESETS[id].keyless) {
      setStatus('no-key'); setMessage('Add your API key to load this provider’s models.'); current.current = null; return;
    }
    setStatus('loading'); setMessage('');
    try {
      if (allowPermission) await requestProviderAccess(baseUrl);
      else if (!await browser.permissions.contains({ origins: [providerOrigin(baseUrl)] })) {
        if (!run.signal.aborted) { setStatus('permission'); setMessage('Use Load models to allow access to this provider.'); }
        return;
      }
      run.signal.throwIfAborted();
      const result = await listModels({ ...provider, id, baseUrl }, apiKey.trim(), run.signal);
      if (current.current !== run || run.signal.aborted) return;
      setModels(result); setStatus('ready');
      lastLoaded.current = Date.now();
      setMessage(result.length ? `${result.length} models returned by ${PROVIDER_PRESETS[id].label}.` : 'No models returned. Local runtimes may need a model installed first, or you can enter an ID manually.');
    } catch (error) {
      if (current.current === run && !run.signal.aborted) { setStatus('error'); setMessage((error as Error).message); }
    } finally { if (current.current === run) current.current = null; }
  }, [id, baseUrl, apiKey]);

  useEffect(() => {
    current.current?.abort(); current.current = null;
    lastLoaded.current = 0;
    setModels([]); setStatus('idle'); setMessage('');
    return () => { current.current?.abort(); current.current = null; };
  }, [load]);
  useEffect(() => {
    const timer = active && Date.now() - lastLoaded.current > 300_000 ? window.setTimeout(() => void load(), 1000) : undefined;
    return () => window.clearTimeout(timer);
  }, [load, active]);

  const savedOutsideList = Boolean(provider.model && !models.includes(provider.model));
  return (
    <div>
      <select className="input input--mono" aria-label={`${preset.label} model`} value={provider.model}
        onFocus={() => { if (status === 'idle') void load(); }} onChange={(event) => onChange(event.target.value)} disabled={status === 'loading'}>
        {!provider.model ? <option value="" disabled>{status === 'loading' ? 'Loading models…' : 'Select a provider model'}</option> : null}
        {savedOutsideList ? <optgroup label={status === 'ready' ? 'Saved selection (not in returned list)' : 'Saved selection'}><option value={provider.model}>{provider.model}</option></optgroup> : null}
        {models.length ? <optgroup label="Models returned by provider">{models.map((model) => <option key={model} value={model}>{model}</option>)}</optgroup> : null}
      </select>
      <div className="row" style={{ marginTop: 6 }}>
        <Button small variant="ghost" disabled={status === 'loading'} onClick={() => void load(true)}>{status === 'loading' ? 'Loading models…' : status === 'ready' ? 'Refresh models' : 'Load models'}</Button>
        <Button small variant="ghost" onClick={() => setManual((value) => !value)}>{manual ? 'Hide manual ID' : 'Enter model ID manually'}</Button>
      </div>
      {manual ? <label style={{ display: 'block', marginTop: 8 }}><span className="field__hint">Manual model ID</span><Input value={provider.model} onChange={onChange} monospace placeholder="Exact ID for a custom endpoint or saved model" /></label> : null}
      <div role="status" aria-live="polite" className="field__hint" style={{ marginTop: 5 }}>
        {message || 'Models load from the provider after you add a key or select this provider.'}
      </div>
    </div>
  );
}
