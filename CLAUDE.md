# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Serve production build locally
npm run lint      # ESLint check
```

No test suite exists. Validate UI changes by running `npm run dev` and testing in a browser — the storefront at `/`, the management app at `/crm/`.

## Architecture

**Box for You** is a single-page, offline-first management app for a cookie business. Navigation and layout live in [`src/App.jsx`](src/App.jsx); each feature is a module under [`src/modules/`](src/modules/).

**Stack:** React 19 + Vite 8 + Tailwind CSS 4 (via `@tailwindcss/vite`, no separate `tailwind.config`)

**Persistence:** Supabase (Postgres + realtime), via [`src/stores/DataProvider.jsx`](src/stores/DataProvider.jsx). Column names are snake_case in the DB and camelCase in the app — [`src/stores/mappers.js`](src/stores/mappers.js) translates both ways.

**Two pages, one project** (see `build.rollupOptions.input` in [`vite.config.js`](vite.config.js)):

| URL | Entry | What |
|-----|-------|------|
| `/` | `index.html` → [`src/loja/main.jsx`](src/loja/main.jsx) | Public storefront, no login |
| `/crm/` | `crm/index.html` → [`src/main.jsx`](src/main.jsx) | Owner's app, behind Supabase auth |

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

## Storefront (`src/loja/`)

The public page never touches tables: RLS still admits authenticated users only.
Anonymous visitors may execute exactly three SECURITY DEFINER functions, defined in
[`supabase/loja.sql`](supabase/loja.sql):

- `loja_cardapio()` — active flavors, box prices, stock, pickup/delivery copy
- `loja_criar_pedido(jsonb)` — validates, **recomputes the total server-side**,
  creates the client + order (`origem: 'loja'`, `status: 'pendente'`, unique
  `referencia`, structured `entrega`) and deducts stock
- `loja_ver_pedido(referencia, telefone)` — public order lookup; both values
  required, phone must match the customer

The cart lives in `localStorage` (`bfy:loja-cart-v1`) so a refresh does not
empty it; the order of record is still Postgres. Checkout asks **Levantar** or
**Entrega** (address only for delivery). Success is `/?p=XXXXXX`.

Prices sent by the browser are ignored by design. When changing anything about
pricing or stock, change it in the SQL function too — otherwise the store and the
POS drift apart.

Stock rules mirror `Feiras.jsx`: loose cookies and the Box come out of
`estoque(tipo:'cookie')`, the Mini Box is the pseudo-id `mini-box` in that same
bucket, and each Tasting Box takes one 50g cookie of every active flavor from
`estoque(tipo:'cookie50')`.

Orders carry a `linhas` entry with `customLabel` for Mini Box, Tasting Box and any
box beyond the first, so they read well in Vendas. Those lines are skipped by the
app's stock restore on cancel/delete (`deductPedidoStock` filters `customLabel`) —
the flavors of an extra box are not returned to stock automatically.

`src/loja/api.js` calls PostgREST with plain `fetch` rather than `supabase-js`, to
keep the customer-facing bundle small. Don't import `supabase-js` into `src/loja/`.
