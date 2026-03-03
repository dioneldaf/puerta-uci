import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/uci': {
        target: 'https://elasticintranet.uci.cu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/uci/, ''),
        secure: false,
      },
    },
  },
})
