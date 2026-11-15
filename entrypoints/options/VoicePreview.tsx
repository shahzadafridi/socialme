import { useEffect, useRef, useState } from 'react';
import { requestProviderAccess } from '@/lib/core/ai/access';
import { buildPrompt } from '@/lib/core/ai/prompt';
import { streamCompletion } from '@/lib/core/ai/providers';
import { getApiKey } from '@/lib/data/storage';
import { loadWritingVoice } from '@/lib/data/voice';
import type { Persona, Settings } from '@/lib/core/types';
import { Button, Card, Field, TextArea } from './ui';
import { VoiceFeedback } from '@/lib/ui/VoiceFeedback';
import { resolveTone } from '@/lib/core/defaults';
import { Select } from './ui';
import type { Channel, PlatformId } from '@/lib/core/types';

export function VoicePreview({ settings, persona, onSample }: {
  settings: Settings;
  persona: Persona;
  onSample: (sample: string) => void;
}) {
  const [source, setSource] = useState('Small releases make reviews easier, but we still struggle to ship every week. What has helped your team?');
  const [platform, setPlatform] = useState<PlatformId>('linkedin');
  const [channel, setChannel] = useState<Channel>('comment');
  const [draft, setDraft] = useState('');
  const [roughThought, setRoughThought] = useState('');
  const [draftContext, setDraftContext] = useState<{ source: string; platform: PlatformId; channel: Channel }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const preview = async (revision?: string) => {
    if (controller.current || !source.trim()) return;
    const provider = settings.providers.find((item) => item.id === settings.activeProvider);
    if (!provider) return;
    const run = new AbortController();
    controller.current = run;
    setBusy(true);
    setMessage('');
    const previous = draft;
    try {
      await requestProviderAccess(provider.baseUrl);
      run.signal.throwIfAborted();
      const key = await getApiKey(provider.id);
      const voice = await loadWritingVoice(settings, persona);
      const prompt = buildPrompt({
        request: { platform, channel, post: { text: source }, length: persona.length,
          roughThought: revision ? undefined : roughThought.trim() || undefined,
          tone: resolveTone(settings, platform) || undefined, angle: settings.defaults.angle, extra: settings.defaults.extraInstruction,
          recipient: channel === 'note' ? { meta: source } : undefined,
          revision: revision && draft.trim() ? { text: draft, instruction: revision } : undefined },
        platform, ...voice, brand: settings.brand,
      });
      let text = '';
      for await (const delta of streamCompletion(provider, key, { ...prompt, temperature: provider.temperature, signal: run.signal })) {
        run.signal.throwIfAborted();
        text += delta;
        setDraft(text);
      }
      if (!text.trim()) throw new Error('The model returned no preview. Try again.');
      setDraftContext({ source, platform, channel });
    } catch (error) {
      if (!run.signal.aborted) { setDraft(previous); setMessage((error as Error).message); }
    } finally {
      if (controller.current === run) { controller.current = null; setBusy(false); }
    }
  };

  const sampleCount = persona.samplePosts.trim() ? persona.samplePosts.trim().split(/\n\s*\n/).length : 0;
  return (
    <Card title="Make this sound like you" desc="Paste 3–5 real comments into Writing samples, then try your voice here. Nothing is posted.">
      <p className="card__desc">{sampleCount} pasted writing example{sampleCount === 1 ? '' : 's'} for this voice. My voice examples and saved feedback are also included. Edit the preview until you would send it yourself.</p>
      <fieldset disabled={busy} style={{ border: 0, margin: 0, padding: 0 }}>
      <div className="grid-2">
        <Field label="Platform"><Select value={platform} onChange={(value) => setPlatform(value as PlatformId)} options={[{ value: 'linkedin', label: 'LinkedIn' }, { value: 'x', label: 'X' }, { value: 'facebook', label: 'Facebook' }]} /></Field>
        <Field label="Reply type"><Select value={channel} onChange={(value) => setChannel(value as Channel)} options={[{ value: 'comment', label: 'Comment' }, { value: 'dm', label: 'Message reply' }, { value: 'note', label: 'Connection note' }]} /></Field>
      </div>
      <Field label={channel === 'dm' ? 'Conversation (end with their latest message)' : channel === 'note' ? 'What you know about this person' : 'Sample post'}>
        <TextArea value={source} onChange={setSource} rows={3} />
      </Field>
      <Field label="My rough thought (optional)" hint="Your point, in your words. The assistant helps phrase it without adding a different opinion.">
        <TextArea value={roughThought} onChange={setRoughThought} rows={2} disabled={busy} placeholder="Agree, but migration costs matter." />
      </Field>
      </fieldset>
      <Button small disabled={busy || !source.trim()} onClick={() => void preview()}>{busy ? 'Trying your voice…' : 'Try this voice'}</Button>
      {draft ? (
        <>
          <Field label="Your reply" hint="This uses your current voice settings, including unsaved edits.">
            <TextArea value={draft} onChange={setDraft} rows={4} disabled={busy} />
          </Field>
          <Button small variant="ghost" disabled={busy} onClick={() => { onSample(draft.trim()); setMessage('Added to writing samples.'); }}>Use my edited reply as a writing sample</Button>
          <VoiceFeedback personaId={persona.id} personaName={persona.name} draft={draft} source={draftContext?.source} platform={draftContext?.platform} channel={draftContext?.channel} disabled={busy} onRewrite={(instruction) => void preview(instruction)} />
        </>
      ) : null}
      {message ? <p role="status" className="card__desc">{message}</p> : null}
    </Card>
  );
}
