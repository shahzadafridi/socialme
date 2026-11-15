import { useState } from 'react';
import { assistantAction, type ConversationBookmark } from '@/lib/features/assistant/store';
import { conversationUrl } from '@/lib/features/assistant/store';
import type { PlatformId } from '@/lib/core/types';

export function localDateValue(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts), pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function BookmarkForm({ bookmark, platform = 'linkedin', url = '', author = '', excerpt = '', panel = false, onSaved }: {
  bookmark?: ConversationBookmark;
  platform?: PlatformId;
  url?: string;
  author?: string;
  excerpt?: string;
  panel?: boolean;
  onSaved?: () => void;
}) {
  const [site, setSite] = useState(bookmark?.platform ?? platform);
  const [link, setLink] = useState(bookmark?.url ?? url);
  const [person, setPerson] = useState(bookmark?.author ?? author);
  const [note, setNote] = useState(bookmark?.note ?? '');
  const [due, setDue] = useState(localDateValue(bookmark?.dueAt));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      conversationUrl(site, link);
      const dueAt = due ? new Date(due).getTime() : undefined;
      if (due && !Number.isFinite(dueAt)) throw new Error('Choose a valid follow-up time.');
      await assistantAction(bookmark ? { kind: 'update-bookmark', id: bookmark.id, note, dueAt, completed: bookmark.completed }
        : { kind: 'bookmark', bookmark: { platform: site, url: link, author: person, excerpt, note, dueAt } });
      setMessage('Saved. Find it in Assistant → Conversations.');
      onSaved?.();
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  };
  const inputClass = panel ? 'ap-input' : 'input';
  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 8, fontSize: 12 }}>
      {!bookmark ? <>
        <label>Platform<select aria-label="Conversation platform" className={inputClass} value={site} onChange={(event) => setSite(event.target.value as PlatformId)}><option value="linkedin">LinkedIn</option><option value="x">X</option><option value="facebook">Facebook</option></select></label>
        <label>Conversation link<input className={inputClass} type="url" value={link} onChange={(event) => setLink(event.target.value)} placeholder="Paste the direct link to the thread" /></label>
        <label>Person<input className={inputClass} value={person} onChange={(event) => setPerson(event.target.value)} /></label>
      </> : null}
      <label>What to remember<textarea className={panel ? 'ap-textarea' : 'textarea'} rows={2} value={note} onChange={(event) => setNote(event.target.value)} placeholder="What did you discuss? What would you like to follow up on?" maxLength={1000} /></label>
      <label>Follow up on (optional)<input type="datetime-local" className={inputClass} value={due} onChange={(event) => setDue(event.target.value)} /></label>
      <span style={{ opacity: 0.7 }}>Follow-ups appear in your local queue when you open SocialMe. Nothing is sent automatically.</span>
      <button type="button" className={panel ? 'ap-btn' : 'btn'} disabled={busy || !link.trim()} onClick={() => void save()}>{busy ? 'Saving…' : bookmark ? 'Save changes' : 'Save conversation'}</button>
      {message ? <span role="status">{message}</span> : null}
    </div>
  );
}
