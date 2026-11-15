import { browser } from 'wxt/browser';
import { STORAGE_KEYS } from '@/lib/core/constants';
import type { ActivityEvent, PlatformId, SafetySettings } from '@/lib/core/types';

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;
const KEEP = 7 * DAY;

async function readAll(): Promise<ActivityEvent[]> {
  const result = await browser.storage.local.get(STORAGE_KEYS.activity);
  const raw = (result[STORAGE_KEYS.activity] as ActivityEvent[] | undefined) ?? [];
  const cutoff = Date.now() - KEEP;
  return raw.filter((event) => event && event.ts > cutoff);
}

export async function recordActivity(
  platform: PlatformId,
  kind: ActivityEvent['kind'],
  id?: string,
): Promise<void> {
  const events = await readAll();
  if (id && events.some((event) => event.id === id)) return;
  events.push({ ts: Date.now(), platform, kind, id });
  const cutoff = Date.now() - KEEP;
  await browser.storage.local.set({ [STORAGE_KEYS.activity]: events.filter((event) => event.ts > cutoff) });
}

export async function getActivity(): Promise<ActivityEvent[]> {
  return [...(await readAll())];
}

/** Called only by the background's serialized submission service. */
export async function markConfirmed(id: string): Promise<PlatformId | null> {
  const events = await readAll();
  const event = events.find((item) => item.id === id && item.kind === 'submit');
  if (!event || event.confirmed) return null;
  event.confirmed = true;
  await browser.storage.local.set({ [STORAGE_KEYS.activity]: events });
  return event.platform;
}

export interface Allowance {
  allowed: boolean;
  reason?: string;
  retryInSec?: number;
  dailyLeft: number;
  hourlyLeft: number;
  gapLeftSec: number;
}

/**
 * Decides whether another comment/post may be sent right now.
 * Deliberately conservative: a throttled account has no reach at all.
 */
export async function checkAllowance(
  platform: PlatformId,
  safety: SafetySettings,
  now = Date.now(),
): Promise<Allowance> {
  const events = await readAll();
  const submits = events.filter((event) => event.kind === 'submit');
  const platformSubmits = submits.filter((event) => event.platform === platform);

  const inDay = submits.filter((event) => now - event.ts < DAY);
  const inHour = submits.filter((event) => now - event.ts < HOUR);
  const lastOnPlatform = platformSubmits.reduce<ActivityEvent | null>(
    (latest, event) => (!latest || event.ts > latest.ts ? event : latest),
    null,
  );

  // Ramp for a fresh account: the first warmupDays use half the caps.
  const first = submits.reduce<number | null>(
    (earliest, event) => (earliest === null || event.ts < earliest ? event.ts : earliest),
    null,
  );
  const warmingUp =
    safety.warmupDays > 0 && first !== null && now - first < safety.warmupDays * DAY;
  const dailyCap = warmingUp
    ? Math.max(1, Math.ceil(safety.maxActionsPerDay / 2))
    : safety.maxActionsPerDay;
  const hourlyCap = warmingUp
    ? Math.max(1, Math.ceil(safety.maxActionsPerHour / 2))
    : safety.maxActionsPerHour;

  const dailyLeft = Math.max(0, dailyCap - inDay.length);
  const hourlyLeft = Math.max(0, hourlyCap - inHour.length);
  const gapLeftSec = lastOnPlatform
    ? Math.max(0, Math.ceil((safety.minActionGapSec * 1000 - (now - lastOnPlatform.ts)) / 1000))
    : 0;

  if (dailyLeft <= 0) {
    const oldest = inDay.reduce((min, event) => Math.min(min, event.ts), now);
    return {
      allowed: false,
      reason: warmingUp
        ? `Warm-up limit reached (${dailyCap}/day while the account is new).`
        : `Daily limit reached (${dailyCap} actions). Reach is better protected by stopping here.`,
      retryInSec: Math.ceil((DAY - (now - oldest)) / 1000),
      dailyLeft,
      hourlyLeft,
      gapLeftSec,
    };
  }

  if (hourlyLeft <= 0) {
    const oldest = inHour.reduce((min, event) => Math.min(min, event.ts), now);
    return {
      allowed: false,
      reason: `Hourly limit reached (${hourlyCap} actions). Give the account a break.`,
      retryInSec: Math.ceil((HOUR - (now - oldest)) / 1000),
      dailyLeft,
      hourlyLeft,
      gapLeftSec,
    };
  }

  if (gapLeftSec > 0) {
    return {
      allowed: false,
      reason: `Too soon after the last action. Wait ${gapLeftSec}s — instant repeats look automated.`,
      retryInSec: gapLeftSec,
      dailyLeft,
      hourlyLeft,
      gapLeftSec,
    };
  }

  return { allowed: true, dailyLeft, hourlyLeft, gapLeftSec };
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  return `${Math.ceil(seconds / 3600)} h`;
}
