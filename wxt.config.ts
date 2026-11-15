import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  outDir: 'dist',
  manifest: {
    name: 'SocialMe — Build your brand on LinkedIn, X & Facebook',
    short_name: 'SocialMe',
    description:
      'Write comments, message replies and connection notes in your own voice. Review before sending, with local usage limits.',
    permissions: ['storage'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
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
