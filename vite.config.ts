import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

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
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
              if (id.includes('leaflet')) {
                return 'vendor-leaflet';
              }
              if (id.includes('pdfjs-dist') || id.includes('jspdf') || id.includes('html2canvas')) {
                return 'vendor-pdf-engine';
              }
              if (id.includes('lucide-react') || id.includes('canvas-confetti')) {
                return 'vendor-ui-icons';
              }
            }
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
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
