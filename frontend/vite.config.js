import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@shared': path.resolve(__dirname, '../shared')
    }
  },

  root: path.resolve(__dirname, '.'),

  build: {
    // 💡 CORREÇÃO AQUI: Mudei para 'dist' simples.
    // Isso garante que o build fique dentro da pasta do projeto frontend.
    outDir: 'dist',
    emptyOutDir: true
  },

  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true
  }
})
