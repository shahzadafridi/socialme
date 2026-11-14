import { useEffect, useState } from 'react';
import { PLATFORMS, PLATFORM_POLICY } from '@/lib/core/constants';
import { checkAllowance, formatWait, getActivity } from '@/lib/features/safety/limits';
import { getUsage } from '@/lib/data/storage';
import type { OutputMode, PlatformId, Settings, UsageDay } from '@/lib/core/types';
import { Card, Field, Input, Note, Segmented, Select, Toggle } from '@/entrypoints/options/ui';

const PLATFORM_OPTIONS: Array<{ id: PlatformId; label: string }> = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'x', label: 'X' },
  { id: 'facebook', label: 'Facebook' },
];

const MODES: Array<{ value: OutputMode; label: string }> = [
  { value: 'review', label: 'Review' },
  { value: 'insert', label: 'Insert' },
  { value: 'auto', label: 'Auto-send' },
];

export function SafetyTab({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const [usage, setUsage] = useState<UsageDay | null>(null);
  const [submits, setSubmits] = useState(0);
  const [allowance, setAllowance] = useState<string>('');

  useEffect(() => {
    getUsage().then(setUsage).catch(() => undefined);
    getActivity()
      .then((events) => {
        const now = Date.now();
        setSubmits(events.filter((e) => e.kind === 'submit' && now - e.ts < 86400000).length);
      })
      .catch(() => undefined);
    checkAllowance('linkedin', settings.safety)
      .then((result) =>
        setAllowance(
          result.allowed
            ? `${result.dailyLeft} left today · ${result.hourlyLeft} left this hour`
            : `${result.reason ?? 'Blocked'}${result.retryInSec ? ` (${formatWait(result.retryInSec)})` : ''}`,
        ),
      )
      .catch(() => setAllowance(''));
  }, [settings.safety]);

  const safety = settings.safety;

  return (
    <>
      <div>
        <h1>Safety &amp; reach</h1>
        <p className="lede">
          A restricted account has no reach, so these limits matter more than output settings. SocialMe
          enforces them before anything is typed or sent, and it types like a person instead of pasting
          instantly.
        </p>
      </div>

      <Card title="Default output mode" desc="What happens once a draft is ready.">
        <Segmented
          value={settings.outputMode}
          onChange={(value) => onChange({ outputMode: value })}
          options={MODES}
        />
        <div className="note">
          <b>Review</b> keeps the draft in the panel until you insert it. <b>Insert</b> types it into
          the box and leaves sending to you. <b>Auto-send</b> types it and presses send after a
          human-shaped delay. Review is the only mode that can never send by accident.
        </div>
        <div className="grid-3">
          {PLATFORM_OPTIONS.map((platform) => (
            <Field key={platform.id} label={platform.label}>
              <Select
                value={settings.platformOutputMode[platform.id]}
                onChange={(value) =>
                  onChange({
                    platformOutputMode: {
                      ...settings.platformOutputMode,
                      [platform.id]: value as OutputMode | 'inherit',
                    },
                  })
                }
                options={[
                  {
                    value: 'inherit',
                    label: `Default (${MODES.find((m) => m.value === settings.outputMode)?.label})`,
                  },
                  ...MODES.map((mode) => ({ value: mode.value, label: mode.label })),
                ]}
              />
            </Field>
          ))}
        </div>
      </Card>

      <Card
        title="Human interaction"
        desc="How SocialMe behaves on the page. Instant paste-and-click is what automated-account detection looks for."
      >
        <Toggle
          checked={safety.humanTyping}
          onChange={(value) => onChange({ safety: { ...safety, humanTyping: value } })}
          label="Type character by character"
          hint="Instead of pasting the draft, it types it in small uneven chunks with pauses at punctuation. Slower, but it looks like a person wrote it."
        />
        <div className="grid-2">
          <Field label="Typing speed">
            <Segmented
              value={safety.typingSpeed}
              onChange={(value) => onChange({ safety: { ...safety, typingSpeed: value } })}
              options={[
                { value: 'fast', label: 'Fast' },
                { value: 'natural', label: 'Natural' },
                { value: 'careful', label: 'Careful' },
              ]}
            />
          </Field>
          <Field
            label="Minimum gap between actions"
            hint="Seconds between two actions on the same platform."
          >
            <Input
              value={String(safety.minActionGapSec)}
              onChange={(value) =>
                onChange({
                  safety: { ...safety, minActionGapSec: Math.max(0, Number(value) || 0) },
                })
              }
              monospace
            />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Max per hour" hint="All platforms combined.">
            <Input
              value={String(safety.maxActionsPerHour)}
              onChange={(value) =>
                onChange({
                  safety: { ...safety, maxActionsPerHour: Math.max(1, Number(value) || 1) },
                })
              }
              monospace
            />
          </Field>
          <Field label="Max per day" hint="All platforms combined.">
            <Input
              value={String(safety.maxActionsPerDay)}
              onChange={(value) =>
                onChange({
                  safety: { ...safety, maxActionsPerDay: Math.max(1, Number(value) || 1) },
                })
              }
              monospace
            />
          </Field>
        </div>

        <Field
          label="Warm-up period"
          hint="Days after your first action where the caps are halved. New accounts get restricted first — 7 days is a sane start."
        >
          <Input
            value={String(safety.warmupDays)}
            onChange={(value) =>
              onChange({ safety: { ...safety, warmupDays: Math.max(0, Number(value) || 0) } })
            }
            monospace
          />
        </Field>

        <Toggle
          checked={safety.pauseOnWarning}
          onChange={(value) => onChange({ safety: { ...safety, pauseOnWarning: value } })}
          label="Stop when the platform warns the account"
          hint="Watches for restriction banners, 'unusual activity' notices and verification challenges. When one appears, auto-sending is blocked until you clear it."
        />

        <div className="note">
          <b>Current allowance:</b> {allowance || '—'}
          {submits > 0 ? ` · ${submits} actions in the last 24h` : ''}
        </div>
      </Card>

      <Card title="Automatic sending" desc="Off by default. Only used when the output mode is Auto-send.">
        <Toggle
          checked={settings.autoSubmit.enabled}
          onChange={(value) => onChange({ autoSubmit: { ...settings.autoSubmit, enabled: value } })}
          label="Allow SocialMe to press send"
          hint="When off, nothing is ever sent without you clicking the button."
        />
        <div className="grid-2">
          <Field label="Delay before sending" hint="Randomized pause between these values, in ms.">
            <div className="row">
              <Input
                value={String(settings.autoSubmit.minDelayMs)}
                onChange={(value) =>
                  onChange({
                    autoSubmit: {
                      ...settings.autoSubmit,
                      minDelayMs: Math.max(0, Number(value) || 0),
                    },
                  })
                }
                monospace
              />
              <span style={{ color: 'var(--faint)' }}>–</span>
              <Input
                value={String(settings.autoSubmit.maxDelayMs)}
                onChange={(value) =>
                  onChange({
                    autoSubmit: {
                      ...settings.autoSubmit,
                      maxDelayMs: Math.max(0, Number(value) || 0),
                    },
                  })
                }
                monospace
              />
              <span style={{ color: 'var(--faint)', fontSize: 12 }}>ms</span>
            </div>
          </Field>
          <Field label="Confirm before sending" hint="One line in the panel. Keeps you from sending to the wrong thread.">
            <Toggle
              checked={settings.autoSubmit.requireConfirm}
              onChange={(value) =>
                onChange({ autoSubmit: { ...settings.autoSubmit, requireConfirm: value } })
              }
              label="Ask first"
            />
          </Field>
        </div>
      </Card>

      <Card
        title="What each platform actually allows"
        desc="Summaries of the rules that get accounts restricted. SocialMe defaults are stricter than the platforms require."
      >
        {PLATFORM_OPTIONS.map((platform) => {
          const policy = PLATFORM_POLICY[platform.id];
          return (
            <div key={platform.id} className="provider" data-active="false">
              <div className="provider__head">
                <span className="provider__name">{policy.label}</span>
                <a
                  href={policy.termsUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--accent)' }}
                >
                  Rules →
                </a>
              </div>
              <div className="provider__body" style={{ gap: 8 }}>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
                  {policy.automated}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.55 }}>
                  {policy.limits}
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.7 }}>
                  {policy.safe.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </Card>

      <Card title="Today">
        <div className="usage">
          {PLATFORM_OPTIONS.map((platform) => (
            <div className="usage__item" key={platform.id}>
              <span className="usage__num">{usage?.submitted[platform.id] ?? 0}</span>
              sent on {PLATFORMS[platform.id].label}
            </div>
          ))}
          <div className="usage__item">
            <span className="usage__num">{submits}</span>
            actions in the last 24h
          </div>
          <div className="usage__item">
            <span className="usage__num">
              {Object.values(usage?.counts ?? {}).reduce<number>((sum, n) => sum + (n ?? 0), 0)}
            </span>
            drafts generated
          </div>
        </div>
      </Card>

      <Note tone="warn">
        Automation of commenting and messaging is against the terms of LinkedIn and X, and Meta
        restricts automated engagement. SocialMe reduces the risk — human pacing, caps, no
        duplicate text, warning detection — but the decision to auto-send is yours. On an account
        you care about, use Review.
      </Note>
    </>
  );
}
