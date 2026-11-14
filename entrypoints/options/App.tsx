import { browser } from 'wxt/browser';
import { useEffect, useRef, useState } from 'react';
import { APP_NAME, PROVIDER_PRESETS } from '@/lib/core/constants';
import {
  getSecrets,
  getSettings,
  saveSettings,
  setApiKey,
  invalidateSettingsCache,
} from '@/lib/data/storage';
import type { Persona, ProviderId, Settings } from '@/lib/core/types';
import { DataTab } from '@/entrypoints/options/DataTab';
import { DefaultsTab } from '@/entrypoints/options/DefaultsTab';
import { BrandTab } from '@/entrypoints/options/BrandTab';
import { PersonasTab } from '@/entrypoints/options/PersonasTab';
import { SafetyTab } from '@/entrypoints/options/SafetyTab';
import { ProvidersTab } from '@/entrypoints/options/ProvidersTab';
import './style.css';

export type TabId = 'providers' | 'brand' | 'personas' | 'defaults' | 'safety' | 'data';

const TABS: Array<{ id: TabId; label: string; glyph: string }> = [
  { id: 'providers', label: 'AI provider', glyph: '◈' },
  { id: 'brand', label: 'Brand', glyph: '◆' },
  { id: 'personas', label: 'Voice', glyph: '◇' },
  { id: 'defaults', label: 'Defaults', glyph: '≡' },
  { id: 'safety', label: 'Safety & reach', glyph: '⚑' },
  { id: 'data', label: 'Data', glyph: '⤓' },
];

export function OptionsApp({ initialTab }: { initialTab?: TabId } = {}) {
  const [tab, setTab] = useState<TabId>(initialTab ?? 'providers');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [secrets, setSecrets] = useState<Partial<Record<ProviderId, string>>>({});
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const firstRun = useRef(true);

  useEffect(() => {
    Promise.all([getSettings(), getSecrets()])
      .then(([nextSettings, nextSecrets]) => {
        setSettings(nextSettings);
        setSecrets(nextSecrets);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded || !settings) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setSaveState('saving');
    const timer = window.setTimeout(async () => {
      try {
        await saveSettings(settings);
        await Promise.all(
          (Object.entries(secrets) as Array<[ProviderId, string]>).map(([id, key]) =>
            setApiKey(id, key ?? ''),
          ),
        );
        invalidateSettingsCache();
        setSaveState('saved');
        setSaveError('');
      } catch (error) {
        setSaveState('error');
        setSaveError((error as Error).message);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [settings, secrets, loaded]);

  if (!settings) {
    return <div style={{ padding: 40, color: 'var(--muted)' }}>Loading…</div>;
  }

  const onChange = (patch: Partial<Settings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  };

  const onProvider = (id: ProviderId, patch: Partial<Settings['providers'][number]>) => {
    setSettings((current) =>
      current
        ? {
            ...current,
            providers: current.providers.map((provider) =>
              provider.id === id ? { ...provider, ...patch } : provider,
            ),
          }
        : current,
    );
  };

  const activeProvider = settings.providers.find((p) => p.id === settings.activeProvider);

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <div className="brand__mark">✦</div>
          <div>
            <div className="brand__name">{APP_NAME}</div>
            <div className="brand__ver">v{browser.runtime.getManifest().version} · local-first</div>
          </div>
        </div>

        {TABS.map((item) => (
          <button
            key={item.id}
            className="nav-item"
            data-active={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            <span className="nav-glyph">{item.glyph}</span>
            {item.label}
          </button>
        ))}

        <div className="side__foot">
          Open a post on LinkedIn, X or Facebook and press{' '}
          <span className="kbd">⌘</span>
          <span className="kbd">⇧</span>
          <span className="kbd">A</span> to write with the current persona.
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <span className="topbar__spacer" />
          <span className="save" data-state={saveState}>
            {saveState === 'saving'
              ? 'Saving…'
              : saveState === 'saved'
                ? '✓ Saved'
                : saveState === 'error'
                  ? saveError
                  : ''}
          </span>
        </div>

        <div className="content">
          {!settings.onboarded ? (
            <div className="card" style={{ borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))' }}>
              <div className="card__head">
                <div>
                  <h2 className="card__title">Welcome to SocialMe</h2>
                  <p className="card__desc">
                    Three steps: pick a provider and paste a key, tune one persona, then start a
                    comment or a message and hit <b>✦</b>. Drafts stream in your voice and you
                    decide what gets sent.
                  </p>
                </div>
                <button
                  className="btn btn--sm btn--primary"
                  onClick={() => onChange({ onboarded: true })}
                >
                  Got it
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'providers' ? (
            <ProvidersTab
              settings={settings}
              secrets={secrets}
              onProvider={onProvider}
              onActive={(id) => onChange({ activeProvider: id })}
              onSecret={(id, value) => setSecrets((current) => ({ ...current, [id]: value }))}
            />
          ) : null}

          {tab === 'personas' ? (
            <PersonasTab
              settings={settings}
              onChange={(patch) => onChange({ ...patch } as Partial<Settings>)}
            />
          ) : null}

          {tab === 'brand' ? <BrandTab settings={settings} onChange={onChange} /> : null}
          {tab === 'defaults' ? <DefaultsTab settings={settings} onChange={onChange} /> : null}
          {tab === 'safety' ? <SafetyTab settings={settings} onChange={onChange} /> : null}
          {tab === 'data' ? <DataTab onChange={onChange} /> : null}

          <div style={{ fontSize: 11.5, color: 'var(--faint)', marginTop: 8 }}>
            Active model: {activeProvider?.model || '—'} ·{' '}
            {PROVIDER_PRESETS[settings.activeProvider]?.label ?? settings.activeProvider}
          </div>
        </div>
      </main>
    </div>
  );
}

export type { Persona };
