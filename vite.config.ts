import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
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
  // esbuild: {
  //   drop: mode === 'production' ? ['console', 'debugger'] : [],
  // },
  worker: {
    format: 'es' as const,
    plugins: () => [react()],
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
        // 청크 분할 전략 (선택사항)
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
}));
