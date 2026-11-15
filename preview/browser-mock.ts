/** Browser API mock so the React UI can run outside the extension. */
import { defaultSettings, makeProvider } from '@/lib/core/defaults';
import type { ProviderId, Settings } from '@/lib/core/types';
import { handleSubmissionMessage } from '@/lib/features/safety/service';
import { updateAssistant } from '@/lib/features/assistant/store';

const settings: Settings = {
  ...defaultSettings(),
  onboarded: true,
  activeProvider: 'deepseek',
  providers: defaultSettings().providers.map((p) => ({
    ...p,
    model: p.id === 'deepseek' ? 'deepseek-chat' : p.model,
  })),
};

settings.personas[0] = {
  ...settings.personas[0],
  name: 'My voice',
  role: 'Founder of a small software studio',
  niche: 'Product, growth and shipping software',
  audience: 'founders and product people',
  styleNotes:
    'Short sentences. Concrete examples over abstractions. Never pitch in comments. One idea per paragraph.',
  replyMaxChars: 700,
};

const store: Record<string, unknown> = {
  'socialme.settings.v1': settings,
  'socialme.usage.v1': {
    [new Date().toISOString().slice(0, 10)]: {
      date: new Date().toISOString().slice(0, 10),
      counts: { linkedin: 9, x: 4, facebook: 1 },
      submitted: { linkedin: 3, x: 1 },
    },
  },
  'socialme.lastDraft.v1': {
    text: 'We cut our release cycle from 3 weeks to 4 days by deleting the staging branch entirely.',
    ts: Date.now(),
  },
  'socialme.secrets.v1': { deepseek: 'sk-demo-key-not-real-000000' },
};

const listeners: Array<(changes: any, area: string) => void> = [];

export const browser = {
  permissions: { async request() { return true; }, async contains() { return true; } },
  storage: {
    local: {
      async get(key: string) {
        if (typeof key === 'string') return { [key]: store[key] };
        return { ...store };
      },
      async set(items: Record<string, unknown>) {
        Object.assign(store, items);
        listeners.forEach((fn) =>
          fn(
            Object.fromEntries(Object.keys(items).map((k) => [k, { newValue: items[k] }])),
            'local',
          ),
        );
      },
      async remove(key: string) {
        delete store[key];
      },
    },
    onChanged: {
      addListener(fn: (changes: any, area: string) => void) {
        listeners.push(fn);
      },
      removeListener(fn: (changes: any, area: string) => void) {
        const index = listeners.indexOf(fn);
        if (index >= 0) listeners.splice(index, 1);
      },
    },
  },
  runtime: {
    getManifest() {
      return { version: '0.7.0' };
    },
    async sendMessage(message: any) {
      if (message?.type === 'socialme:assistant') return { state: await updateAssistant(message.action) };
      if (['socialme:reserve-submit', 'socialme:observe-submit', 'socialme:confirm-submit'].includes(message?.type)) return handleSubmissionMessage(message);
      return { ok: true };
    },
    async openOptionsPage() {
      console.log('[preview] openOptionsPage');
    },
    connect() {
      const handlers: Array<(message: any) => void> = [];
      const disconnectHandlers: Array<() => void> = [];
      let timer: number | undefined;

      const sample =
        'This is the part most teams get wrong: the bottleneck is rarely the code. It is the three approvals between a good idea and a deploy. We cut ours from five to one and shipping stopped feeling like a project.';

      return {
        name: 'amplify:gen',
        postMessage(message: any) {
          if (message.type === 'cancel') {
            if (timer) window.clearInterval(timer);
            return;
          }
          let index = 0;
          timer = window.setInterval(() => {
            if (index >= sample.length) {
              window.clearInterval(timer);
              handlers.forEach((fn) => fn({ type: 'done', text: sample }));
              return;
            }
            const chunk = sample.slice(index, index + 4);
            index += 4;
            handlers.forEach((fn) => fn({ type: 'delta', text: chunk }));
          }, 24);
        },
        onMessage: {
          addListener(fn: (message: any) => void) {
            handlers.push(fn);
          },
        },
        onDisconnect: {
          addListener(fn: () => void) {
            disconnectHandlers.push(fn);
          },
        },
        disconnect() {
          if (timer) window.clearInterval(timer);
          disconnectHandlers.forEach((fn) => fn());
        },
      };
    },
  },
  tabs: {
    async create() {
      return {};
    },
  },
};

export type { ProviderId };
