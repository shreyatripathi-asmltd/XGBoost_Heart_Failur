import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // MLflow tracking server (use this when you run: mlflow server ...)
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,  // keep false for local HTTP
        // no rewrite: we want /api/2.0/mlflow/... to pass through unchanged
      },

      // MLflow UI (use this when you run: mlflow ui ...)
      '/ajax-api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },

      // Classic artifact download (MLflow 1.x)
      '/get-artifact': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },

      // Newer MLflow 2.x artifact routes
      '/mlflow-artifacts': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },

      // FastAPI training helper
      '/train-api': {
        target: 'http://127.0.0.1:5055',
        changeOrigin: true,
        secure: false,
        rewrite: p => p.replace(/^\/train-api/, ''),
      },
    },
  },
})
