import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  // Respect PORT when a harness assigns one (e.g. Claude preview autoPort);
  // falls back to Vite's default 5173 for normal `npm run dev`.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
  plugins: [inspectAttr(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
