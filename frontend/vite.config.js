import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// 🚨 NOVO: Importa as utilidades para resolver caminho em ES Modules
import { fileURLToPath } from 'url'

// 🚨 Define __dirname/___filename manualmente para compatibilidade com path.resolve
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      // Usa a variável __dirname redefinida para mapear os aliases
      '@': path.resolve(__dirname, './src'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@assets': path.resolve(__dirname, './src/assets'),
      '@shared': path.resolve(__dirname, '../shared')
    }
  },

  // O root deve ser a pasta 'frontend' (onde está o index.html)
  root: path.resolve(__dirname, '.'),

  build: {
    outDir: path.resolve(__dirname, '../dist/public'),
    emptyOutDir: true
  },

  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true
  }
})
