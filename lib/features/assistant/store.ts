import { browser } from 'wxt/browser';
import type { ApprovedReplyExample, PlatformId } from '@/lib/core/types';

export const ASSISTANT_KEY = 'socialme.assistant.v1';
export type EngagementGoal = 'relationships' | 'expertise' | 'reconnect';
export interface ConversationBookmark {
  id: string;
  platform: PlatformId;
  url: string;
  author: string;
  excerpt: string;
  note: string;
  dueAt?: number;
  completed: boolean;
  savedAt: number;
}
export interface AssistantState {
  session?: { goal: EngagementGoal; target: number; startedAt: number; reviewed: string[] };
  bookmarks: ConversationBookmark[];
  feedback: Record<string, { rules: string[]; samples: string[]; pairs?: ApprovedReplyExample[] }>;
  paused: Partial<Record<PlatformId, boolean>>;
}
export type AssistantAction =
  | { kind: 'start'; goal: EngagementGoal; target: number }
  | { kind: 'reviewed'; key: string }
  | { kind: 'bookmark'; bookmark: Omit<ConversationBookmark, 'id' | 'savedAt' | 'completed'> }
  | { kind: 'update-bookmark'; id: string; note: string; dueAt?: number; completed: boolean }
  | { kind: 'feedback'; personaId: string; rule?: string; sample?: string; pair?: Omit<ApprovedReplyExample, 'id' | 'savedAt'> }
  | { kind: 'remove-feedback'; personaId: string; value: string; field: 'rules' | 'samples' | 'pairs' }
  | { kind: 'pause'; platform: PlatformId; paused: boolean };

export async function getAssistantState(): Promise<AssistantState> {
  const result = await browser.storage.local.get(ASSISTANT_KEY);
  return parseAssistantState(result[ASSISTANT_KEY]);
}

let queue: Promise<unknown> = Promise.resolve();
const platforms = ['linkedin', 'x', 'facebook'];
const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function parseReplyExample(raw: Omit<ApprovedReplyExample, 'id' | 'savedAt'> & Partial<ApprovedReplyExample>): ApprovedReplyExample {
  if (!raw || !platforms.includes(raw.platform) || !['comment', 'dm', 'note'].includes(raw.channel)
    || !text(raw.source, 2000) || !text(raw.reply, 1200)) throw new Error('Provide the source and your approved reply, with a valid platform and reply type.');
  if (raw.reply.trim().length > 1200) throw new Error('Shorten the approved reply to 1,200 characters so its full meaning can be saved.');
  const source = raw.channel === 'dm' && typeof raw.source === 'string' ? raw.source.trim().slice(-2000) : text(raw.source, 2000);
  return { id: text(raw.id, 100) || crypto.randomUUID(), platform: raw.platform, channel: raw.channel,
    source, reply: text(raw.reply, 1200), savedAt: Number.isFinite(raw.savedAt) ? raw.savedAt! : Date.now() };
}

export function conversationUrl(platform: PlatformId, link: string): string {
  const url = new URL(link);
  const host = platform === 'linkedin' ? 'linkedin.com' : platform === 'facebook' ? 'facebook.com' : 'x.com';
  if (url.protocol !== 'https:' || url.username || url.password || !(url.hostname === host || url.hostname.endsWith(`.${host}`)
    || (platform === 'x' && /(^|\.)twitter\.com$/.test(url.hostname)))) throw new Error('Use a conversation link from the selected platform.');
  if (['/', '/feed', '/feed/', '/home', '/home/'].includes(url.pathname) && !url.searchParams.has('story_fbid')) throw new Error('Paste a direct conversation link so you can return to this thread.');
  return url.href;
}

/** Backups may contain personal notes, but never executable links or unchecked object keys. */
export function parseAssistantState(raw: unknown): AssistantState {
  if (raw === undefined || raw === null) return { bookmarks: [], feedback: {}, paused: {} };
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid assistant data.');
  const value = raw as Partial<AssistantState>;
  if (value.bookmarks !== undefined && !Array.isArray(value.bookmarks)) throw new Error('Invalid saved conversations.');
  const bookmarks = (value.bookmarks ?? []).slice(0, 100).map((item) => {
    if (!item || !platforms.includes(item.platform) || typeof item.id !== 'string' || typeof item.url !== 'string') throw new Error('Invalid saved conversation.');
    return { id: text(item.id, 100), platform: item.platform, url: conversationUrl(item.platform, item.url), author: text(item.author, 100),
      excerpt: text(item.excerpt, 500), note: text(item.note, 1000), completed: Boolean(item.completed),
      savedAt: Number.isFinite(item.savedAt) ? item.savedAt : Date.now(), dueAt: Number.isFinite(item.dueAt) ? item.dueAt : undefined };
  });
  const feedback: AssistantState['feedback'] = {};
  for (const [id, entry] of Object.entries(value.feedback ?? {}).slice(0, 100)) {
    if (['__proto__', 'constructor', 'prototype'].includes(id) || !entry || !Array.isArray(entry.rules) || !Array.isArray(entry.samples)) throw new Error('Invalid saved voice feedback.');
    if (entry.pairs !== undefined && !Array.isArray(entry.pairs)) throw new Error('Invalid paired writing examples.');
    feedback[id] = { rules: entry.rules.map((rule) => text(rule, 400)).filter(Boolean).slice(-8), samples: entry.samples.map((sample) => text(sample, 2000)).filter(Boolean).slice(-12),
      pairs: (entry.pairs ?? []).slice(-12).map(parseReplyExample) };
  }
  const paused: AssistantState['paused'] = {};
  for (const site of platforms as PlatformId[]) paused[site] = Boolean(value.paused?.[site]);
  const session = value.session;
  if (session && (!['relationships', 'expertise', 'reconnect'].includes(session.goal) || !Array.isArray(session.reviewed))) throw new Error('Invalid session.');
  return { bookmarks, feedback, paused, session: session ? {
    goal: session.goal, target: Math.max(1, Math.min(10, Number(session.target) || 3)), startedAt: Number.isFinite(session.startedAt) ? session.startedAt : Date.now(),
    reviewed: [...new Set(session.reviewed.map((key) => text(key, 300)).filter(Boolean))].slice(-100),
  } : undefined };
}

/** All mutations run in the background worker to preserve edits from multiple tabs. */
export function updateAssistant(action: AssistantAction): Promise<AssistantState> {
  const operation = queue.then(async () => {
    const state = await getAssistantState();
    switch (action.kind) {
      case 'start':
        if (!['relationships', 'expertise', 'reconnect'].includes(action.goal)) throw new Error('Choose a session goal.');
        state.session = { goal: action.goal, target: Math.max(1, Math.min(10, Number(action.target) || 3)), startedAt: Date.now(), reviewed: [] };
        break;
      case 'reviewed':
        if (state.session) state.session.reviewed = [...new Set([...state.session.reviewed, text(action.key, 300)])].filter(Boolean).slice(-100);
        break;
      case 'bookmark': {
        const item = action.bookmark;
        if (!item || !platforms.includes(item.platform)) throw new Error('Invalid conversation.');
        const url = conversationUrl(item.platform, item.url);
        const existing = state.bookmarks.find((saved) => saved.platform === item.platform && saved.url === url && saved.excerpt === text(item.excerpt, 500));
        const bookmark = { id: existing?.id ?? crypto.randomUUID(), platform: item.platform, url,
          author: text(item.author, 100), excerpt: text(item.excerpt, 500), note: text(item.note, 1000),
          dueAt: Number.isFinite(item.dueAt) ? item.dueAt : undefined, completed: false, savedAt: Date.now() };
        state.bookmarks = [bookmark, ...state.bookmarks.filter((saved) => saved.id !== bookmark.id)].slice(0, 100);
        break;
      }
      case 'update-bookmark':
        state.bookmarks = state.bookmarks.map((item) => item.id === action.id ? { ...item, note: text(action.note, 1000),
          dueAt: Number.isFinite(action.dueAt) ? action.dueAt : undefined, completed: Boolean(action.completed) } : item);
        break;
      case 'feedback': {
        const id = text(action.personaId, 100);
        if (!id || id === '__proto__' || id === 'constructor' || id === 'prototype') throw new Error('Select a voice.');
        const current = state.feedback[id] ?? { rules: [], samples: [] };
        const rule = text(action.rule, 400), sample = text(action.sample, 2000);
        const pair = action.pair ? parseReplyExample(action.pair) : undefined;
        const pairs = current.pairs ?? [];
        const samePair = (item: ApprovedReplyExample) => Boolean(pair && item.platform === pair.platform && item.channel === pair.channel && item.source === pair.source && item.reply === pair.reply);
        const previous = pairs.find(samePair);
        state.feedback[id] = {
          rules: rule ? [...new Set([...current.rules, rule])].slice(-8) : current.rules,
          samples: sample ? [...new Set([...current.samples, sample])].slice(-12) : current.samples,
          pairs: pair ? [...pairs.filter((item) => !samePair(item)), { ...pair, id: previous?.id ?? pair.id }].slice(-12) : pairs,
        };
        break;
      }
      case 'remove-feedback': {
        const current = state.feedback[action.personaId];
        if (current && action.field === 'pairs') current.pairs = (current.pairs ?? []).filter((pair) => pair.id !== action.value);
        else if (current && (action.field === 'rules' || action.field === 'samples')) current[action.field] = current[action.field].filter((value) => value !== action.value);
        break;
      }
      case 'pause':
        if (!platforms.includes(action.platform)) throw new Error('Invalid platform.');
        state.paused[action.platform] = Boolean(action.paused);
        break;
      default: throw new Error('Unknown assistant action.');
    }
    await browser.storage.local.set({ [ASSISTANT_KEY]: state });
    return state;
  });
  queue = operation.catch(() => undefined);
  return operation;
}

export async function assistantAction(action: AssistantAction): Promise<AssistantState> {
  const response = await browser.runtime.sendMessage({ type: 'socialme:assistant', action });
  if (!response?.state) throw new Error(response?.error || 'Could not save this change. Try again.');
  return response.state;
}

export function watchAssistant(onChange: (state: AssistantState) => void): () => void {
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === 'local' && changes[ASSISTANT_KEY]) void getAssistantState().then(onChange).catch(() => undefined);
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}

export function conversationKey(platform: PlatformId, author: string, source: string): string {
  let hash = 2166136261;
  for (const ch of `${platform}|${author}|${source}`) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619);
  return `${platform}:${(hash >>> 0).toString(36)}`;
}
