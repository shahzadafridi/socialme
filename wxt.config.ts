import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  outDir: 'dist',
  manifest: {
    name: 'SocialMe — Build your brand on LinkedIn, X & Facebook',
    short_name: 'SocialMe',
    description:
      'Turn any post into a sharp reply in your own voice. Brand-first, human-paced, with account limits that keep you out of trouble.',
    version: '0.5.0',
    permissions: ['storage'],
    host_permissions: [
      'https://api.openai.com/*',
      'https://api.deepseek.com/*',
      'https://openrouter.ai/*',
      'https://api.anthropic.com/*',
      'https://generativelanguage.googleapis.com/*',
      'http://localhost/*',
      'http://127.0.0.1/*',
    ],
    action: {
      default_title: 'SocialMe',
    },
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      96: 'icon/96.png',
      128: 'icon/128.png',
    },
  },
});
