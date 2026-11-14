import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { OptionsApp } from '@/entrypoints/options/App';
import { PopupApp } from '@/entrypoints/popup/App';
import { getPublicSettings } from '@/lib/data/storage';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import type { PostContext, PublicSettings } from '@/lib/core/types';
import { Panel } from '@/lib/ui/Panel';
import { installComposerButtons } from '@/lib/ui/composer';
import { runInsertTests, type InsertTest } from './insert-tests';
import { runComposerTest } from './composer-tests';
import '@/lib/ui/theme.css';
import '@/entrypoints/popup/style.css';
import './page.css';

const mockPost: PostContext = {
  platform: 'linkedin',
  url: 'https://www.linkedin.com/feed/update/urn:li:activity:7000000000000000000/',
  author: 'Maya Chen',
  authorHeadline: 'VP Product at Northwind · ex-Stripe',
  text: 'We stopped doing quarterly roadmaps last year.\n\nNot because planning is bad. Because every roadmap turned into a negotiation about dates instead of a conversation about problems. Now we write one page per bet: the problem, the evidence, what we will stop doing to fund it.\n\nOur cycle time dropped 34%. The bigger win: nobody asks "when is it done" in week one anymore.',
  meta: '1,284 reactions · 96 comments',
};

const noop = () => {};
const fakeAdapter: PlatformAdapter = {
  id: 'linkedin',
  isSupportedPage: () => true,
  findPosts: () => [],
  readPost: () => mockPost,
  actionAnchor: () => null,
  openReplyEditor: async () => null,
  submitButton: () => null,
  openComposer: async () => null,
  submitPostButton: () => null,
  hasContent: () => false,
  findOpenEditors: () => [],
  findMessageComposers: () => [],
  readConversation: () => null,
  postForEditor: () => null,
};

function InsertView() {
  const [results, setResults] = useState<InsertTest[] | null>(null);

  useEffect(() => {
    const run = new URLSearchParams(location.search).get('view') === 'composer'
      ? runComposerTest()
      : runInsertTests();
    run
      .then((next) => {
        setResults(next as InsertTest[]);
        (window as unknown as { __insertResults: InsertTest[] }).__insertResults = next as InsertTest[];
      })
      .catch((error: Error) => {
        const failed: InsertTest[] = [{ name: 'crashed', ok: false, detail: error.message }];
        setResults(failed);
        (window as unknown as { __insertResults: InsertTest[] }).__insertResults = failed;
      });
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
      <h3 style={{ marginTop: 0 }}>insert tests</h3>
      {results
        ? results.map((result) => (
            <div key={result.name} style={{ color: result.ok ? '#0f9d63' : '#d64545' }}>
              {result.ok ? 'PASS' : 'FAIL'} — {result.name} {result.detail ? `· ${result.detail}` : ''}
            </div>
          ))
        : 'running…'}
    </div>
  );
}

function ComposerDemo() {
  useEffect(() => {
    const editor = document.getElementById('demo-editor');
    if (!(editor instanceof HTMLElement)) return;
    const adapter = {
      ...fakeAdapter,
      findOpenEditors: () => [editor],
    findMessageComposers: () => [],
    readConversation: () => null,
      postForEditor: () => document.body,
    } as PlatformAdapter;
    const cleanup = installComposerButtons(adapter, () => true);
    return () => cleanup();
  }, []);

  return (
    <div className="demo-post">
      <div className="fake-post" style={{ maxWidth: 620 }}>
        <div className="fake-avatar" />
        <div style={{ flex: 1 }}>
          <div className="fake-name">Maya Chen</div>
          <div className="fake-headline">VP Product at Northwind · ex-Stripe</div>
          <p className="fake-text">
            We stopped doing quarterly roadmaps last year. Cycle time dropped 34%, and nobody asks
            “when is it done” in week one anymore.
          </p>
          <div className="demo-commentbox">
            <div id="demo-editor" className="demo-editor" contentEditable suppressContentEditableWarning>
              Add a comment…
            </div>
            <div className="demo-actions">
              {['Emoji', 'GIF', 'Image'].map((label) => (
                <button key={label} type="button" aria-label={label} className="demo-icon-btn">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#666" strokeWidth="1.4">
                    <circle cx="8" cy="8" r="5.5" />
                  </svg>
                </button>
              ))}
              <button type="button" style={{ marginLeft: 'auto' }} className="demo-post-btn">
                Comment
              </button>
            </div>
          </div>
        </div>
      </div>
      <p className="demo-hint">
        The ✦ icon sits in the comment toolbar, next to the image button. One click streams a reply
        into the field.
      </p>
    </div>
  );
}

function PanelStage({ theme }: { theme: 'dark' | 'light' }) {  const [settings, setSettings] = useState<PublicSettings | null>(null);
  useEffect(() => {
    getPublicSettings().then(setSettings);
  }, []);
  if (!settings) return null;

  return (
    <div className="stage">
      <div className="fake-feed">
        <div className="fake-post">
          <div className="fake-avatar" />
          <div>
            <div className="fake-name">Maya Chen</div>
            <div className="fake-headline">VP Product at Northwind · ex-Stripe</div>
            <p className="fake-text">{mockPost.text.split('\n')[0]}</p>
          </div>
        </div>
        <div className="fake-post">
          <div className="fake-avatar" />
          <div>
            <div className="fake-name">Dan Okafor</div>
            <div className="fake-headline">Engineering lead</div>
            <p className="fake-text">
              Code review is not a quality gate. It is a knowledge transfer mechanism that happens
              to catch bugs.
            </p>
          </div>
        </div>
      </div>

      <div className="ap-root" data-theme={theme}>
        <Panel
          settings={settings}
          adapter={fakeAdapter}
          platform="linkedin"
          post={mockPost}
          postEl={null}
          task="reply"
          onTask={noop}
          onClose={noop}
          onToast={(message) => console.log(message)}
        />
      </div>
    </div>
  );
}

function App() {
  const params = new URLSearchParams(location.search);
  const view = params.get('view') ?? 'panel';

  if (view === 'insert' || view === 'composer') return <InsertView />;
  if (view === 'composer-demo') return <ComposerDemo />;
  if (view === 'brand') return <OptionsApp initialTab="brand" />;
  if (view === 'safety') return <OptionsApp initialTab="safety" />;
  if (view === 'options') return <OptionsApp />;
  if (view === 'popup')
    return (
      <div className="popup-stage">
        <PopupApp />
      </div>
    );
  return <PanelStage theme={view === 'panel-light' ? 'light' : 'dark'} />;
}

createRoot(document.getElementById('root')!).render(<App />);
