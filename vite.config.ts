import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Cấu hình Vite 5: tích hợp React và alias đường dẫn (Tailwind dùng PostCSS)
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
