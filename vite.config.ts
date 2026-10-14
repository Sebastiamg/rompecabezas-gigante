import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5190,
  },
  build: {
    rolldownOptions: {
      output: {
        // Librerías en archivos propios: cambian poco, así el navegador las reutiliza entre versiones.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\/]three[\/]/, priority: 3 },
            { name: 'r3f', test: /node_modules[\/](@react-three|three-stdlib|zustand|its-fine|suspend-react)[\/]/, priority: 2 },
            { name: 'react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/, priority: 1 },
          ],
        },
      },
    },
    // three.js completo pesa ~700 kB sin comprimir (R3F lo necesita entero); no es un error.
    chunkSizeWarningLimit: 800,
  },
})
