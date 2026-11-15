import { useEffect, useState } from 'react';
import { LENGTHS, TONES } from '@/lib/core/constants';
import { newId, STARTER_PERSONAS } from '@/lib/core/defaults';
import type { Persona, Settings } from '@/lib/core/types';
import { Button, Card, Field, Input, Segmented, Select, TextArea, Toggle } from '@/entrypoints/options/ui';
import { VoicePreview } from './VoicePreview';
import { ReplyExamples } from './ReplyExamples';
import { applySharedVoiceGuide, SHARED_ENGINEERING_VOICE, SHARED_VOICE_GUIDE_URL } from '@/lib/core/shared-voice-guide';

const LANGUAGES = [
  'auto',
  'English',
  'German',
  'French',
  'Spanish',
  'Portuguese',
  'Dutch',
  'Italian',
  'Turkish',
  'Urdu',
  'Arabic',
  'Hindi',
  'Indonesian',
];

export function PersonasTab({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const [selectedId, setSelectedId] = useState(settings.activePersonaId);
  const [guideApplied, setGuideApplied] = useState(false);
  const persona = settings.personas.find((p) => p.id === selectedId) ?? settings.personas[0];
  const [limitDraft, setLimitDraft] = useState(String(persona.replyMaxChars));
  const identity = settings.personas.find((p) => p.id === 'p_default') ?? persona;
  const preferences = persona.voicePreferences ?? identity.voicePreferences ?? { register: 'conversational', questions: 'when-needed', contractions: true };

  useEffect(() => {
    setLimitDraft(String(persona.replyMaxChars));
  }, [persona.id, persona.replyMaxChars]);

  const updatePersona = (patch: Partial<Persona>) => {
    onChange({
      personas: settings.personas.map((p) => (p.id === persona.id ? { ...p, ...patch } : p)),
    });
  };

  const addPersona = (source?: Persona) => {
    const base = source ?? STARTER_PERSONAS[0];
    const created: Persona = {
      ...base,
      id: newId('p'),
      name: source ? `${source.name} copy` : 'New persona',
      emoji: source?.emoji ?? '✨',
    };
    onChange({ personas: [...settings.personas, created] });
    setSelectedId(created.id);
  };

  const removePersona = () => {
    if (settings.personas.length <= 1) return;
    const remaining = settings.personas.filter((p) => p.id !== persona.id);
    const patch: Partial<Settings> = { personas: remaining };
    if (settings.activePersonaId === persona.id) patch.activePersonaId = remaining[0].id;
    const platformPersona = { ...settings.platformPersona };
    for (const key of Object.keys(platformPersona) as Array<keyof typeof platformPersona>) {
      if (platformPersona[key] === persona.id) platformPersona[key] = 'inherit';
    }
    patch.platformPersona = platformPersona;
    onChange(patch);
    setSelectedId(remaining[0].id);
  };

  return (
    <>
      <div>
        <h1>Voice &amp; personas</h1>
        <p className="lede">
          A persona is the writing brief the model gets on every call. The more specific it is, the
          less the output sounds like a generic AI reply. Keep My voice as your default, then switch
          to a specialised voice when the thread calls for a different angle.
        </p>
      </div>

      <Card title="Your shared engineering voice" desc="Direct, practical, curious and conversational. Prepared from the communication guide you shared.">
        <details><summary>Review the style guide</summary><p style={{ whiteSpace: 'pre-wrap' }}>{SHARED_ENGINEERING_VOICE.styleNotes}</p><p>Illustrative examples stay separate from your authored writing. Your identity, real writing samples, brand proof and provider settings are preserved.</p><a href={SHARED_VOICE_GUIDE_URL} target="_blank" rel="noreferrer">Open the original shared guide</a></details>
        <p className="card__desc">Applying it makes My voice the default on all three platforms, clears per-platform tone overrides, and uses brand context only when relevant.</p>
        <Button small onClick={() => { onChange(applySharedVoiceGuide(settings)); setSelectedId('p_default'); setGuideApplied(true); }}>Use this guide for My voice</Button>
        {guideApplied ? <p role="status">Guide applied. Your approved examples and feedback still take priority for vocabulary and rhythm.</p> : null}
      </Card>

      <div className="persona-layout">
        <div>
          <div className="persona-list">
            {settings.personas.map((item) => (
              <button
                key={item.id}
                className="persona-item"
                data-active={item.id === persona.id}
                onClick={() => setSelectedId(item.id)}
              >
                <span>{item.emoji || '•'}</span>
                <span className="persona-item__name">{item.name}</span>
                {settings.activePersonaId === item.id ? <span className="ap-flag">default</span> : null}
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <Button small variant="ghost" onClick={() => addPersona()}>
              + New
            </Button>
            <Button small variant="ghost" onClick={() => addPersona(persona)}>
              Duplicate
            </Button>
          </div>
          <div className="row" style={{ marginTop: 4 }}>
            <Button
              small
              variant="ghost"
              onClick={() => onChange({ activePersonaId: persona.id })}
              disabled={settings.activePersonaId === persona.id}
            >
              Set as default
            </Button>
            <Button
              small
              variant="danger"
              onClick={removePersona}
              disabled={settings.personas.length <= 1}
            >
              Delete
            </Button>
          </div>
        </div>

        <div className="persona-form">
          <Card>
            <div className="grid-2">
              <Field label="Name">
                <Input value={persona.name} onChange={(value) => updatePersona({ name: value })} />
              </Field>
              <Field label="Emoji">
                <Input
                  value={persona.emoji}
                  onChange={(value) => updatePersona({ emoji: value.slice(0, 4) })}
                  placeholder="🙂"
                />
              </Field>
            </div>

            <div className="subhead">Identity</div>
            <Field label={persona.id === identity.id ? 'Who you are' : 'Topic perspective'} hint={persona.id === identity.id ? 'One line. Role, years, what you actually do.' : 'My voice holds your real identity. This adds a perspective without claiming a different job title.'}>
              <Input
                value={persona.role}
                onChange={(value) => updatePersona({ role: value })}
                placeholder="Founder of a 12-person dev shop, shipping client apps since 2016"
              />
            </Field>
            <div className="grid-2">
              <Field label="What you know" hint="Topics you can speak on credibly.">
                <Input
                  value={persona.niche}
                  onChange={(value) => updatePersona({ niche: value })}
                  placeholder="Product, growth, hiring engineers"
                />
              </Field>
              <Field label="Audience" hint="Who should read you.">
                <Input
                  value={persona.audience}
                  onChange={(value) => updatePersona({ audience: value })}
                  placeholder="Founders, PMs, senior engineers"
                />
              </Field>
            </div>
          </Card>

          <Card>
            <div className="subhead">Voice</div>
            <p className="card__desc">Your approved examples set the vocabulary and rhythm. A topic voice adds perspective without changing who you are.</p>
            {persona.id !== identity.id ? <Toggle checked={!persona.voicePreferences} label="Use My voice conversation settings" onChange={(inherit) => updatePersona({ voicePreferences: inherit ? undefined : { ...preferences } })} /> : null}
            <div className="grid-2">
              <Field label="How formal should it feel?">
                <Select value={preferences.register} onChange={(register) => updatePersona({ voicePreferences: { ...preferences, register: register as typeof preferences.register } })} options={[
                  { value: 'conversational', label: 'Everyday conversation' }, { value: 'balanced', label: 'Professional, relaxed' }, { value: 'formal', label: 'Formal' },
                ]} />
              </Field>
              <Field label="Questions in replies">
                <Select value={preferences.questions} onChange={(questions) => updatePersona({ voicePreferences: { ...preferences, questions: questions as typeof preferences.questions } })} options={[
                  { value: 'when-needed', label: 'Only when useful' }, { value: 'rare', label: 'Rarely' }, { value: 'never', label: 'No questions' },
                ]} />
              </Field>
            </div>
            <Toggle checked={preferences.contractions} label="Use natural contractions (I'm, don't, it's)" onChange={(contractions) => updatePersona({ voicePreferences: { ...preferences, contractions } })} />
            <div className="grid-2">
              <Field label="Tone">
                <Select
                  value={TONES.includes(persona.tone) ? persona.tone : '__custom'}
                  onChange={(value) => {
                    if (value !== '__custom') updatePersona({ tone: value });
                  }}
                  options={[
                    ...TONES.map((tone) => ({ value: tone, label: tone })),
                    { value: '__custom', label: persona.tone || 'Custom…' },
                  ]}
                />
              </Field>
              <Field label="Language">
                <Select
                  value={persona.language}
                  onChange={(value) => updatePersona({ language: value })}
                  options={LANGUAGES.map((lang) => ({
                    value: lang,
                    label: lang === 'auto' ? 'Match the post' : lang,
                  }))}
                />
              </Field>
            </div>
            <Field label="Custom tone" hint="Optional. Overrides the dropdown.">
              <Input
                value={persona.tone}
                onChange={(value) => updatePersona({ tone: value })}
                placeholder="Direct, a little blunt, never salesy"
              />
            </Field>

            <Field
              label="How you write"
              hint="Rhythm, sentence length, what you always do. This is the highest-leverage field."
            >
              <TextArea
                value={persona.styleNotes}
                onChange={(value) => updatePersona({ styleNotes: value })}
                rows={3}
                placeholder="Short sentences. Concrete numbers. One idea per line. Never pitch in comments. Admit when I don't know."
              />
            </Field>
            <Field label="What you never do">
              <TextArea
                value={persona.avoid}
                onChange={(value) => updatePersona({ avoid: value })}
                rows={2}
                placeholder="Hype, motivational fluff, emoji spam, 'Great post!', fake case studies"
              />
            </Field>
            <Field label="Banned words" hint="Comma separated. The model will avoid these.">
              <Input
                value={persona.bannedWords}
                onChange={(value) => updatePersona({ bannedWords: value })}
                placeholder="game-changer, synergy, leverage, delve"
              />
            </Field>
            <Field
              label="Writing samples"
              hint={persona.id === identity.id ? 'Paste 3–5 real comments, separated by blank lines. Short replies work too. These guide every topic voice.' : 'Optional examples for this topic voice. My voice examples are inherited automatically. Examples guide style, not factual claims.'}
            >
              <TextArea
                value={persona.samplePosts}
                onChange={(value) => updatePersona({ samplePosts: value })}
                rows={5}
                placeholder={'We shipped a rewrite last month…\n\nHere is the part nobody tells you…'}
              />
            </Field>
          </Card>

          <ReplyExamples key={`examples:${persona.id}`} personaId={persona.id} />
          <VoicePreview key={persona.id} settings={settings} persona={persona} onSample={(sample) => updatePersona({ samplePosts: [persona.samplePosts.trim(), sample].filter(Boolean).join('\n\n') })} />

          <Card>
            <div className="subhead">Rules for output</div>
            <div className="grid-3">
              <Field label="Emoji">
                <Select
                  value={persona.emojiLevel}
                  onChange={(value) => updatePersona({ emojiLevel: value as Persona['emojiLevel'] })}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'light', label: 'Light' },
                    { value: 'moderate', label: 'Moderate' },
                  ]}
                />
              </Field>
              <Field label="Hashtags">
                <Select
                  value={persona.hashtagLevel}
                  onChange={(value) =>
                    updatePersona({ hashtagLevel: value as Persona['hashtagLevel'] })
                  }
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'light', label: 'Light (≤2)' },
                    { value: 'heavy', label: 'Heavy (≤5)' },
                  ]}
                />
              </Field>
              <Field label="Sign-off" hint="Optional.">
                <Input
                  value={persona.signOff}
                  onChange={(value) => updatePersona({ signOff: value })}
                  placeholder="— Shahzad"
                />
              </Field>
            </div>

            <div className="grid-2">
              <Field
                label="Preferred length"
                hint="Starting length for a new draft with this voice. You can change it per reply."
              >
                <Segmented
                  value={persona.length ?? 'medium'}
                  onChange={(value) =>
                    updatePersona({ length: value as Persona['length'] })
                  }
                  options={LENGTHS.map((length) => ({ value: length.id, label: length.label }))}
                />
              </Field>
              <Field label="Character limit" hint="Hard cap in characters (80-2000).">
                <Input
                  value={limitDraft}
                  onChange={setLimitDraft}
                  onBlur={() => {
                    const parsed = Number(limitDraft);
                    const next =
                      Number.isFinite(parsed) && parsed > 0
                        ? Math.max(80, Math.min(2000, Math.round(parsed)))
                        : persona.replyMaxChars;
                    setLimitDraft(String(next));
                    if (next !== persona.replyMaxChars) updatePersona({ replyMaxChars: next });
                  }}
                  monospace
                />
              </Field>
            </div>
            <Field label="Call to action" hint="Optional. Leave empty to avoid engagement bait.">
              <Input
                value={persona.cta}
                onChange={(value) => updatePersona({ cta: value })}
                placeholder="Ask what they tried, not 'thoughts?'"
              />
            </Field>
          </Card>
        </div>
      </div>
    </>
  );
}
