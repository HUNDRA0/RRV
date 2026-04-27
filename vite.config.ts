import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forward API + photo asset requests to the Express server during dev.
      '/api': 'http://localhost:3001',
      '/photos': 'http://localhost:3001',
    },
  },
});
