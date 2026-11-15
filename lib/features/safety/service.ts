import { browser } from 'wxt/browser';
import { getSettings, recordUsage } from '@/lib/data/storage';
import { checkAllowance, markConfirmed, recordActivity, type Allowance } from './limits';
import type { PlatformId } from '@/lib/core/types';
import { getAssistantState } from '@/lib/features/assistant/store';

export interface SubmitSlot {
  allowance: Allowance;
  id?: string;
}

let queue: Promise<unknown> = Promise.resolve();

/** One writer in the service worker: a check and its reservation cannot race across tabs. */
export function handleSubmissionMessage(message: any): Promise<SubmitSlot | { ok: true }> {
  const operation = queue.then(async () => {
    if (message.type === 'socialme:confirm-submit') {
      if (typeof message.id !== 'string') throw new Error('Invalid submission.');
      const platform = await markConfirmed(message.id);
      if (platform) await recordUsage(platform, 'submit');
      return { ok: true as const };
    }
    if (!['linkedin', 'x', 'facebook'].includes(message.platform)) throw new Error('Invalid platform.');
    const platform = message.platform as PlatformId;
    if (message.type === 'socialme:observe-submit') {
      if (typeof message.id !== 'string' || message.id.length > 100) throw new Error('Invalid submission.');
      await recordActivity(platform, 'submit', message.id);
      return { ok: true as const };
    }
    const settings = await getSettings();
    const allowance = await checkAllowance(platform, settings.safety);
    const assistant = await getAssistantState();
    if (assistant.paused[platform]) return { allowance: { ...allowance, allowed: false, reason: 'SocialMe is paused on this platform.' } };
    if (!settings.autoSubmit.enabled) return { allowance: { ...allowance, allowed: false, reason: 'Automatic sending is disabled in settings.' } };
    if (!allowance.allowed) return { allowance };
    const id = crypto.randomUUID();
    // Count attempts conservatively even if the platform never confirms delivery.
    await recordActivity(platform, 'submit', id);
    return { allowance, id };
  });
  queue = operation.catch(() => undefined);
  return operation;
}

export async function reserveSubmit(platform: PlatformId): Promise<SubmitSlot> {
  const response = await browser.runtime.sendMessage({ type: 'socialme:reserve-submit', platform });
  if (!response?.allowance) throw new Error(response?.error || 'Could not check sending limits. Try again.');
  return response as SubmitSlot;
}

export async function confirmSubmit(id: string): Promise<void> {
  const response = await browser.runtime.sendMessage({ type: 'socialme:confirm-submit', id });
  if (!response?.ok) throw new Error(response?.error || 'Could not update sending history.');
}
