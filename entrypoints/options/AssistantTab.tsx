import { useEffect, useState } from 'react';
import { assistantAction, getAssistantState, watchAssistant, type AssistantState, type EngagementGoal } from '@/lib/features/assistant/store';
import { PLATFORMS } from '@/lib/core/constants';
import type { PlatformId, Settings } from '@/lib/core/types';
import { BookmarkForm } from '@/lib/ui/BookmarkForm';
import { Button, Card, Field, Select, Toggle } from './ui';

export function AssistantTab({ settings, onVoice }: { settings: Settings; onVoice: () => void }) {
  const [state, setState] = useState<AssistantState | null>(null);
  const [goal, setGoal] = useState<EngagementGoal>('relationships');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    void getAssistantState().then(setState).catch((error) => setMessage(error.message));
    return watchAssistant(setState);
  }, []);
  const run = (action: Parameters<typeof assistantAction>[0]) => { void assistantAction(action).then(setState).catch((error) => setMessage(error.message)); };
  const due = state?.bookmarks.filter((item) => !item.completed && item.dueAt && item.dueAt <= Date.now()) ?? [];
  const pending = state?.bookmarks.filter((item) => !item.completed) ?? [];
  const identity = settings.personas.find((p) => p.id === 'p_default') ?? settings.personas[0];
  const examples = (identity.samplePosts.trim() ? identity.samplePosts.split(/\n\s*\n/).filter((sample) => sample.trim()).length : 0) + (state?.feedback[identity.id]?.samples.length ?? 0) + (state?.feedback[identity.id]?.pairs?.length ?? 0);
  return (
    <>
      <div><h1>Your engagement assistant</h1><p className="lede">Find a useful conversation, reply in your own voice, and remember who to follow up with.</p></div>
      <Card title={examples < 3 ? 'Start with your voice' : 'Keep refining your voice'} desc={examples < 3 ? 'Add 3–5 real comments you have written. Short, ordinary replies are useful examples too. No made-up experiences or deliberate typos are needed.' : `${examples} approved or pasted examples in My voice. Your topic voices inherit them.`}>
        <Button small onClick={onVoice}>Calibrate My voice</Button>
      </Card>
      <Card title="Help me engage" desc="A small session you control. Progress counts conversations you mark reviewed; it does not claim they were posted.">
        <Field label="My goal"><Select value={goal} onChange={(value) => setGoal(value as EngagementGoal)} options={[
          { value: 'relationships', label: 'Build relationships' }, { value: 'expertise', label: 'Share useful expertise' }, { value: 'reconnect', label: 'Continue a conversation' },
        ]} /></Field>
        <Button onClick={() => run({ kind: 'start', goal, target: 3 })}>Start a 3-conversation session</Button>
        {state?.session ? <p role="status">{Math.min(state.session.reviewed.length, state.session.target)} / {state.session.target} conversations reviewed · {state.session.reviewed.length >= state.session.target ? 'Session complete. Take a break or continue when you want.' : 'Open a social tab and choose a conversation from SocialMe.'}</p> : null}
        <div className="row" style={{ marginTop: 12 }}>{(['linkedin', 'x', 'facebook'] as PlatformId[]).map((site) => <a key={site} className="btn btn--sm" target="_blank" rel="noreferrer" href={site === 'linkedin' ? 'https://www.linkedin.com/feed/' : site === 'x' ? 'https://x.com/home' : 'https://www.facebook.com/'}>Open {PLATFORMS[site].label}</a>)}</div>
      </Card>
      <Card title={`Follow-ups · ${due.length} due`} desc={`${pending.length} open conversations. Your notes stay on this device; opening a link never sends a message.`}>
        {pending.length ? [...pending].sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity)).map((item) => <div key={item.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <a href={item.url} target="_blank" rel="noreferrer">{item.author || 'Saved conversation'} · {PLATFORMS[item.platform].label}</a>
          {item.excerpt ? <p className="card__desc">{item.excerpt}</p> : null}
          <p>{item.note || 'No note yet.'}</p>
          {item.dueAt ? <p className="card__desc">{item.dueAt <= Date.now() ? 'Due: ' : 'Follow up: '}{new Date(item.dueAt).toLocaleString()}</p> : null}
          <div className="row"><Button small variant="ghost" onClick={() => setEditing(editing === item.id ? null : item.id)}>Edit note / date</Button><Button small variant="ghost" onClick={() => run({ kind: 'update-bookmark', id: item.id, note: item.note, dueAt: item.dueAt, completed: true })}>Mark done</Button></div>
          {editing === item.id ? <BookmarkForm bookmark={item} onSaved={() => setEditing(null)} /> : null}
        </div>) : <p className="card__desc">Save a thread from the SocialMe panel, or add a direct conversation link below.</p>}
        {state?.bookmarks.some((item) => item.completed) ? <details style={{ marginTop: 12 }}><summary>Completed conversations</summary>{state.bookmarks.filter((item) => item.completed).map((item) => <div key={item.id} className="row" style={{ marginTop: 8 }}><a href={item.url} target="_blank" rel="noreferrer">{item.author || 'Conversation'}</a><Button small variant="ghost" onClick={() => run({ kind: 'update-bookmark', id: item.id, note: item.note, dueAt: item.dueAt, completed: false })}>Reopen</Button></div>)}</details> : null}
      </Card>
      <Card title="Save a conversation"><BookmarkForm /></Card>
      <Card title="Saved voice feedback" desc="Only preferences and examples you explicitly approve are used. Remove any that no longer fit.">
        {Object.entries(state?.feedback ?? {}).length ? Object.entries(state!.feedback).map(([id, feedback]) => <div key={id} style={{ marginBottom: 16 }}>
          <b>{settings.personas.find((p) => p.id === id)?.name ?? 'Previous voice'}</b>
          {(['rules', 'samples'] as const).map((field) => feedback[field].map((value) => <div key={`${field}:${value}`} style={{ marginTop: 8 }}><span className="card__desc">{field === 'rules' ? 'Preference' : 'Approved example'}: </span>{value}<Button small variant="ghost" onClick={() => run({ kind: 'remove-feedback', personaId: id, field, value })}>Remove</Button></div>))}
          {(feedback.pairs ?? []).map((pair) => <details key={pair.id} style={{ marginTop: 10 }}><summary>Source → reply · {pair.platform} · {pair.channel}</summary><p style={{ whiteSpace: 'pre-wrap' }}><b>Source: </b>{pair.source}</p><p style={{ whiteSpace: 'pre-wrap' }}><b>My reply: </b>{pair.reply}</p><Button small variant="ghost" onClick={() => run({ kind: 'remove-feedback', personaId: id, field: 'pairs', value: pair.id })}>Remove pair</Button></details>)}
        </div>) : <p className="card__desc">Use “Does this sound like you?” below a draft to start calibrating your voice.</p>}
      </Card>
      <Card title="Pause on a platform">{(['linkedin', 'x', 'facebook'] as PlatformId[]).map((platform) => <Toggle key={platform} checked={Boolean(state?.paused[platform])} label={`Pause SocialMe on ${PLATFORMS[platform].label}`} onChange={(paused) => run({ kind: 'pause', platform, paused })} />)}</Card>
      {message ? <p role="status">{message}</p> : null}
    </>
  );
}
