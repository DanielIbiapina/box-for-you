import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Duas páginas no mesmo projeto:
//   /      → loja pública  (index.html      → src/loja/main.jsx)
//   /crm/  → app da gestão (crm/index.html  → src/main.jsx)
// A app de gestão fica fora da raiz de propósito: quem chega ao site não
// descobre que existe. A proteção a sério continua a ser o login Supabase.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        loja: 'index.html',
        crm: 'crm/index.html',
      },
    },
  },
})
