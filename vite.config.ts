import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // amazon-cognito-identity-js (via its crypto-js dependency) references
    // Node's `global` object, which browsers don't have.
    global: 'globalThis',
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('pocketbase')) return 'pocketbase'
            if (id.includes('@tanstack')) return 'query'
            if (id.includes('react')) return 'vendor'
          }
        },
      },
    },
  },
})
