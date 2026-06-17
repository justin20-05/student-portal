import { defineConfig } from 'vite'
import react from '@vitejs/react-vite-plugin'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
})
