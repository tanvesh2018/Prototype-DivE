import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { geminiGateway } from './server/aiPlugin';

// DealSync prototype — `npm start` runs this dev server on http://localhost:5173
// and mounts the Gemini gateway at /api/ai/* (key lives in .env.local).
export default defineConfig({
  plugins: [react(), geminiGateway()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: { chunkSizeWarningLimit: 1500 },
});
