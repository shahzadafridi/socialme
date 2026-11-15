import type { ApprovedReplyExample, Channel, Persona, PlatformId, Settings } from '@/lib/core/types';

/** Topic lenses share one real identity and inherit the user's approved writing. */
export function writingIdentity(settings: Settings, selected: Persona): Persona {
  return settings.personas.find((p) => p.id === 'p_default') ?? selected;
}

/** Keep examples near the current topic, while favoring recent approved edits on ties. */
export function selectWritingSamples(text: string, source: string): string[] {
  const terms = new Set(source.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
  const samples = text.split(/\n\s*\n/).map((sample) => sample.trim()).filter(Boolean);
  const unique = [...new Set(samples)];
  return unique.map((sample, index) => ({ sample, index,
    score: [...new Set(sample.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])].filter((word) => terms.has(word)).length,
  })).sort((a, b) => b.score - a.score || b.index - a.index)
    .slice(0, 4).map(({ sample }) => sample.slice(0, 650));
}

/** Private-message examples never enter public-comment or connection-note prompts. */
export function selectReplyExamples(examples: ApprovedReplyExample[], source: string, channel: Channel, platform: PlatformId): ApprovedReplyExample[] {
  const terms = new Set(source.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []);
  const unique = new Map<string, ApprovedReplyExample>();
  for (const example of examples) {
    if (example.channel === channel) unique.set(`${example.platform}:${example.channel}:${example.source}:${example.reply}`, example);
  }
  return [...unique.values()].map((example) => ({ example,
    overlap: [...new Set(example.source.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])].filter((term) => terms.has(term)).length,
  })).sort((a, b) => b.overlap - a.overlap || Number(b.example.platform === platform) - Number(a.example.platform === platform) || b.example.savedAt - a.example.savedAt)
    .slice(0, 2).map(({ example }) => example);
}
