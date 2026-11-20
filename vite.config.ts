import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // /poster/… → KOPIS 포스터 (배포에서는 vercel.json 의 같은 경로). 리캡 이미지가 포스터를 캔버스에 그리려면 같은 출처여야 한다
  // 포스터·소개 이미지 폴더의 이미지 파일만 넘긴다 (vercel.json 과 같은 제한)
  server: { port: 5173, proxy: { '^/poster/(pfmPoster|pfmIntroImage)/[A-Za-z0-9_.-]+\\.(jpe?g|png|gif|webp)$': { target: 'https://kopis.or.kr', changeOrigin: true, rewrite: (p) => p.replace(/^\/poster/, '/upload') } } },
})
