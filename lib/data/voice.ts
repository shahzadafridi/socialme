import type { Persona, Settings } from '@/lib/core/types';
import { writingIdentity } from '@/lib/core/ai/voice';
import { getAssistantState } from '@/lib/features/assistant/store';

export async function loadWritingVoice(settings: Settings, selected: Persona) {
  const assistant = await getAssistantState();
  const withFeedback = (persona: Persona): Persona => ({ ...persona,
    samplePosts: [persona.samplePosts, ...(assistant.feedback[persona.id]?.samples ?? [])].filter(Boolean).join('\n\n'),
    voiceFeedback: [...(persona.voiceFeedback ?? []), ...(assistant.feedback[persona.id]?.rules ?? [])],
    replyExamples: [...(persona.replyExamples ?? []), ...(assistant.feedback[persona.id]?.pairs ?? [])],
  });
  return { persona: withFeedback(selected), identity: withFeedback(writingIdentity(settings, selected)) };
}
