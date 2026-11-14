import { BANNED_OPENERS, CLICHE_WORDS } from '@/lib/core/constants';
import type { PlatformId } from '@/lib/core/types';

export interface QualityReport {
  chars: number;
  limit: number;
  overLimit: boolean;
  sentences: number;
  words: number;
  hasQuestion: boolean;
  hasNumber: boolean;
  emojiCount: number;
  cliches: string[];
  bannedOpener?: string;
  score: number;
  notes: string[];
  verdict: 'good' | 'ok' | 'weak';
}

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/gu;

export function analyzeDraft(
  text: string,
  platform: PlatformId,
  limit: number,
): QualityReport {
  const clean = text.trim();
  const lower = clean.toLowerCase();
  const chars = clean.length;
  const words = clean ? clean.split(/\s+/).length : 0;
  const sentences = clean
    ? clean.split(/[.!?…]+/).map((s) => s.trim()).filter(Boolean).length
    : 0;
  const emojiCount = (clean.match(EMOJI_RE) ?? []).length;
  const hasQuestion = /\?/.test(clean);
  const hasNumber = /\d/.test(clean);
  const cliches = CLICHE_WORDS.filter((w) => lower.includes(w));
  const bannedOpener = BANNED_OPENERS.find((opener) => lower.startsWith(opener));
  const overLimit = chars > limit;

  const notes: string[] = [];
  let score = 58;

  if (overLimit) {
    score -= 22;
    notes.push(`${chars - limit} characters over the ${limit} limit`);
  }
  if (bannedOpener) {
    score -= 18;
    notes.push(`Opens with "${bannedOpener}" — the most ignored comment type`);
  }
  if (cliches.length) {
    score -= Math.min(18, cliches.length * 6);
    notes.push(`Cliché words: ${cliches.slice(0, 3).join(', ')}`);
  }
  if (hasNumber) {
    score += 9;
    notes.push('Contains a concrete number');
  }
  if (hasQuestion && !/what do you think|curious to hear your thoughts/i.test(clean)) {
    score += 9;
    notes.push('Asks a real question');
  }
  if (words >= 12 && words <= 90) score += 7;
  if (words < 6) {
    score -= 8;
    notes.push('Very short — may read as low effort');
  }
  if (sentences >= 2) score += 3;
  if (/\b(I|my|me)\b/.test(clean)) score += 4;
  if (platform === 'linkedin' && chars >= 200) score += 4;
  if (platform === 'x' && chars <= 260) score += 4;
  if (emojiCount > 3) {
    score -= 6;
    notes.push('Too many emoji');
  }

  score = Math.max(0, Math.min(100, score));
  return {
    chars,
    limit,
    overLimit,
    sentences,
    words,
    hasQuestion,
    hasNumber,
    emojiCount,
    cliches,
    bannedOpener,
    score,
    notes,
    verdict: score >= 78 ? 'good' : score >= 60 ? 'ok' : 'weak',
  };
}
