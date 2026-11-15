import { useEffect, useRef, useState } from 'react';
import { readDiagnostics, type Diagnostics } from '@/lib/features/diagnostics';
import { readHealth, type PlatformHealth } from '@/lib/ui/composer/health';
import { exportAll, importAll, clearHistory, getHistory } from '@/lib/data/storage';
import { PLATFORMS } from '@/lib/core/constants';
import type { PlatformId, Settings } from '@/lib/core/types';
import { Button, Card, Note } from '@/entrypoints/options/ui';

const PLATFORM_IDS: PlatformId[] = ['linkedin', 'x', 'facebook'];

export function DataTab({ onChange }: { onChange: (patch: Partial<Settings>) => void }) {
  const [historyCount, setHistoryCount] = useState(0);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [health, setHealth] = useState<Record<string, PlatformHealth>>({});
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    getHistory()
      .then((items) => setHistoryCount(items.length))
      .catch(() => undefined);
  };

  useEffect(refresh, []);

  const refreshDiagnostics = () => {
    readDiagnostics().then(setDiagnostics).catch(() => undefined);
  };

  const refreshHealth = () => {
    readHealth().then(setHealth).catch(() => undefined);
  };

  useEffect(refreshDiagnostics, []);
  useEffect(refreshHealth, []);

  const copyReport = async () => {
    const report = {
      version: Object.values(health)[0]?.version ?? 'unknown',
      generated: new Date().toISOString(),
      userAgent: navigator.userAgent,
      health,
      scan: diagnostics,
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      setMessage('Report copied. Paste it into a GitHub issue — it has no message content.');
    } catch {
      setMessage('Could not copy the report.');
    }
  };

  const download = async () => {
    try {
      const json = await exportAll();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `socialme-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage('Backup downloaded. API keys are not included.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  const upload = async (file: File) => {
    try {
      await importAll(await file.text());
      setMessage('Imported. Reload this page to see the changes.');
    } catch (error) {
      setMessage((error as Error).message);
    }
  };

  return (
    <>
      <div>
        <h1>Data</h1>
        <p className="lede">
          Everything SocialMe stores lives in this browser profile. Nothing is sent anywhere except
          your chosen AI provider.
        </p>
      </div>

      <Card title="Backup &amp; restore" desc="Settings and personas only. Keys are excluded on purpose.">
        <div className="row">
          <Button onClick={() => void download()}>Export JSON</Button>
          <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }}
          />
        </div>
        {message ? <Note>{message}</Note> : null}
      </Card>

      <Card title="Local history" desc={`${historyCount} drafts stored on this device.`}>
        <div className="row">
          <Button
            variant="danger"
            onClick={() => {
              void clearHistory();
              setHistoryCount(0);
              setMessage('History cleared.');
            }}
          >
            Clear draft history
          </Button>
        </div>
      </Card>

      <Card
        title="Composer health"
        desc="The content script checks every comment, DM and connection-note surface while you browse. Each platform keeps its own snapshot, so this list always shows all three."
        right={
          <Button small variant="ghost" onClick={() => { refreshHealth(); refreshDiagnostics(); }}>
            Refresh
          </Button>
        }
      >
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>
          <div style={{ color: 'var(--muted)', marginBottom: 10 }}>
            {PLATFORM_IDS.filter((id) => health[id]).length} of {PLATFORM_IDS.length} platforms checked
          </div>
          {PLATFORM_IDS.map((id) => {
            const item = health[id];
            const label = PLATFORMS[id].label;
            return (
              <div key={id} style={{ padding: '9px 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <b>{label}</b>
                  {item ? (
                    <>
                      <span style={{ color: item.ok ? 'var(--good)' : 'var(--bad)' }}>
                        {item.ok
                          ? 'all surfaces ok'
                          : `${item.problems.length} problem${item.problems.length === 1 ? '' : 's'}`}
                      </span>
                      <span style={{ color: 'var(--muted)' }}>
                        v{item.version} · {new Date(item.ts).toLocaleTimeString()}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--muted)' }}>not checked yet</span>
                  )}
                </div>

                {item ? (
                  <>
                    {item.surfaces.map((surface, index) => (
                      <div
                        key={`${surface.mode}-${index}`}
                        style={{
                          color: surface.ok ? 'var(--muted)' : 'var(--bad)',
                          fontFamily: 'var(--mono)',
                          fontSize: 11.5,
                        }}
                      >
                        {surface.ok ? 'ok ' : 'bad'} {surface.mode.padEnd(8)} {surface.editor} ·{' '}
                        {surface.strategy} · submit={String(surface.submit)} · context=
                        {String(surface.context)} · {surface.button}
                        {surface.buttonVisible ? '' : ' (hidden)'}
                      </div>
                    ))}
                    {item.problems.map((problem) => (
                      <div key={problem} style={{ color: 'var(--bad)', fontSize: 11.5 }}>
                        {problem}
                      </div>
                    ))}
                    <div style={{ color: 'var(--muted)', fontSize: 11 }}>{item.url}</div>
                  </>
                ) : (
                  <div style={{ color: 'var(--muted)', fontSize: 11.5 }}>
                    Open {label} and start a comment, DM or invite note. The check runs automatically
                    and appears here.
                  </div>
                )}
              </div>
            );
          })}
          <div style={{ marginTop: 10 }}>
            <Button small variant="ghost" onClick={copyReport}>
              Copy report
            </Button>
          </div>
        </div>
      </Card>

      <Card
        title="Last page scan"
        desc="What the extension sees on the social tab you used most recently. Useful when a platform redesign breaks a selector."
        right={
          <Button small variant="ghost" onClick={refreshDiagnostics}>
            Refresh
          </Button>
        }
      >
        {diagnostics ? (
          <div style={{ fontSize: 12, lineHeight: 1.7, color: 'var(--muted)' }}>
            <div>
              <b>{diagnostics.platform}</b> · {diagnostics.counts.posts} posts ·{' '}
              {diagnostics.counts.anchors} action rows · {diagnostics.counts.editors} open editors ·{' '}
              {new Date(diagnostics.ts).toLocaleTimeString()}
            </div>
            <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 11.5 }}>
              {Object.entries(diagnostics.probes)
                .map(([key, value]) => `${key}=${value}`)
                .join('  ')}
            </div>
            {diagnostics.samples.actionButton.length ? (
              <div style={{ marginTop: 6, fontFamily: 'var(--mono)', fontSize: 11.5, wordBreak: 'break-all' }}>
                {diagnostics.samples.actionButton.join(' < ')}
              </div>
            ) : null}
            {diagnostics.samples.actionLabels.length ? (
              <div style={{ marginTop: 4, fontSize: 11.5 }}>
                buttons: {diagnostics.samples.actionLabels.join(' · ')}
              </div>
            ) : null}
            {diagnostics.error ? (
              <div style={{ marginTop: 6, color: 'var(--bad)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                error: {diagnostics.error}
              </div>
            ) : null}
            {diagnostics.boot?.length ? (
              <div style={{ marginTop: 4, color: 'var(--warn)', fontFamily: 'var(--mono)', fontSize: 11.5 }}>
                boot: {diagnostics.boot.join(' | ')}
              </div>
            ) : null}
            <div style={{ marginTop: 4, fontSize: 11 }}>
              {diagnostics.url}
            </div>
          </div>
        ) : (
          <div className="card__desc">
            No scan recorded yet. Open LinkedIn, X or Facebook with the extension enabled.
          </div>
        )}
      </Card>

      <Card title="Shortcuts">
        <div className="shortcut-list">
          <div className="shortcut-row">
            <span className="shortcut-keys">
              <span className="kbd">⌘</span>
              <span className="kbd">⇧</span>
              <span className="kbd">A</span>
            </span>
            <span>Open or close the SocialMe panel on LinkedIn, X or Facebook</span>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-keys">
              <span className="kbd">Esc</span>
            </span>
            <span>Close the panel or the ✦ menu</span>
          </div>
          <div className="shortcut-row">
            <span className="shortcut-keys">
              <span className="kbd">⌘</span>
              <span className="kbd">↵</span>
            </span>
            <span>Send a reply once the draft is in the editor</span>
          </div>
        </div>
      </Card>

      <Card title="First-run tour" desc="Re-show the welcome card on the provider tab.">
        <Button variant="ghost" onClick={() => onChange({ onboarded: false })}>
          Show welcome again
        </Button>
      </Card>
    </>
  );
}
