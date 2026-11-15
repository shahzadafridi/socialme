import { browser } from 'wxt/browser';
import { MAX_HISTORY, PROVIDER_PRESETS, STORAGE_KEYS } from '@/lib/core/constants';
import { defaultSettings, mergeSettings } from '@/lib/core/defaults';
import { ASSISTANT_KEY, getAssistantState, parseAssistantState } from '@/lib/features/assistant/store';
import type {
  DraftActionPayload,
  HistoryItem,
  OutputMode,
  Persona,
  PlatformId,
  ProviderId,
  PublicSettings,
  Settings,
  UsageDay,
} from '@/lib/core/types';

type Secrets = Partial<Record<ProviderId, string>>;

async function read<T>(key: string): Promise<T | undefined> {
  const result = await browser.storage.local.get(key);
  return result[key] as T | undefined;
}

async function write(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function getSettings(): Promise<Settings> {
  const stored = await read<Settings>(STORAGE_KEYS.settings);
  if (!stored) return defaultSettings();
  const merged = mergeSettings(stored);
  // Persist the new persona seeds once, so a deleted built-in voice stays deleted
  // instead of being re-added on every read.
  if (stored.personaSeedVersion !== merged.personaSeedVersion) {
    await write(STORAGE_KEYS.settings, merged);
  }
  return merged;
}

export async function saveSettings(next: Settings): Promise<void> {
  await write(STORAGE_KEYS.settings, next);
}

let cached: Settings | null = null;

export async function getSettingsCached(): Promise<Settings> {
  if (cached) return cached;
  cached = await getSettings();
  return cached;
}

export function invalidateSettingsCache(): void {
  cached = null;
}

/** Listen for changes from the options page so content scripts stay in sync. */
export function watchSettings(onChange: (s: Settings) => void): () => void {
  const listener = (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    area: string,
  ) => {
    if (area !== 'local') return;
    if (!changes[STORAGE_KEYS.settings]) return;
    cached = null;
    getSettings()
      .then(onChange)
      .catch(() => undefined);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

/* ----------------------------- secrets ----------------------------- */

export async function getSecrets(): Promise<Secrets> {
  return (await read<Secrets>(STORAGE_KEYS.secrets)) ?? {};
}

export async function getApiKey(providerId: ProviderId): Promise<string> {
  const secrets = await getSecrets();
  const key = secrets[providerId];
  if (key) return key;
  // Local runtimes accept any string.
  if (PROVIDER_PRESETS[providerId]?.keyless) return 'local';
  return '';
}

export async function setApiKey(providerId: ProviderId, key: string): Promise<void> {
  const operation = secretQueue.then(async () => {
    const secrets = await getSecrets();
    if (key.trim()) secrets[providerId] = key.trim();
    else delete secrets[providerId];
    await write(STORAGE_KEYS.secrets, secrets);
  });
  secretQueue = operation.catch(() => undefined);
  return operation;
}

let secretQueue: Promise<void> = Promise.resolve();

/** Save the options page's complete snapshot in one storage operation. */
export async function setApiKeys(next: Secrets): Promise<void> {
  const secrets = Object.fromEntries(Object.entries(next)
    .filter(([id, key]) => id in PROVIDER_PRESETS && key?.trim())
    .map(([id, key]) => [id, key!.trim()]));
  const operation = secretQueue.then(() => write(STORAGE_KEYS.secrets, secrets));
  secretQueue = operation.catch(() => undefined);
  return operation;
}

export async function hasApiKey(providerId: ProviderId): Promise<boolean> {
  const preset = PROVIDER_PRESETS[providerId];
  if (preset?.keyless) return true;
  const secrets = await getSecrets();
  return Boolean(secrets[providerId]?.trim());
}

export async function maskApiKey(providerId: ProviderId): Promise<string> {
  const secrets = await getSecrets();
  const key = secrets[providerId];
  if (!key) return '';
  if (key.length <= 10) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/* ---------------------------- resolvers ---------------------------- */

export function resolvePersona(
  settings: Settings,
  platform: PlatformId,
  requestedId?: string,
): Persona {
  const byId = (id?: string) => settings.personas.find((p) => p.id === id);
  const platformId = settings.platformPersona[platform];
  return (
    byId(requestedId) ??
    byId(platformId) ??
    byId(settings.activePersonaId) ??
    settings.personas[0] ??
    defaultSettings().personas[0]
  );
}

export function resolveOutputMode(settings: Settings, platform: PlatformId): OutputMode {
  const per = settings.platformOutputMode[platform];
  return per && per !== 'inherit' ? per : settings.outputMode;
}

export async function getPublicSettings(): Promise<PublicSettings> {
  const settings = await getSettings();
  const provider =
    settings.providers.find((p) => p.id === settings.activeProvider) ?? settings.providers[0];
  return {
    evidence: [settings.brand.proof, settings.brand.stories].filter(Boolean).join('\n'),
    topics: settings.brand.pillars,
    activeProvider: provider.id,
    providerLabel: PROVIDER_PRESETS[provider.id]?.label ?? provider.id,
    model: provider.model,
    personas: settings.personas,
    activePersonaId: settings.activePersonaId,
    platformPersona: settings.platformPersona,
    platformTone: settings.platformTone,
    defaults: settings.defaults,
    outputMode: settings.outputMode,
    platformOutputMode: settings.platformOutputMode,
    autoSubmit: settings.autoSubmit,
    safety: settings.safety,
    theme: settings.theme,
    historyEnabled: settings.historyEnabled,
  };
}

/* ------------------------------ usage ------------------------------ */

export function todayKey(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function getUsage(): Promise<UsageDay> {
  const all = (await read<Record<string, UsageDay>>(STORAGE_KEYS.usage)) ?? {};
  return all[todayKey()] ?? { date: todayKey(), counts: {}, submitted: {} };
}

let usageQueue: Promise<unknown> = Promise.resolve();

export function recordUsage(platform: PlatformId, kind: 'generate' | 'submit'): Promise<UsageDay> {
  const operation = usageQueue.then(() => updateUsage(platform, kind));
  usageQueue = operation.catch(() => undefined);
  return operation;
}

async function updateUsage(
  platform: PlatformId,
  kind: 'generate' | 'submit',
): Promise<UsageDay> {
  const all = (await read<Record<string, UsageDay>>(STORAGE_KEYS.usage)) ?? {};
  // prune anything older than 60 days
  const cutoff = Date.now() - 60 * 24 * 3600 * 1000;
  for (const key of Object.keys(all)) {
    const day = all[key];
    const ts = new Date(`${day.date}T00:00:00`).getTime();
    if (Number.isFinite(ts) && ts < cutoff) delete all[key];
  }
  const key = todayKey();
  const day = all[key] ?? { date: key, counts: {}, submitted: {} };
  if (kind === 'submit') {
    day.submitted[platform] = (day.submitted[platform] ?? 0) + 1;
  } else {
    day.counts[platform] = (day.counts[platform] ?? 0) + 1;
  }
  all[key] = day;
  await write(STORAGE_KEYS.usage, all);
  return day;
}

/* ----------------------------- history ----------------------------- */

export async function addHistory(payload: DraftActionPayload): Promise<void> {
  const list = (await read<HistoryItem[]>(STORAGE_KEYS.history)) ?? [];
  const item: HistoryItem = {
    id: `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ts: Date.now(),
    platform: payload.platform,
    channel: payload.channel,
    personaId: payload.personaId,
    angle: payload.angle,
    postExcerpt: payload.postExcerpt.slice(0, 400),
    draft: payload.draft,
    submitted: payload.submitted,
  };
  list.unshift(item);
  await write(STORAGE_KEYS.history, list.slice(0, MAX_HISTORY));
}

export async function getHistory(): Promise<HistoryItem[]> {
  const raw =
    (await read<Array<HistoryItem & { task?: string }>>(STORAGE_KEYS.history)) ?? [];
  // Drafts stored before 0.6 carry `task`; keep comment replies, drop the removed
  // post/repurpose drafts so the panel never offers text it can no longer insert.
  return raw.flatMap((item) => {
    if (item.channel) return [item];
    if (!item.task || item.task === 'reply') return [{ ...item, channel: 'comment' as const }];
    return [];
  });
}

export async function clearHistory(): Promise<void> {
  await write(STORAGE_KEYS.history, []);
}

export async function saveLastDraft(text: string): Promise<void> {
  await write(STORAGE_KEYS.lastDraft, { text, ts: Date.now() });
}

export async function getLastDraft(): Promise<string> {
  const value = await read<{ text: string }>(STORAGE_KEYS.lastDraft);
  return value?.text ?? '';
}

/* ---------------------------- export/import ---------------------------- */

export async function exportAll(): Promise<string> {
  const settings = await getSettings();
  const history = await getHistory();
  const usage = await read<Record<string, UsageDay>>(STORAGE_KEYS.usage);
  const assistant = await getAssistantState();
  // Secrets are deliberately excluded from exports.
  return JSON.stringify({ exportedAt: new Date().toISOString(), settings, history, usage, assistant }, null, 2);
}

export async function importAll(json: string): Promise<void> {
  const parsed = JSON.parse(json) as { settings?: Settings; history?: HistoryItem[]; usage?: Record<string, UsageDay>; assistant?: unknown };
  if (!parsed.settings) throw new Error('File does not contain SocialMe settings.');
  if (parsed.settings.providers && !Array.isArray(parsed.settings.providers)) throw new Error('Invalid provider settings.');
  if (parsed.settings.personas && !Array.isArray(parsed.settings.personas)) throw new Error('Invalid voices.');
  if (parsed.history && (!Array.isArray(parsed.history) || parsed.history.some((item) =>
    !item || typeof item.draft !== 'string' || typeof item.ts !== 'number' || !['linkedin', 'x', 'facebook'].includes(item.platform)))) {
    throw new Error('Invalid draft history.');
  }
  if (parsed.usage && (typeof parsed.usage !== 'object' || Array.isArray(parsed.usage) || Object.values(parsed.usage).some((day) =>
    !day || typeof day.date !== 'string' || !day.counts || !day.submitted))) throw new Error('Invalid usage history.');
  const next = mergeSettings(parsed.settings);
  const assistant = parsed.assistant === undefined ? undefined : parseAssistantState(parsed.assistant);
  next.onboarded = true;
  next.providers = next.providers.map((p) => ({ ...p, apiKey: undefined }));
  await browser.storage.local.set({
    [STORAGE_KEYS.settings]: next,
    ...(parsed.history ? { [STORAGE_KEYS.history]: parsed.history.slice(0, MAX_HISTORY) } : {}),
    ...(parsed.usage ? { [STORAGE_KEYS.usage]: parsed.usage } : {}),
    ...(assistant ? { [ASSISTANT_KEY]: assistant } : {}),
  });
  invalidateSettingsCache();
}
