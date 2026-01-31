import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      base: '/FinFree/',
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      // API keys should NOT be embedded in build - users enter their own via Settings UI
      define: {},
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
