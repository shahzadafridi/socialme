import { useState } from 'react';
import { assistantAction } from '@/lib/features/assistant/store';
import type { Channel, PlatformId } from '@/lib/core/types';

const SUGGESTIONS = {
  'Too formal': 'Use everyday words and a relaxed, direct tone. Remove corporate language and formal transitions.',
  'Too polished': 'Keep it like a quick thoughtful reply. Remove the tidy conclusion, clever contrast and overworked phrasing. No forced slang or mistakes.',
  'Too generic': 'Respond to one specific point in the source in my own vocabulary. Remove generic praise, summaries and broad lessons.',
  'Too long': 'Keep replies brief unless the question needs detail. Do not pad or add a second point just to meet a length target.',
};
const buttonStyle = { border: '1px solid currentColor', borderRadius: 7, padding: '5px 8px', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' } as const;

export function VoiceFeedback({ personaId, personaName, draft, source, platform, channel, disabled, onRewrite }: {
  personaId: string;
  personaName: string;
  draft: string;
  source?: string;
  platform?: PlatformId;
  channel?: Channel;
  disabled?: boolean;
  onRewrite?: (instruction: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rule, setRule] = useState('');
  const [sample, setSample] = useState(false);
  const [includeContext, setIncludeContext] = useState(true);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving || (!rule.trim() && !sample)) return;
    setSaving(true);
    try {
      const pair = sample && includeContext && source?.trim() && platform && channel ? { platform, channel, source, reply: draft } : undefined;
      await assistantAction({ kind: 'feedback', personaId, rule: rule.trim() || undefined, sample: sample && !pair ? draft : undefined, pair });
      setMessage(`${pair ? 'Source + reply example' : 'Feedback'} saved for ${personaName}. Future replies will use this feedback.`);
      setOpen(false);
    } catch (error) { setMessage((error as Error).message); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ marginTop: 10, fontSize: 12, lineHeight: 1.5 }}>
      <div style={{ marginBottom: 5, opacity: 0.8 }}>Does this sound like you?</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
        {Object.entries(SUGGESTIONS).map(([label, suggestion]) => <button key={label} type="button" style={buttonStyle} disabled={disabled || saving} onClick={() => { setRule(suggestion); setSample(false); setOpen(true); setMessage(''); }}>{label}</button>)}
        <button type="button" style={buttonStyle} disabled={disabled || saving} onClick={() => { setRule(''); setSample(true); setOpen(true); setMessage(''); }}>Sounds like me</button>
      </div>
      {open ? (
        <div style={{ border: '1px solid currentColor', borderRadius: 8, padding: 9, marginTop: 8 }}>
          <label style={{ display: 'block' }}>Preference for {personaName}
            <textarea aria-label="Proposed writing preference" value={rule} onChange={(event) => setRule(event.target.value)} rows={3} maxLength={400} style={{ display: 'block', boxSizing: 'border-box', width: '100%', margin: '5px 0', padding: 7, borderRadius: 6, font: 'inherit', color: 'inherit', background: 'transparent', border: '1px solid currentColor' }} />
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'start' }}><input type="checkbox" checked={sample} onChange={(event) => setSample(event.target.checked)} />Save this edited reply as an approved style example</label>
          {sample && source?.trim() && platform && channel ? <>
            <label style={{ display: 'flex', gap: 6, alignItems: 'start', marginTop: 6 }}><input type="checkbox" checked={includeContext} onChange={(event) => setIncludeContext(event.target.checked)} />Include the source so SocialMe can learn how I respond in context</label>
            {includeContext ? <details style={{ marginTop: 6 }}><summary>Review the source excerpt to save</summary><p style={{ whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto' }}>{channel === 'dm' ? source.trim().slice(-2000) : source.trim().slice(0, 2000)}</p><span>Used only for {channel === 'dm' ? 'message replies' : channel === 'note' ? 'connection notes' : 'public comments'}; examples guide style, not factual claims.</span></details> : null}
          </> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <button type="button" style={buttonStyle} disabled={saving || (!rule.trim() && !sample)} onClick={() => void save()}>{saving ? 'Saving…' : 'Save for future replies'}</button>
            {onRewrite && rule.trim() ? <button type="button" style={buttonStyle} onClick={() => { onRewrite(rule); setOpen(false); }}>Try this rewrite</button> : null}
            <button type="button" style={buttonStyle} onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      ) : null}
      {message ? <div role="status" style={{ marginTop: 6 }}>{message}</div> : null}
    </div>
  );
}
