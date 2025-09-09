import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['pwa-192x192.svg', 'pwa-512x512.svg'],
          manifest: {
            name: 'Kitap Arşivi',
            short_name: 'KitapArsivi',
            description: 'Kitapları arşivlemek için bir uygulama',
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#4F46E5',
            lang: 'tr',
            scope: '/',
            icons: [
              {
                src: 'pwa-192x192.svg',
                sizes: '192x192',
                type: 'image/svg+xml',
              },
              {
                src: 'pwa-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
              },
              {
                src: 'pwa-512x512.svg',
                sizes: '512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable',
              },
            ],
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
