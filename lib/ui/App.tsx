import { useCallback, useEffect, useRef, useState } from 'react';
import { getPublicSettings, watchSettings } from '@/lib/data/storage';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import type { PlatformId, PostContext, PublicSettings } from '@/lib/core/types';
import { OPEN_EVENT, TOGGLE_EVENT, type OpenPayload } from '@/lib/ui/bus';
import { Panel } from '@/lib/ui/Panel';
import { Icon } from '@/lib/ui/icons';
import { FeedGuide } from '@/lib/ui/FeedGuide';
import { assistantAction, getAssistantState, watchAssistant } from '@/lib/features/assistant/store';

interface AppProps {
  adapter: PlatformAdapter;
  platform: PlatformId;
}

function findPostAncestor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const candidate = target.closest<HTMLElement>(
    'article, div[role="article"], [role="listitem"], div.feed-shared-update-v2, div[data-urn]',
  );
  return candidate ?? null;
}

export function App({ adapter, platform }: AppProps) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [post, setPost] = useState<PostContext | null>(null);
  const [postEl, setPostEl] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    void getAssistantState().then((state) => setPaused(Boolean(state.paused[platform]))).catch(() => undefined);
    return watchAssistant((state) => setPaused(Boolean(state.paused[platform])));
  }, [platform]);

  const lastHovered = useRef<HTMLElement | null>(null);
  const hoverStamp = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    getPublicSettings()
      .then(setSettings)
      .catch(() => undefined);
    const unwatch = watchSettings(() => {
      getPublicSettings()
        .then(setSettings)
        .catch(() => undefined);
    });
    return unwatch;
  }, []);

  const applyTheme = useCallback((theme: PublicSettings['theme'] | undefined) => {
    return theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : theme ?? 'dark';
  }, []);

  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    setResolvedTheme(applyTheme(settings?.theme));
    if (settings?.theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setResolvedTheme(media.matches ? 'light' : 'dark');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [settings?.theme, applyTheme]);

  const openPanel = useCallback(
    (el: HTMLElement | null) => {
      const target = el ?? lastHovered.current;
      if (target && target.isConnected) {
        const context = adapter.readPost(target);
        setPost(context);
        setPostEl(context ? target : null);
      } else {
        setPost(null);
        setPostEl(null);
      }
      setOpen(true);
    },
    [adapter],
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenPayload>).detail;
      openPanel(detail?.el ?? null);
    };
    const onToggle = () => open ? setOpen(false) : openPanel(null);
    document.addEventListener(OPEN_EVENT, onOpen);
    document.addEventListener(TOGGLE_EVENT, onToggle);
    return () => {
      document.removeEventListener(OPEN_EVENT, onOpen);
      document.removeEventListener(TOGGLE_EVENT, onToggle);
    };
  }, [openPanel, open]);

  // Track the post under the cursor so the floating button always has a target.
  useEffect(() => {
    const onHover = (event: MouseEvent) => {
      const now = Date.now();
      if (now - hoverStamp.current < 300) return;
      hoverStamp.current = now;
      const candidate = findPostAncestor(event.target);
      if (!candidate) return;
      try {
        if (adapter.readPost(candidate)) lastHovered.current = candidate;
      } catch {
        // ignore malformed DOM
      }
    };
    document.addEventListener('mouseover', onHover, true);
    return () => document.removeEventListener('mouseover', onHover, true);
  }, [adapter]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const combo = (event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'a';
      if (combo) {
        event.preventDefault();
        if (open) setOpen(false);
        else openPanel(null);
      } else if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, openPanel]);

  if (!settings) return null;
  if (paused) return <div className="ap-root" data-theme={resolvedTheme}><button className="ap-launcher" onClick={() => { void assistantAction({ kind: 'pause', platform, paused: false }).catch(() => showToast('Could not resume. Try Assistant settings.')); }}>SocialMe paused · Resume</button>{toast ? <div className="ap-toast">{toast}</div> : null}</div>;

  return (
    <div className="ap-root" data-theme={resolvedTheme}>
      {open && !post ? <FeedGuide adapter={adapter} settings={settings} onSelect={openPanel} onClose={() => setOpen(false)} /> : open ? (
        <Panel
          key={`${post?.url ?? ''}\n${post?.author ?? ''}\n${post?.text ?? ''}`}
          settings={settings}
          adapter={adapter}
          platform={platform}
          post={post}
          postEl={postEl}
          onClose={() => setOpen(false)}
          onToast={showToast}
        />
      ) : (
        <button
          className="ap-launcher"
          onClick={() => openPanel(null)}
          title="SocialMe (⌘⇧A)"
          aria-label="Open SocialMe"
        >
          <Icon name="spark" size={14} />
          <span>SocialMe</span>
        </button>
      )}
      {toast ? <div className="ap-toast">{toast}</div> : null}
    </div>
  );
}
