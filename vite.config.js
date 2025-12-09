import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/xmas-party/',  // <--- 這裡要跟你的 GitHub Repository 名字一樣，前後要有斜線
})