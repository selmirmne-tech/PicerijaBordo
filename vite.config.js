
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  build: {
    target: ['safari15', 'ios15'],
    cssTarget: 'safari15',
  },

  server: {
    host: '0.0.0.0',
  },
})
