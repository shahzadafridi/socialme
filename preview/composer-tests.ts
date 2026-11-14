import { installComposerButtons } from '@/lib/ui/composer';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import type { PostContext } from '@/lib/core/types';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const post: PostContext = {
  platform: 'linkedin',
  url: 'https://example.test/post',
  author: 'Maya Chen',
  text: 'We stopped doing quarterly roadmaps last year and our cycle time dropped 34%.',
  meta: '1,284 reactions',
};

/** Exercises the in-composer button end to end against the mocked background port. */
export async function runComposerTest(): Promise<Array<{ name: string; ok: boolean; detail?: string }>> {
  const results: Array<{ name: string; ok: boolean; detail?: string }> = [];
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;top:150px;left:40px;width:420px;padding:14px;background:#fff;border:1px solid #ccc;border-radius:10px;z-index:10';
  const editor = document.createElement('div');
  editor.contentEditable = 'true';
  editor.setAttribute('role', 'textbox');
  editor.setAttribute('aria-label', 'Write a comment…');
  editor.style.cssText = 'min-height:64px;border:1px solid #bbb;padding:8px;border-radius:8px;font-size:13px';
  host.appendChild(editor);

  // Mirror LinkedIn's icon toolbar: icon-only buttons with no text.
  const toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid #eee';
  for (const label of ['Emoji', 'GIF', 'Image']) {
    const icon = document.createElement('button');
    icon.type = 'button';
    icon.setAttribute('aria-label', label);
    icon.style.cssText = 'width:32px;height:32px;border:0;background:transparent;cursor:pointer';
    icon.innerHTML =
      '<svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="#666" stroke-width="1.4"><circle cx="8" cy="8" r="5.5"/></svg>';
    toolbar.appendChild(icon);
  }
  host.appendChild(toolbar);

  const submit = document.createElement('button');
  submit.type = 'button';
  submit.setAttribute('aria-label', 'Comment');
  submit.textContent = 'Comment';
  submit.style.cssText = 'margin-left:auto;padding:6px 12px;border:0;border-radius:16px;background:#0a66c2;color:#fff';
  toolbar.appendChild(submit);

  document.body.appendChild(host);

  const adapter: PlatformAdapter = {
    id: 'linkedin',
    isSupportedPage: () => true,
    findPosts: () => [],
    readPost: () => post,
    actionAnchor: () => null,
    openReplyEditor: async () => editor,
    submitButton: () => null,
        hasContent: () => true,
    findOpenEditors: () => [editor],
    findMessageComposers: () => [],
    readConversation: () => null,
    postForEditor: () => document.body,
  };

  const cleanup = installComposerButtons(adapter, () => true);
  await sleep(200);

  const button = document.querySelector<HTMLButtonElement>('.socialme-quick');
  results.push({
    name: 'button mounts on an open comment box',
    ok: Boolean(button),
    detail: button
      ? `display=${getComputedStyle(button).display} parent=${button.parentElement?.className || button.parentElement?.tagName}`
      : 'missing',
  });

  if (!button) {
    cleanup();
    host.remove();
    return results;
  }

  button.click();
  await sleep(200);
  const menuRow = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.socialme-tone-menu button'),
  ).find((node) => node.textContent === 'Default');
  results.push({
    name: 'tone menu opens on click',
    ok: Boolean(menuRow),
    detail: `${document.querySelectorAll('.socialme-tone-menu button').length} options`,
  });
  menuRow?.click();

  for (let i = 0; i < 200; i++) {
    if (button.textContent === '✓') break;
    await sleep(100);
  }

  const text = editor.innerText ?? '';
  results.push({
    name: 'text is written into the comment box',
    ok: text.length > 40,
    detail: JSON.stringify(text.slice(0, 80)),
  });
  results.push({
    name: 'draft matches the requested topic',
    ok: /bottleneck|approvals|deploy/i.test(text),
    detail: JSON.stringify(text.slice(0, 120)),
  });
  results.push({
    name: 'button reports success',
    ok: button.textContent === '✓',
    detail: button.textContent ?? '',
  });

  cleanup();
  host.remove();
  return results;
}
