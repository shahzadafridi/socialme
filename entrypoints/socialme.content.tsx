import { browser } from 'wxt/browser';
import { createRoot } from 'react-dom/client';
import { defineContentScript } from 'wxt/utils/define-content-script';
import { getAdapter } from '@/lib/integrations/index';
import { startWarningWatch } from '@/lib/features/safety/watch';
import { collectDiagnostics } from '@/lib/features/diagnostics';
import { getSettings, watchSettings } from '@/lib/data/storage';
import { installComposerButtons } from '@/lib/ui/composer/index';
import { checkPlatformHealth, saveHealth } from '@/lib/ui/composer/health';
import { App } from '@/lib/ui/App';
import styles from '@/lib/ui/theme.css?inline';

function mount(): void {
  const adapter = getAdapter();
  if (!adapter) return;
  if (!adapter.isSupportedPage()) return;
  if (document.getElementById('socialme-shadow-host')) return;

  const host = document.createElement('div');
  host.id = 'socialme-shadow-host';
  host.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 0',
    'height: 0',
    'z-index: 2147483000',
  ].join(';');

  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);
  document.documentElement.appendChild(host);

  try {
    createRoot(container).render(<App adapter={adapter} platform={adapter.id} />);
  } catch (error) {
    console.error('[SocialMe] failed to mount', error);
    host.remove();
    return;
  }

  const settingsRef = { composer: true };
  const syncInline = () => {
    getSettings()
      .then((settings) => {
        settingsRef.composer = settings.showComposerButton;
      })
      .catch(() => undefined);
  };
  syncInline();
  watchSettings(syncInline);

  const boot: string[] = [];
  const step = (name: string, fn: () => void) => {
    try {
      fn();
    } catch (error) {
      boot.push(`${name}: ${(error as Error)?.message ?? String(error)}`);
    }
  };

  step('warningWatch', () => startWarningWatch());
  step('composerButtons', () => installComposerButtons(adapter, () => settingsRef.composer));

  window.setTimeout(() => void collectDiagnostics(adapter, boot), 2500);
  window.setInterval(() => void collectDiagnostics(adapter, boot), 30000);

  // Health: what the adapters can reach right now. A redesign shows up here
  // (and in Options → Data) instead of failing silently for every user.
  const runHealth = () => {
    try {
      const health = checkPlatformHealth(adapter);
      void saveHealth(health);
      if (!health.ok) {
        console.warn('[SocialMe] composer health', health.problems.join('; '), health);
      }
    } catch (error) {
      console.warn('[SocialMe] health check failed', error);
    }
  };
  window.setTimeout(runHealth, 4000);
  window.setInterval(runHealth, 20000);
}

export default defineContentScript({
  matches: [
    '*://*.linkedin.com/*',
    '*://*.x.com/*',
    '*://*.twitter.com/*',
    '*://*.facebook.com/*',
  ],
  runAt: 'document_idle',
  main() {
    if (document.body) {
      mount();
    } else {
      window.addEventListener('DOMContentLoaded', mount, { once: true });
    }
  },
});
