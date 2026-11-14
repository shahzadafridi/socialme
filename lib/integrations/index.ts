import type { PlatformId } from '@/lib/core/types';
import { facebookAdapter } from '@/lib/integrations/facebook';
import { linkedinAdapter } from '@/lib/integrations/linkedin';
import type { PlatformAdapter } from '@/lib/integrations/adapter';
import { xAdapter } from '@/lib/integrations/x';

export function getAdapter(): PlatformAdapter | null {
  const host = location.hostname;
  if (/(^|\.)linkedin\.com$/.test(host)) return linkedinAdapter;
  if (/(^|\.)(x|twitter)\.com$/.test(host)) return xAdapter;
  if (/(^|\.)facebook\.com$/.test(host)) return facebookAdapter;
  return null;
}

export function platformOf(hostname = location.hostname): PlatformId | null {
  if (/(^|\.)linkedin\.com$/.test(hostname)) return 'linkedin';
  if (/(^|\.)(x|twitter)\.com$/.test(hostname)) return 'x';
  if (/(^|\.)facebook\.com$/.test(hostname)) return 'facebook';
  return null;
}

export type { PlatformAdapter };
