import type { Angle } from '@/lib/core/types';
import type { EngagementGoal } from './store';

const COMMON = new Set(['with', 'from', 'that', 'this', 'your', 'their', 'about', 'software', 'engineering', 'developer', 'development', 'and', 'the', 'for', 'have', 'what', 'when', 'into']);

/** Transparent topic matching on text already visible to the user; no model call or feed crawling. */
export function conversationAdvice(source: string, interests: string, goal: EngagementGoal = 'relationships'): { angle: Angle; reason: string; matches: string[] } {
  const terms = [...new Set(interests.toLowerCase().match(/[\p{L}\p{N}+#]{2,}/gu) ?? [])]
    .filter((term) => !COMMON.has(term) && (term.length >= 3 || term === 'ai'));
  const sourceTerms = new Set(source.toLowerCase().match(/[\p{L}\p{N}+#]{2,}/gu) ?? []);
  const matches = terms.filter((term) => sourceTerms.has(term)).slice(0, 4);
  if (!matches.length) return { angle: 'natural', matches, reason: 'No clear match to your supplied topics. Reply only if you have something relevant to say.' };
  if (/\?/.test(source)) return { angle: 'tip', matches, reason: `Matches ${matches.join(', ')}. Answer their question with one useful detail, if you know it.` };
  if (goal === 'expertise') return { angle: 'insight', matches, reason: `Matches ${matches.join(', ')}. A small practical observation could add to this discussion.` };
  return { angle: 'natural', matches, reason: `Matches ${matches.join(', ')}. Respond to one point in your everyday voice; a question is optional.` };
}
