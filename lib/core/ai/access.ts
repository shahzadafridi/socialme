import { browser } from 'wxt/browser';

/** Must run directly from a settings-page click so Chrome can show its permission prompt. */
export function providerOrigin(baseUrl: string): string {
  let url: URL;
  try { url = new URL(baseUrl); } catch { throw new Error('Enter a valid provider base URL.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an HTTP or HTTPS provider URL without embedded credentials.');
  }
  return `${url.protocol}//${url.hostname}/*`;
}

export async function requestProviderAccess(baseUrl: string): Promise<void> {
  const granted = await browser.permissions.request({ origins: [providerOrigin(baseUrl)] });
  if (!granted) throw new Error('Provider access was not granted. Use Test connection to allow this host.');
}
