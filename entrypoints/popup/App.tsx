import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { PLATFORMS, PROVIDER_PRESETS } from '@/lib/core/constants';
import { getLastDraft, getPublicSettings, getUsage, hasApiKey } from '@/lib/data/storage';
import type { PlatformId, PublicSettings, UsageDay } from '@/lib/core/types';
import { getAssistantState, watchAssistant, type AssistantState } from '@/lib/features/assistant/store';

export function PopupApp() {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [usage, setUsage] = useState<UsageDay | null>(null);
  const [keyed, setKeyed] = useState(true);
  const [lastDraft, setLastDraft] = useState('');
  const [assistant, setAssistant] = useState<AssistantState | null>(null);
  useEffect(() => {
    void getAssistantState().then(setAssistant).catch(() => undefined);
    return watchAssistant(setAssistant);
  }, []);

  useEffect(() => {
    getPublicSettings()
      .then(async (next) => {
        setSettings(next);
        setKeyed(await hasApiKey(next.activeProvider));
      })
      .catch(() => undefined);
    getUsage().then(setUsage).catch(() => undefined);
    getLastDraft().then(setLastDraft).catch(() => undefined);
  }, []);

  const personaName =
    settings?.personas.find((p) => p.id === settings.activePersonaId)?.name ?? '—';

  const openSettings = () => {
    void browser.runtime.openOptionsPage();
    window.close();
  };

  const openSite = (platform: PlatformId) => {
    const urls: Record<PlatformId, string> = {
      linkedin: 'https://www.linkedin.com/feed/',
      x: 'https://x.com/home',
      facebook: 'https://www.facebook.com/',
    };
    void browser.tabs.create({ url: urls[platform] });
    window.close();
  };

  return (
    <div className="pop">
      <header className="pop__head">
        <div className="pop__mark">✦</div>
        <div>
          <div className="pop__name">SocialMe</div>
          <div className="pop__sub">
            {settings ? `${settings.providerLabel} · ${settings.model || 'no model'}` : '…'}
          </div>
        </div>
      </header>

      {!keyed ? (
        <div className="pop__warn">
          No API key for {settings ? PROVIDER_PRESETS[settings.activeProvider]?.label : 'the provider'}.
          <button onClick={openSettings}>Add one</button>
        </div>
      ) : null}

      <div className="pop__rows">
        <div className="pop__row">
          <span>Voice</span>
          <b>{personaName}</b>
        </div>
        <div className="pop__row">
          <span>Mode</span>
          <b>{settings?.outputMode ?? '—'}</b>
        </div>
        <div className="pop__row">
          <span>Send actions observed</span>
          <b>
            {usage
              ? Object.values(usage.submitted).reduce<number>((sum, n) => sum + (n ?? 0), 0)
              : 0}
          </b>
        </div>
      </div>
      <div className="pop__rows">
        <div className="pop__row"><span>Follow-ups due</span><b>{assistant?.bookmarks.filter((item) => !item.completed && item.dueAt && item.dueAt <= Date.now()).length ?? 0}</b></div>
        {assistant?.session ? <div className="pop__row"><span>Conversations reviewed</span><b>{Math.min(assistant.session.reviewed.length, assistant.session.target)} / {assistant.session.target}</b></div> : null}
      </div>

      <div className="pop__sites">
        {(['linkedin', 'x', 'facebook'] as PlatformId[]).map((platform) => (
          <button key={platform} onClick={() => openSite(platform)} title={`Open ${PLATFORMS[platform].label}`}>
            {PLATFORMS[platform].label}
          </button>
        ))}
      </div>

      {lastDraft ? (
        <button
          className="pop__draft"
          onClick={() => {
            void navigator.clipboard.writeText(lastDraft);
            window.close();
          }}
          title="Copy the most recent draft"
        >
          <span>Copy last draft</span>
          <small>{lastDraft.slice(0, 60)}…</small>
        </button>
      ) : null}

      <footer className="pop__foot">
        <button className="pop__primary" onClick={openSettings}>
          Open my engagement assistant
        </button>
        <div className="pop__hint">
          Open any post and press <kbd>⌘</kbd>
          <kbd>⇧</kbd>
          <kbd>A</kbd> to reply in your voice.
        </div>
      </footer>
    </div>
  );
}
