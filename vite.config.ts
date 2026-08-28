import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

// Trigger rebuild for AI Studio Preview Environment 2
export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      sourcemap: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/asaas-proxy': {
          target: 'https://api.asaas.com/v3',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/asaas-proxy/, ''),
          headers: {
            'User-Agent': 'GoFieldPro/2.6.0',
          },
        },
        '/api/asaas-sandbox-proxy': {
          target: 'https://sandbox.asaas.com/api/v3',
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/api\/asaas-sandbox-proxy/, ''),
          headers: {
            'User-Agent': 'GoFieldPro/2.6.0',
          },
        },
      },
    },
  };
});
