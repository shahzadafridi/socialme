import { useEffect, useState } from 'react';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import type { PublicSettings } from '@/lib/core/types';
import { conversationAdvice } from '@/lib/features/assistant/advice';
import { assistantAction, getAssistantState, watchAssistant, type AssistantState, type EngagementGoal } from '@/lib/features/assistant/store';
import { openOptionsPage } from './util';

export function FeedGuide({ adapter, settings, onSelect, onClose }: {
  adapter: PlatformAdapter;
  settings: PublicSettings;
  onSelect: (el: HTMLElement) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<AssistantState | null>(null);
  const [goal, setGoal] = useState<EngagementGoal>('relationships');
  const [posts, setPosts] = useState<Array<{ el: HTMLElement; author: string; text: string; reason: string; matches: number }>>([]);
  const [message, setMessage] = useState('');
  const identity = settings.personas.find((p) => p.id === 'p_default') ?? settings.personas[0];
  const interests = [identity.niche, settings.topics].filter(Boolean).join('\n');
  const refresh = () => {
    try {
      setPosts(adapter.findPosts().flatMap((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return [];
        const post = adapter.readPost(el);
        if (!post) return [];
        const advice = conversationAdvice(post.text, interests, state?.session?.goal ?? goal);
        return [{ el, author: post.author, text: post.text, reason: advice.reason, matches: advice.matches.length }];
      }).sort((a, b) => b.matches - a.matches).slice(0, 5));
    } catch { setMessage('Could not read visible conversations. Hover over a post and try again.'); }
  };
  useEffect(() => {
    void getAssistantState().then(setState).catch(() => undefined);
    return watchAssistant(setState);
  }, []);
  useEffect(refresh, [adapter, interests, state?.session?.goal, goal]);
  return (
    <div className="ap-panel" role="dialog" aria-label="SocialMe engagement assistant">
      <div className="ap-head"><b>Help me engage</b><div className="ap-head__spacer" /><button className="ap-btn" onClick={onClose} aria-label="Close assistant">Close</button></div>
      <div className="ap-body">
        <p className="ap-hint">Choose a conversation where you have something useful to say. Suggestions use topic words in visible text.</p>
        <label className="ap-label">Session goal<select className="ap-input" value={goal} onChange={(event) => setGoal(event.target.value as EngagementGoal)}><option value="relationships">Build relationships</option><option value="expertise">Share useful expertise</option><option value="reconnect">Continue a conversation</option></select></label>
        <button className="ap-btn ap-btn--primary" onClick={() => { void assistantAction({ kind: 'start', goal, target: 3 }).then(setState).catch((error) => setMessage(error.message)); }}>Start a 3-conversation session</button>
        {state?.session ? <p className="ap-hint">{Math.min(state.session.reviewed.length, state.session.target)} / {state.session.target} conversations marked reviewed</p> : null}
        {goal === 'reconnect' ? <button className="ap-btn" onClick={openOptionsPage}>Open saved conversations and follow-ups</button> : null}
        <div className="ap-label" style={{ marginTop: 12 }}>Conversations visible on this page</div>
        {posts.map((post, index) => <button key={index} className="ap-history__item" style={{ width: '100%', margin: '6px 0', display: 'block', textAlign: 'left' }} onClick={() => post.el.isConnected ? onSelect(post.el) : refresh()}>
          <b>{post.author}</b><p style={{ whiteSpace: 'normal' }}>{post.text.slice(0, 180)}{post.text.length > 180 ? '…' : ''}</p><span className="ap-hint">{post.reason}</span>
        </button>)}
        {!posts.length ? <p className="ap-hint">No readable posts found. Open a feed or post, then refresh this list.</p> : null}
        <button className="ap-btn" onClick={refresh}>Refresh visible posts</button>
        {message ? <p role="status">{message}</p> : null}
      </div>
      <div className="ap-foot"><button className="ap-btn" onClick={openOptionsPage}>Assistant home · Voice · Brand</button></div>
    </div>
  );
}
