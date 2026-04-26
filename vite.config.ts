import react from "@vitejs/plugin-react-swc";
import path from "path";
import { loadEnv } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const DEFAULT_BACKEND_API_URL = 'http://localhost:6650';
const normalizeApiUrl = (value?: string) => (value?.trim() || DEFAULT_BACKEND_API_URL).replace(/\/+$/, '');

// https://vitejs.dev/config/
export default ({ mode }: { mode: string }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendApiUrl = normalizeApiUrl(env.VITE_API_URL ?? process.env.VITE_API_URL);

  return {
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/api': {
        target: backendApiUrl,
        changeOrigin: true,
      },
    },
  },
  plugins: react(),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss, autoprefixer],
    },
  },
  define: {
    global: "globalThis",
  },
  // 프로덕션 환경에서 console.log와 debugger 제거
  esbuild: {
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
  worker: {
    format: 'es' as const,
    plugins: () => react(),
  },
  optimizeDeps: {
    include: ['simple-peer'],
  },
  // 프로덕션 빌드 최적화 설정
  build: {
    // 소스맵은 개발 환경에서만 생성 (프로덕션에서는 성능과 보안을 위해 제거)
    sourcemap: mode !== 'production',
    // 프로덕션 빌드 시 콘솔 제거를 더욱 확실하게 보장
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;

          if (
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor';
          }

          if (
            id.includes('react-router') ||
            id.includes('@tanstack/react-query') ||
            id.includes('zustand') ||
            id.includes('immer')
          ) {
            return 'state-vendor';
          }

          if (
            id.includes('/node_modules/video.js/') ||
            id.includes('/node_modules/@videojs/')
          ) {
            return 'video-core-vendor';
          }

          if (
            id.includes('/node_modules/videojs-') ||
            id.includes('/node_modules/mux.js/')
          ) {
            return 'video-streaming-vendor';
          }

          if (
            id.includes('/node_modules/pdfjs-dist/') ||
            id.includes('/node_modules/libass-wasm/') ||
            id.includes('/node_modules/subtitle/')
          ) {
            return 'pdf-vendor';
          }

          if (
            id.includes('simple-peer') ||
            id.includes('socket.io-client') ||
            id.includes('webrtc-adapter')
          ) {
            return 'realtime-vendor';
          }

          if (
            id.includes('@radix-ui') ||
            id.includes('lucide-react') ||
            id.includes('framer-motion') ||
            id.includes('embla-carousel-react')
          ) {
            return 'ui-vendor';
          }

          if (
            id.includes('lodash') ||
            id.includes('date-fns') ||
            id.includes('fuse.js') ||
            id.includes('zod')
          ) {
            return 'utils-vendor';
          }
        },
      },
    },
  },
  };
};
