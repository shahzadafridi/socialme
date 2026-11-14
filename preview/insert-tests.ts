import { insertIntoEditor, looksInserted } from '@/lib/integrations/insert';
import { typeLikeHuman } from '@/lib/features/safety/humanize';

export interface InsertTest {
  name: string;
  ok: boolean;
  detail?: string;
}

/** Exercises the editor-writing strategies against real DOM nodes in a live browser. */
export async function runInsertTests(): Promise<InsertTest[]> {
  const results: InsertTest[] = [];
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0;width:420px';
  document.body.appendChild(host);

  const ce = document.createElement('div');
  ce.contentEditable = 'true';
  ce.style.cssText = 'min-height:40px;border:1px solid #ccc;padding:4px';
  host.appendChild(ce);

  const plain = await insertIntoEditor(ce, 'Hello from SocialMe');
  results.push({
    name: 'contenteditable insert',
    ok: plain && ce.innerText.trim() === 'Hello from SocialMe',
    detail: JSON.stringify(ce.innerText),
  });

  ce.innerHTML = 'old text';
  const replaced = await insertIntoEditor(ce, 'Replaced text');
  results.push({
    name: 'replaces existing content',
    ok: replaced && !/old text/.test(ce.innerText) && /Replaced/.test(ce.innerText),
    detail: JSON.stringify(ce.innerText),
  });

  const multiline = await insertIntoEditor(ce, 'Line one\n\nLine two');
  const text = ce.innerText;
  results.push({
    name: 'multiline text',
    ok: multiline && text.includes('Line one') && text.includes('Line two'),
    detail: JSON.stringify(text),
  });

  const ta = document.createElement('textarea');
  host.appendChild(ta);
  const area = await insertIntoEditor(ta, 'textarea text');
  results.push({
    name: 'textarea insert',
    ok: area && ta.value === 'textarea text',
    detail: JSON.stringify(ta.value),
  });

  results.push({
    name: 'verification rejects wrong text',
    ok: !looksInserted(ce, 'completely different content that is not there'),
  });

  results.push({
    name: 'verification accepts inserted text',
    ok: looksInserted(ce, text),
  });

  ce.innerHTML = '';
  const typed = await typeLikeHuman(ce, 'Typed like a human. Really does.', 'fast');
  results.push({
    name: 'human typing',
    ok: typed && /Typed like a human/.test(ce.innerText) && /Really does/.test(ce.innerText),
    detail: JSON.stringify(ce.innerText),
  });

  host.remove();
  return results;
}
