import { useEffect, useState } from 'react';
import { ANGLES } from '@/lib/core/constants';
import type { Angle, Persona, PostContext } from '@/lib/core/types';
import { assistantAction, conversationKey, getAssistantState, watchAssistant, type AssistantState } from '@/lib/features/assistant/store';
import { conversationAdvice } from '@/lib/features/assistant/advice';
import { BookmarkForm } from './BookmarkForm';

export function ConversationAssistant({ post, persona, topics, onAngle }: {
  post: PostContext;
  persona: Persona;
  topics?: string;
  onAngle: (angle: Angle) => void;
}) {
  const [state, setState] = useState<AssistantState | null>(null);
  const [message, setMessage] = useState('');
  useEffect(() => {
    void getAssistantState().then(setState).catch(() => undefined);
    return watchAssistant(setState);
  }, []);
  const advice = conversationAdvice(post.text, [persona.niche, topics].filter(Boolean).join('\n'), state?.session?.goal);
  const key = conversationKey(post.platform, post.author, post.text);
  const reviewed = state?.session?.reviewed.includes(key);
  return (
    <div style={{ marginTop: 10, fontSize: 12 }}>
      <div className="ap-hint">{advice.reason}</div>
      <button type="button" className="ap-btn ap-btn--ghost" onClick={() => onAngle(advice.angle)}>Use {ANGLES.find((item) => item.id === advice.angle)?.label ?? 'Natural reply'}</button>
      {state?.session ? <div style={{ marginTop: 6 }}><span className="ap-hint">{Math.min(state.session.reviewed.length, state.session.target)} / {state.session.target} reviewed</span>{' '}<button type="button" className="ap-btn ap-btn--ghost" disabled={reviewed} onClick={() => { void assistantAction({ kind: 'reviewed', key }).then(setState).catch((error) => setMessage(error.message)); }}>{reviewed ? 'Marked reviewed' : 'Mark this conversation reviewed'}</button></div> : null}
      <details style={{ marginTop: 8 }}><summary style={{ cursor: 'pointer' }}>Save conversation / follow-up</summary><BookmarkForm panel platform={post.platform} url={post.url} author={post.author} excerpt={post.text.slice(0, 500)} /></details>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
