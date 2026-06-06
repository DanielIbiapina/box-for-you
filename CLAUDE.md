# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Serve production build locally
npm run lint      # ESLint check
```

No test suite exists. Validate UI changes by running `npm run dev` and testing in a browser.

## Architecture

**Box for You** is a single-page, offline-first management app for a cookie business. Navigation and layout live in [`src/App.jsx`](src/App.jsx); each feature is a module under [`src/modules/`](src/modules/).

**Stack:** React 19 + Vite 8 + Tailwind CSS 4 (via `@tailwindcss/vite`, no separate `tailwind.config`)

**Persistence:** `localStorage` only — no server, no API calls.

### Modules

| Route id | Module | Purpose |
|----------|--------|---------|
| `home` | `Home.jsx` | Dashboard: revenue, stock alerts, upcoming fairs |
| `receitas` | `Receitas.jsx` | Recipe CRUD |
| `estoque` | `Estoque.jsx` | Ingredients and stock movements |
| `producao` | `Producao.jsx` | Production batches from recipes |
| `precificacao` | `Precificacao.jsx` | Price calculation |
| `relatorios` | `Relatorios.jsx` | Reports and export |
| `feiras` | `Feiras.jsx` | POS for fairs (~1100 lines; cart, checkout, metrics) |
| `config` | `Configuracoes.jsx` | Business settings, events, data reset |

### State / stores

Shared data uses hooks in [`src/stores/`](src/stores/) built on `useStorage`:

| Key | Store | Data |
|-----|-------|------|
| `bfy:receitas` | `useReceitas` | Recipes |
| `bfy:ingredientes` | `useEstoque` | Ingredients |
| `bfy:movimentacoes` | `useEstoque` | Stock movements |
| `bfy:eventos` | `useEventos` | Fairs / events |
| `bfy:configuracoes` | `useConfiguracoes` | Business config |
| `cookies-sales:v1` | `Feiras.jsx` (direct) | Sales; also read by `Home` and `Relatorios` |

### Feiras (POS) data model

Each sale appended to the `sales` array:
- `kind: 'single'` — individual cookie items from the cart
- `kind: 'box'` — fixed 4-cookie box with mixed flavors
- `kind: 'demo'` — free tasting (zero cost, tracked separately)
- `kind: 'order'` — multi-item mixed order

Two mutually exclusive input modes in Feiras:
- **Cart mode** (`cart` state): `{productId: quantity}` map
- **Order mode** (`order` state): `{kind, boxCounts, demoFlavorId}` for BOX/Demo flows

### Layout

[`App.jsx`](src/App.jsx) is a manual router (`useState` for active module). Responsive nav:
- **Desktop (≥1024px):** sidebar with labels
- **Tablet (768–1023px):** icon-only sidebar
- **Mobile (<768px):** bottom tab bar

Uses `h-[100dvh]` for mobile-safe full height. Feiras module uses `overflow-hidden`; other modules scroll.

### Styling

Design tokens and utility classes (`.bfy-card`, `.btn-accent`, `.btn-primary`, `.btn-ghost`, `.bfy-input`) are in [`src/index.css`](src/index.css).

### Static assets

Nav icons are served from [`public/icons/`](public/icons/) as `/icons/nav-*.png`. Add PNGs with the exact filenames referenced in `App.jsx` (`nav-inicio.png`, `nav-receitas.png`, etc.) plus `logo.png` for the tablet sidebar.
