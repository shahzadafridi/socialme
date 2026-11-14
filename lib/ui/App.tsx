import { useCallback, useEffect, useRef, useState } from 'react';
import { getPublicSettings, watchSettings } from '@/lib/data/storage';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import type { PlatformId, PostContext, PublicSettings, TaskKind } from '@/lib/core/types';
import { OPEN_EVENT, TOGGLE_EVENT, type OpenPayload } from '@/lib/ui/bus';
import { Panel } from '@/lib/ui/Panel';
import { Icon } from '@/lib/ui/icons';

interface AppProps {
  adapter: PlatformAdapter;
  platform: PlatformId;
}

function findPostAncestor(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  const candidate = target.closest<HTMLElement>(
    'article, div[role="article"], div.feed-shared-update-v2, div[data-urn]',
  );
  return candidate ?? null;
}

export function App({ adapter, platform }: AppProps) {
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState<TaskKind>('reply');
  const [post, setPost] = useState<PostContext | null>(null);
  const [postEl, setPostEl] = useState<HTMLElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
    (el: HTMLElement | null, nextTask?: TaskKind) => {
      const target = el ?? lastHovered.current;
      if (target && target.isConnected) {
        const context = adapter.readPost(target);
        setPost(context);
        setPostEl(target);
        setTask(nextTask ?? (context ? 'reply' : 'post'));
      } else {
        setPost(null);
        setPostEl(null);
        setTask(nextTask ?? 'post');
      }
      setOpen(true);
    },
    [adapter],
  );

  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenPayload>).detail;
      openPanel(detail?.el ?? null, detail?.task);
    };
    const onToggle = () => setOpen((value) => !value);
    document.addEventListener(OPEN_EVENT, onOpen);
    document.addEventListener(TOGGLE_EVENT, onToggle);
    return () => {
      document.removeEventListener(OPEN_EVENT, onOpen);
      document.removeEventListener(TOGGLE_EVENT, onToggle);
    };
  }, [openPanel]);

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
        setOpen((value) => !value);
      } else if (event.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  const onTask = useCallback(
    (next: TaskKind) => {
      setTask(next);
      if (next !== 'post' && !post && lastHovered.current) {
        const context = adapter.readPost(lastHovered.current);
        if (context) {
          setPost(context);
          setPostEl(lastHovered.current);
        }
      }
    },
    [adapter, post],
  );

  if (!settings) return null;

  return (
    <div className="ap-root" data-theme={resolvedTheme}>
      {open ? (
        <Panel
          settings={settings}
          adapter={adapter}
          platform={platform}
          post={post}
          postEl={postEl}
          task={task}
          onTask={onTask}
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
