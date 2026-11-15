import { useEffect, useState } from 'react';
import type { ApprovedReplyExample, Channel, PlatformId } from '@/lib/core/types';
import { assistantAction, getAssistantState, watchAssistant } from '@/lib/features/assistant/store';
import { Button, Card, Field, Select, TextArea } from './ui';

/** Users can teach the voice without a provider key or a generated draft. */
export function ReplyExamples({ personaId }: { personaId: string }) {
  const [platform, setPlatform] = useState<PlatformId>('linkedin');
  const [channel, setChannel] = useState<Channel>('comment');
  const [source, setSource] = useState('');
  const [reply, setReply] = useState('');
  const [examples, setExamples] = useState<ApprovedReplyExample[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void getAssistantState().then((state) => setExamples(state.feedback[personaId]?.pairs ?? [])).catch((error) => setMessage(error.message));
    return watchAssistant((state) => setExamples(state.feedback[personaId]?.pairs ?? []));
  }, [personaId]);
  const save = async () => {
    if (busy || !source.trim() || !reply.trim()) return;
    setBusy(true);
    try {
      const state = await assistantAction({ kind: 'feedback', personaId, pair: { platform, channel, source, reply } });
      setExamples(state.feedback[personaId]?.pairs ?? []);
      setSource(''); setReply(''); setMessage('Saved this source → reply example.');
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try {
      const state = await assistantAction({ kind: 'remove-feedback', personaId, field: 'pairs', value: id });
      setExamples(state.feedback[personaId]?.pairs ?? []);
      setMessage('Example removed.');
    } catch (error) { setMessage((error as Error).message); }
  };
  return (
    <Card title="Teach with a post and your reply" desc="Paste a source and a reply you actually approve. This teaches how you respond, not just how you write. No model call is needed to save an example.">
      <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="grid-2">
          <Field label="Platform"><Select value={platform} onChange={(value) => setPlatform(value as PlatformId)} options={[{ value: 'linkedin', label: 'LinkedIn' }, { value: 'x', label: 'X' }, { value: 'facebook', label: 'Facebook' }]} /></Field>
          <Field label="Reply type"><Select value={channel} onChange={(value) => setChannel(value as Channel)} options={[{ value: 'comment', label: 'Public comment' }, { value: 'dm', label: 'Message reply' }, { value: 'note', label: 'Connection note' }]} /></Field>
        </div>
        <Field label={channel === 'dm' ? 'Message you were answering' : channel === 'note' ? 'Context about the person' : 'Original post or comment'} hint="A relevant excerpt is enough. Up to 2,000 characters are saved."><TextArea value={source} onChange={setSource} rows={3} /></Field>
        <Field label="Your reply" hint="Use wording you would actually send. Keep it within 1,200 characters so the whole reply is saved."><TextArea value={reply} onChange={setReply} rows={3} /></Field>
        <p className="card__desc">Message examples are used only for message replies. Examples are style references, not proof of experience. Your twelve most recent pairs are kept per voice.</p>
        <Button small disabled={!source.trim() || !reply.trim()} onClick={() => void save()}>{busy ? 'Saving…' : 'Approve and save this pair'}</Button>
      </fieldset>
      {examples.length ? <details style={{ marginTop: 14 }}><summary>{examples.length} saved source → reply example{examples.length === 1 ? '' : 's'}</summary>{[...examples].reverse().map((example) => <div key={example.id} style={{ borderTop: '1px solid var(--border)', padding: '10px 0' }}>
        <span className="card__desc">{example.platform} · {example.channel}</span><p style={{ whiteSpace: 'pre-wrap' }}><b>Source: </b>{example.source}</p><p style={{ whiteSpace: 'pre-wrap' }}><b>My reply: </b>{example.reply}</p><Button small variant="ghost" onClick={() => void remove(example.id)}>Remove example</Button>
      </div>)}</details> : null}
      {message ? <p role="status">{message}</p> : null}
    </Card>
  );
}
