//this sets up vite to run the development server on the 5173 port, so it just tells vite how to run the application during the development phase

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
     proxy: { '/api': 'http://localhost:8000' }
  },
});
