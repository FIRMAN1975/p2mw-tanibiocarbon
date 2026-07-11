import path from "path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- Plugin baru Tailwind untuk Vite
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"), // <-- Syarat wajib untuk shadcn/ui
    },
  },
})