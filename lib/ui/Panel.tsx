import { browser } from 'wxt/browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeDraft } from '@/lib/core/ai/quality';
import { ANGLES, LENGTHS, PLATFORMS, TONES } from '@/lib/core/constants';
import { deliverDraft, autoDelay } from '@/lib/features/deliver';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import { checkAllowance, formatWait } from '@/lib/features/safety/limits';
import { dismissWarning, subscribeWarning } from '@/lib/features/safety/watch';
import { addHistory, getHistory, getUsage, recordUsage, saveLastDraft } from '@/lib/data/storage';
import type {
  Angle,
  GenerateRequest,
  HistoryItem,
  Length,
  OutputMode,
  PlatformId,
  PortMessage,
  PostContext,
  PublicSettings,
  TaskKind,
} from '@/lib/core/types';
import { Icon } from '@/lib/ui/icons';
import { copyText, excerpt, openOptionsPage } from '@/lib/ui/util';

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

const ANGLE_LABEL = Object.fromEntries(ANGLES.map((a) => [a.id, a.label])) as Record<Angle, string>;

interface PanelProps {
  settings: PublicSettings;
  adapter: PlatformAdapter;
  platform: PlatformId;
  post: PostContext | null;
  postEl: HTMLElement | null;
  task: TaskKind;
  onTask: (task: TaskKind) => void;
  onClose: () => void;
  onToast: (message: string) => void;
}

type Status = { text: string; tone: 'ok' | 'warn' } | null;

export function Panel({
  settings,
  adapter,
  platform,
  post,
  postEl,
  task,
  onTask,
  onClose,
  onToast,
}: PanelProps) {
  const initialPersona =
    settings.platformPersona[platform] !== 'inherit'
      ? settings.platformPersona[platform]
      : settings.activePersonaId;

  const [personaId, setPersonaId] = useState(initialPersona);
  const [angle, setAngle] = useState<Angle>(settings.defaults.angle);
  const [tone, setTone] = useState(settings.defaults.tone || '');
  const [length, setLength] = useState<Length>(
    task === 'reply' ? settings.defaults.replyLength : settings.defaults.postLength,
  );
  const [language, setLanguage] = useState('auto');
  const [extra, setExtra] = useState(settings.defaults.extraInstruction || '');

  const [draft, setDraft] = useState('');
  const [rejected, setRejected] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [submittedToday, setSubmittedToday] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);

  const portRef = useRef<any>(null);
  const performRef = useRef<((submit: boolean) => Promise<void>) | null>(null);
  const submitRef = useRef<(() => void) | null>(null);
  const modeRef = useRef<OutputMode>('review');

  const mode: OutputMode =
    settings.platformOutputMode[platform] !== 'inherit'
      ? settings.platformOutputMode[platform]
      : settings.outputMode;

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const persona = useMemo(
    () => settings.personas.find((p) => p.id === personaId) ?? settings.personas[0],
    [settings.personas, personaId],
  );

  const limit = useMemo(() => {
    const base = task === 'reply' ? persona.replyMaxChars : persona.postMaxChars;
    if (task === 'reply') return platform === 'x' ? Math.min(base, 280) : Math.max(120, base);
    return Math.max(120, Math.min(base, PLATFORMS[platform].postLimit));
  }, [persona, task, platform]);

  const report = useMemo(
    () => (draft.trim() ? analyzeDraft(draft, platform, limit) : null),
    [draft, platform, limit],
  );

  useEffect(() => {
    setLength(task === 'reply' ? settings.defaults.replyLength : settings.defaults.postLength);
  }, [task, settings.defaults.replyLength, settings.defaults.postLength]);

  useEffect(() => {
    if (!settings.personas.some((p) => p.id === personaId)) {
      setPersonaId(settings.activePersonaId);
    }
  }, [settings.personas, settings.activePersonaId, personaId]);

  useEffect(() => {
    setDraft('');
    setRejected([]);
    setError(null);
    setStatus(null);
  }, [post?.url, task]);

  const refreshUsage = useCallback(() => {
    getUsage()
      .then((usage) => setSubmittedToday(usage.submitted[platform] ?? 0))
      .catch(() => undefined);
  }, [platform]);

  useEffect(() => {
    const unsubscribe = subscribeWarning(setWarning);
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    refreshUsage();
    getHistory()
      .then((items) => setHistory(items.filter((i) => i.platform === platform).slice(0, 4)))
      .catch(() => undefined);
  }, [refreshUsage, platform]);

  useEffect(() => {
    return () => {
      try {
        portRef.current?.disconnect();
      } catch {
        // ignore
      }
    };
  }, []);

  const stop = useCallback(() => {
    try {
      portRef.current?.postMessage({ type: 'cancel' });
    } catch {
      // ignore
    }
    setStreaming(false);
  }, []);

  const generate = useCallback(
    (isRegenerate = false) => {
      if (streaming) return;
      if (task === 'reply' && !post) return;
      if (task === 'post' && !extra.trim() && !post) {
        setStatus({ text: 'Describe what the post should be about first.', tone: 'warn' });
        return;
      }

      if (isRegenerate && draft.trim()) {
        setRejected((prev) => [...prev.slice(-2), draft.trim()]);
      }

      setError(null);
      setStatus(null);
      setDraft('');
      setStreaming(true);

      const request: GenerateRequest = {
        task,
        platform,
        post:
          post && task !== 'post'
            ? { author: post.author, text: post.text, meta: post.meta }
            : undefined,
        personaId: persona.id,
        angle,
        tone: tone || undefined,
        length,
        language,
        extra: extra.trim() || undefined,
        avoid: isRegenerate ? [...rejected, draft].filter(Boolean).slice(-3) : rejected,
      };

      let port: any;
      try {
        port = browser.runtime.connect({ name: 'socialme:gen' });
      } catch {
        setStreaming(false);
        setError({ message: 'Could not reach the extension background. Reload the page.', code: 'port' });
        return;
      }
      portRef.current = port;

      port.onMessage.addListener((message: PortMessage) => {
        if (message.type === 'delta') {
          setDraft((prev) => prev + message.text);
        } else if (message.type === 'done') {
          setDraft(message.text.trim());
          setStreaming(false);
          try {
            port.disconnect();
          } catch {
            // ignore
          }
          window.setTimeout(() => {
            const active = modeRef.current;
            if (active === 'insert') {
              void performRef.current?.(false);
            } else if (active === 'auto') {
              if (settings.autoSubmit.enabled) submitRef.current?.();
              else
                setStatus({
                  text: 'Auto-post is off in settings — review and insert manually.',
                  tone: 'warn',
                });
            }
          }, 400);
        } else if (message.type === 'error') {
          setStreaming(false);
          if (message.code !== 'aborted') {
            setError({ message: message.error, code: message.code });
          }
          try {
            port.disconnect();
          } catch {
            // ignore
          }
        }
      });

      port.onDisconnect.addListener(() => {
        setStreaming(false);
        portRef.current = null;
      });

      port.postMessage({ type: 'start', request });
    },
    [angle, draft, extra, language, length, persona.id, platform, post, rejected, streaming, task, tone],
  );

  const resolveEditor = useCallback(async (): Promise<HTMLElement | null> => {
    if (task === 'reply') {
      return postEl ? adapter.openReplyEditor(postEl) : null;
    }
    return adapter.openComposer();
  }, [adapter, postEl, task]);

  const perform = useCallback(
    async (submit: boolean) => {
      const text = draft.trim();
      if (!text) return;
      setConfirming(false);
      setError(null);
      setStatus({
        text: settings.safety.humanTyping
          ? submit
            ? 'Opening the editor and typing…'
            : 'Typing into the editor…'
          : submit
            ? 'Opening the editor…'
            : 'Finding the editor…',
        tone: 'ok',
      });

      try {
        const editor = await resolveEditor();
        if (!editor) {
          const copied = await copyText(text);
          setStatus({
            text: copied
              ? "Couldn't find the editor. Draft copied to your clipboard."
              : "Couldn't find the editor.",
            tone: 'warn',
          });
          onToast(copied ? 'Draft copied — paste it manually' : 'Editor not found');
          return;
        }

        const result = await deliverDraft(adapter, {
          editor,
          text,
          submit,
          humanTyping: settings.safety.humanTyping,
          typingSpeed: settings.safety.typingSpeed,
          delayMs: submit
            ? autoDelay(settings.autoSubmit.minDelayMs, settings.autoSubmit.maxDelayMs)
            : 0,
        });

        if (!result.inserted) {
          setStatus({ text: result.reason ?? 'Insert failed.', tone: 'warn' });
          return;
        }

        void saveLastDraft(text);
        if (settings.historyEnabled) {
          void addHistory({
            platform,
            task,
            personaId: persona.id,
            angle,
            postExcerpt: post?.text ?? extra,
            draft: text,
            submitted: result.submitted,
          });
        }

        if (submit && result.submitted) {
          void recordUsage(platform, 'submit');
          setStatus({ text: 'Posted. Check the page to confirm.', tone: 'ok' });
          onToast('Posted');
          refreshUsage();
        } else if (submit) {
          setStatus({ text: result.reason ?? 'Inserted — press send to publish.', tone: 'warn' });
        } else {
          setStatus({ text: 'Inserted. Review it on the page, then send.', tone: 'ok' });
          onToast('Inserted into the editor');
        }
      } catch (err) {
        setStatus({ text: (err as Error).message || 'Something went wrong.', tone: 'warn' });
      }
    },
    [
      adapter,
      angle,
      draft,
      extra,
      persona.id,
      platform,
      post,
      refreshUsage,
      resolveEditor,
      settings.autoSubmit.maxDelayMs,
      settings.autoSubmit.minDelayMs,
      settings.historyEnabled,
      settings.safety.humanTyping,
      settings.safety.typingSpeed,
      task,
      onToast,
    ],
  );

  const requestSubmit = useCallback(async () => {
    if (warning && settings.safety.pauseOnWarning) {
      setStatus({
        text: 'The page is showing an account warning. Resolve it before posting again.',
        tone: 'warn',
      });
      return;
    }

    const allowance = await checkAllowance(platform, settings.safety);
    if (!allowance.allowed) {
      setStatus({
        text: `${allowance.reason ?? 'Limit reached.'}${
          allowance.retryInSec ? ` Next slot in ${formatWait(allowance.retryInSec)}.` : ''
        }`,
        tone: 'warn',
      });
      return;
    }

    if (settings.autoSubmit.requireConfirm) {
      setConfirming(true);
      return;
    }
    void perform(true);
  }, [
    perform,
    platform,
    settings.autoSubmit.requireConfirm,
    settings.safety,
    warning,
  ]);

  useEffect(() => {
    performRef.current = perform;
  }, [perform]);

  useEffect(() => {
    submitRef.current = requestSubmit;
  }, [requestSubmit]);

  const copyDraft = useCallback(async () => {
    const ok = await copyText(draft.trim());
    onToast(ok ? 'Copied' : 'Copy failed');
  }, [draft, onToast]);

  const describeAction = task === 'reply' ? 'Generate reply' : task === 'post' ? 'Generate post' : 'Repurpose post';
  const canAuto = settings.autoSubmit.enabled;
  const sourceText = post?.text?.trim() ?? '';

  return (
    <>
      <div className="ap-panel" role="dialog" aria-label="SocialMe">
        <div className="ap-head">
          <div className="ap-logo">
            <Icon name="spark" size={13} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="ap-title">SocialMe</div>
            <div className="ap-sub">
              {settings.providerLabel} · {settings.model || 'no model'}
            </div>
          </div>
          <div className="ap-head__spacer" />
          <button className="ap-iconbtn" title="Settings" onClick={openOptionsPage}>
            <Icon name="gear" size={14} />
          </button>
          <button className="ap-iconbtn" title="Close (Esc)" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>

        <div className="ap-body">
          <div className="ap-tabs">
            {(['reply', 'post', 'repurpose'] as TaskKind[]).map((tab) => (
              <button
                key={tab}
                className="ap-tab"
                data-active={task === tab}
                onClick={() => onTask(tab)}
                disabled={tab !== 'post' && !post}
                title={
                  tab !== 'post' && !post ? 'Open a post first, or use the inline ✦ button' : undefined
                }
                style={tab !== 'post' && !post ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}
              >
                {tab === 'reply' ? 'Reply' : tab === 'post' ? 'New post' : 'Repurpose'}
              </button>
            ))}
          </div>

          {warning ? (
            <div className="ap-warnbox">
              <b>Account warning detected on this page.</b>
              <div style={{ marginTop: 3 }}>{warning}</div>
              <button
                className="ap-btn ap-btn--ghost"
                style={{ padding: '2px 0', fontSize: 11, marginTop: 4 }}
                onClick={() => dismissWarning()}
              >
                I have handled it
              </button>
            </div>
          ) : null}

          {task !== 'post' &&
            (post ? (
              <div className="ap-source" data-expanded={expanded}>
                <div className="ap-source__top">
                  <span className="ap-source__author">{post.author}</span>
                  {post.meta ? <span className="ap-source__meta">· {excerpt(post.meta, 40)}</span> : null}
                </div>
                <div className="ap-source__text">
                  {sourceText || 'No text detected in this post (image or video only).'}
                </div>
                {sourceText.length > 190 ? (
                  <button className="ap-source__more" onClick={() => setExpanded((v) => !v)}>
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                ) : null}
                {!sourceText ? (
                  <div className="ap-source__empty">
                    Add context below so the draft is not generic.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="ap-source">
                <div className="ap-source__empty">
                  No post selected. Hover a post and click <b>✦ SocialMe</b> in its action bar, or press{' '}
                  <span className="ap-kbd">⌘⇧A</span>.
                </div>
              </div>
            ))}

          <div>
            <div className="ap-label">
              <span>Voice</span>
              <button
                className="ap-chip ap-chip--sm"
                onClick={openOptionsPage}
                title="Edit personas"
              >
                Edit
              </button>
            </div>
            <select
              className="ap-select"
              value={persona.id}
              onChange={(event) => setPersonaId(event.target.value)}
            >
              {settings.personas.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.emoji ? `${option.emoji} ` : ''}
                  {option.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="ap-label">
              <span>Angle</span>
              <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                {angle === 'insight' ? 'default' : ''}
              </span>
            </div>
            <div className="ap-chips">
              {ANGLES.map((option) => (
                <button
                  key={option.id}
                  className="ap-chip"
                  data-active={angle === option.id}
                  onClick={() => setAngle(option.id)}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ap-row">
            <div style={{ flex: 1.35 }}>
              <div className="ap-label">Tone</div>
              <select
                className="ap-select"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
              >
                <option value="">Persona default</option>
                {TONES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <div className="ap-label">Length</div>
              <div className="ap-seg">
                {LENGTHS.map((option) => (
                  <button
                    key={option.id}
                    data-active={length === option.id}
                    onClick={() => setLength(option.id)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ap-row">
            <div style={{ flex: 1 }}>
              <div className="ap-label">Language</div>
              <select
                className="ap-select"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                {LANGUAGES.map((option) => (
                  <option key={option} value={option}>
                    {option === 'auto' ? 'Match the post' : option}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: 1.6 }}>
              <div className="ap-label">{task === 'post' ? 'Topic' : 'This one'}</div>
              <input
                className="ap-input"
                value={extra}
                onChange={(event) => setExtra(event.target.value)}
                placeholder={
                  task === 'post' ? 'e.g. what I learned shipping v1' : 'e.g. mention the 3-week launch'
                }
              />
            </div>
          </div>

          {error ? (
            <div className="ap-error">
              {error.message}
              {error.code === 'no_key' ||
              error.code === 'auth' ||
              error.code === 'model' ||
              error.code === 'config' ? (
                <>
                  {' '}
                  <a onClick={openOptionsPage} role="button" tabIndex={0}>
                    Open settings →
                  </a>
                </>
              ) : null}
            </div>
          ) : null}

          {draft || streaming ? (
            <div>
              <div className="ap-label">
                <span>Draft</span>
                {streaming ? (
                  <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 600 }}>
                    generating…
                  </span>
                ) : report ? (
                  <span
                    style={{
                      textTransform: 'none',
                      letterSpacing: 0,
                      fontWeight: 600,
                      color:
                        report.verdict === 'good'
                          ? 'var(--ap-good)'
                          : report.verdict === 'ok'
                            ? 'var(--ap-warn)'
                            : 'var(--ap-bad)',
                    }}
                  >
                    {report.verdict === 'good' ? 'strong' : report.verdict === 'ok' ? 'ok' : 'weak'}
                  </span>
                ) : null}
              </div>

              <div className="ap-draftwrap">
                <textarea
                  className={`ap-textarea ap-draft ${streaming ? 'ap-streaming' : ''}`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  spellCheck
                  readOnly={streaming}
                />
              </div>

              <div className="ap-draftfoot">
                <span className="ap-count" data-over={draft.length > limit}>
                  {draft.length} / {limit}
                </span>
                <span className="ap-hint">Edit before inserting · it stays yours</span>
              </div>

              {report ? (
                <>
                  <div className="ap-score">
                    <div className="ap-score__bar">
                      <div className="ap-score__fill" style={{ width: `${report.score}%` }} />
                    </div>
                    <span className="ap-score__label">{report.score}/100</span>
                  </div>
                  <div className="ap-quality">
                    {report.overLimit ? <span className="ap-q" data-tone="bad">too long</span> : null}
                    {report.bannedOpener ? <span className="ap-q" data-tone="bad">weak opener</span> : null}
                    {report.cliches.length ? (
                      <span className="ap-q" data-tone="warn">
                        cliché: {report.cliches[0]}
                      </span>
                    ) : null}
                    {report.hasNumber ? <span className="ap-q" data-tone="good">specific</span> : null}
                    {report.hasQuestion ? (
                      <span className="ap-q" data-tone="good">asks something</span>
                    ) : null}
                    {report.words >= 12 ? (
                      <span className="ap-q" data-tone="good">{report.words} words</span>
                    ) : null}
                    {!report.hasNumber && !report.hasQuestion && report.cliches.length === 0 ? (
                      <span className="ap-q">add a detail to stand out</span>
                    ) : null}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {showHistory && history.length ? (
            <div>
              <div className="ap-label">Recent</div>
              <div className="ap-history">
                {history.map((item) => (
                  <button
                    key={item.id}
                    className="ap-history__item"
                    onClick={() => {
                      setDraft(item.draft);
                      setShowHistory(false);
                    }}
                    title="Load this draft"
                  >
                    <span className="ap-dot" />
                    <span className="ap-history__text">{excerpt(item.draft, 120)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="ap-foot">
          {confirming ? (
            <div
              className="ap-warnbox"
              style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}
            >
              <span>Post this to {PLATFORMS[platform].label} now?</span>
              <span style={{ display: 'flex', gap: 6 }}>
                <button className="ap-btn" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button className="ap-btn ap-btn--primary" onClick={() => void perform(true)}>
                  Post
                </button>
              </span>
            </div>
          ) : null}

          {status ? (
            <div className="ap-status" data-tone={status.tone}>
              <span className="ap-dot" data-live={status.tone === 'ok'} />
              {status.text}
            </div>
          ) : null}

          {streaming ? (
            <button className="ap-btn ap-btn--wide" onClick={stop}>
              <Icon name="stop" size={13} /> Stop
            </button>
          ) : (
            <button
              className="ap-btn ap-btn--primary ap-btn--wide"
              onClick={() => generate(Boolean(draft.trim()))}
              disabled={task === 'reply' && !post}
              title={task === 'reply' && !post ? 'Select a post first' : undefined}
            >
              <Icon name="spark" size={14} />
              {draft.trim() ? 'Regenerate' : describeAction}
              {draft.trim() ? <Icon name="refresh" size={13} /> : null}
            </button>
          )}

          <div
            className="ap-actions"
            style={{ gridTemplateColumns: canAuto ? '0.75fr 1fr 1.25fr' : '1fr 1.4fr' }}
          >
            <button
              className="ap-btn"
              onClick={copyDraft}
              disabled={!draft.trim() || streaming}
              title="Copy the draft"
            >
              <Icon name="copy" size={13} />
              {canAuto ? null : 'Copy'}
            </button>
            <button
              className="ap-btn"
              onClick={() => void perform(false)}
              disabled={!draft.trim() || streaming}
              title="Insert into the editor, keep it for review"
            >
              Insert
            </button>
            {canAuto ? (
              <button
                className={`ap-btn ${settings.outputMode === 'auto' ? 'ap-btn--primary' : 'ap-btn--auto'}`}
                onClick={() => void requestSubmit()}
                disabled={!draft.trim() || streaming || Boolean(warning && settings.safety.pauseOnWarning)}
                title={
                  warning && settings.safety.pauseOnWarning
                    ? 'Resolve the account warning first'
                    : 'Insert and publish'
                }
              >
                Insert &amp; post
              </button>
            ) : null}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              className="ap-btn ap-btn--ghost"
              style={{ padding: '2px 6px', fontSize: 11 }}
              onClick={() => setShowHistory((v) => !v)}
              disabled={!history.length}
            >
              <Icon name="clock" size={12} /> {showHistory ? 'Hide' : 'Recent'}
            </button>
            {canAuto ? (
              <span className="ap-hint" style={{ fontSize: 10.5 }}>
                {submittedToday}/{settings.safety.maxActionsPerDay || '∞'} posted today
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

export { ANGLE_LABEL };
