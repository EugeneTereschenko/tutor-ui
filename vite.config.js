import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    basicSsl(),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
  server: {
    host: true,
    https: true,
    port: 5173,
    proxy: {
      '/ws': {
        target: 'https://localhost:8080',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
  preview: {
    host: true,
    https: true,
    port: 5173,
    proxy: {
      '/ws': {
        target: 'https://localhost:8080',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
})
