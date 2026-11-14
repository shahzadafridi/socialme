import { ANGLES, LENGTHS, TONES } from '@/lib/core/constants';
import type { PlatformId, Settings } from '@/lib/core/types';
import { Card, Field, Input, Segmented, Select, Toggle } from '@/entrypoints/options/ui';

const PLATFORM_OPTIONS: Array<{ id: PlatformId; label: string }> = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'facebook', label: 'Facebook' },
];

export function DefaultsTab({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const defaults = settings.defaults;

  return (
    <>
      <div>
        <h1>Defaults</h1>
        <p className="lede">
          These are the values pre-selected in the panel. You can always override them per draft, so
          this is just your starting point.
        </p>
      </div>

      <Card title="Every new draft">
        <div className="grid-2">
          <Field label="Angle" hint={ANGLES.find((a) => a.id === defaults.angle)?.hint}>
            <Select
              value={defaults.angle}
              onChange={(value) => onChange({ defaults: { ...defaults, angle: value as typeof defaults.angle } })}
              options={ANGLES.map((angle) => ({ value: angle.id, label: angle.label }))}
            />
          </Field>
          <Field label="Tone" hint="Empty means the persona's own tone.">
            <Select
              value={defaults.tone}
              onChange={(value) => onChange({ defaults: { ...defaults, tone: value } })}
              options={[
                { value: '', label: 'Persona default' },
                ...TONES.map((tone) => ({ value: tone, label: tone })),
              ]}
            />
          </Field>
        </div>

        <Field
          label="Fallback reply length"
          hint="Used only when a persona has no preferred length."
        >
          <Segmented
            value={defaults.replyLength}
            onChange={(value) => onChange({ defaults: { ...defaults, replyLength: value } })}
            options={LENGTHS.map((length) => ({ value: length.id, label: length.label }))}
          />
        </Field>

        <Field
          label="Standing instruction"
          hint="Added to every request. Leave empty if you do not need it."
        >
          <Input
            value={defaults.extraInstruction}
            onChange={(value) => onChange({ defaults: { ...defaults, extraInstruction: value } })}
            placeholder="Never pitch. Mention real numbers when I have them."
          />
        </Field>
      </Card>

      <Card
        title="Voice per platform"
        desc="LinkedIn wants a different register than X. Point each platform at a persona, or inherit the default."
      >
        <div className="grid-3">
          {PLATFORM_OPTIONS.map((platform) => (
            <Field key={platform.id} label={platform.label}>
              <Select
                value={settings.platformPersona[platform.id]}
                onChange={(value) =>
                  onChange({
                    platformPersona: { ...settings.platformPersona, [platform.id]: value },
                  })
                }
                options={[
                  { value: 'inherit', label: `Default (${settings.personas.find((p) => p.id === settings.activePersonaId)?.name ?? '—'})` },
                  ...settings.personas.map((persona) => ({
                    value: persona.id,
                    label: `${persona.emoji ? `${persona.emoji} ` : ''}${persona.name}`,
                  })),
                ]}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card
        title="Inbox replies"
        desc="How much of a DM thread the ✦ icon sends to the model before writing a reply."
      >
        <Segmented
          value={settings.dmContext}
          onChange={(value) => onChange({ dmContext: value })}
          options={[
            { value: 'last', label: 'Last message' },
            { value: 'last3', label: 'Last 3' },
            { value: 'all', label: 'Whole chat' },
          ]}
        />
        <div className="note">
          <b>Last message</b> is the fastest and the least likely to drift — good for one-question
          threads. <b>Last 3</b> keeps continuity when a conversation has been going for a while.{' '}
          <b>Whole chat</b> sends up to 12 recent messages; better for long negotiations, but it
          costs more tokens and the reply can drift back to older topics.
        </div>
      </Card>

      <Card title="Interface">
        <Toggle
          checked={settings.showComposerButton}
          onChange={(value) => onChange({ showComposerButton: value })}
          label="Show ✦ in comment boxes and message threads"
          hint="An icon in the comment toolbar (next to emoji/GIF/image) and in DM composers. One click writes the reply straight into the field."
        />
        <Field label="Theme">
          <Segmented
            value={settings.theme}
            onChange={(value) => onChange({ theme: value })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </Field>
        <Toggle
          checked={settings.historyEnabled}
          onChange={(value) => onChange({ historyEnabled: value })}
          label="Keep recent drafts"
          hint="Stores the last 200 drafts locally so you can reuse phrasing. Never leaves this browser."
        />
      </Card>
    </>
  );
}
