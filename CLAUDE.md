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

Typography comes from the logo (Google Fonts, linked in `index.html` / `crm/index.html`):
- `--font-marca` **Climate Crisis** — the "CRUMB" lettering. Store only, big titles,
  always uppercase (lowercase i/j have cuts that read as colons). One weight: the
  `YEAR` axis sets how heavy (1979 = as in the logo, 2000 = lighter for medium titles).
  Never ask it for bold — the browser would fake one.
- `--font-title` / `--font-body` **Archivo** — titles use it wide (`font-stretch` 110–115%) and heavy.
- `--font-script` **Mr Dafoe** — the "Lab" brush; only small touches (greeting, handwritten note).

**No emoji in the UI**, and none of the other "vibe-coded" tells either: em dashes in
prose, cards with a coloured left border, stock pill badges. Keep accents discreet
(the header WhatsApp is a plain link with a drawn speech-bubble icon). Icons are hand-drawn SVGs in [`src/loja/icones.jsx`](src/loja/icones.jsx)
(24×24, round 1.9 stroke, `currentColor`), shared by the store and the CRM. Draw a new
one there rather than reaching for an emoji or an icon library. (The CRM still has
emoji as *data* — the recipe/flavour `emoji` fields — which is a separate cleanup.)

### Legal page (`/legal/`)

Third Vite entry: `legal/index.html` → [`src/loja/legal-main.jsx`](src/loja/legal-main.jsx) →
[`InfoLegal.jsx`](src/loja/InfoLegal.jsx). Seller identification, purchase terms,
delivery, returns (no 14-day withdrawal for perishable food, DL 24/2014 art. 17.º),
allergens, complaints (Livro de Reclamações + CICAP) and GDPR — required by Ifthenpay
and Portuguese e-commerce law. Seller data lives in `configuracao.loja_legal`
(edited in Definições → Dados legais, `DadosLegais.jsx`) and reaches the store through
`loja_cardapio().legal`; delivery fees, hours and pickup places come from the same
RPC, so the page never drifts from the checkout. The store footer is
[`RodapeLegal.jsx`](src/loja/RodapeLegal.jsx).

### Static assets

Nav icons are served from [`public/icons/`](public/icons/) as `/icons/nav-*.png`. Add PNGs with the exact filenames referenced in `App.jsx` (`nav-inicio.png`, `nav-receitas.png`, etc.) plus `logo.png` for the tablet sidebar.

## Storefront (`src/loja/`)

The public page never touches tables: RLS still admits authenticated users only.
Anonymous visitors may execute only the SECURITY DEFINER functions granted at the end
of [`supabase/loja.sql`](supabase/loja.sql) (also `loja_validar_cupom` and
`loja_criar_pedido_black`); the main ones:

- `loja_cardapio()` — active flavors, box prices, stock, pickup/delivery copy
- `loja_criar_pedido(jsonb)` — validates, **recomputes the total server-side**,
  creates the client + order (`origem: 'loja'`, `status: 'pendente'`, unique
  `referencia`, structured `entrega`) and deducts stock
- `loja_ver_pedido(referencia, telefone)` — public order lookup; both values
  required, phone must match the customer

The cart lives in `localStorage` (`bfy:loja-cart-v2`: `picks`, the flavors in
tap order, plus `extras` for Mini/Tasting) so a refresh does not empty it; a v1
cart is converted on first read. The order of record is still Postgres.

There is no "Box or loose" choice: every `box.size` picks close a Box
automatically (`util.agrupar`, only when the Box is cheaper than the loose
price); the remainder goes as loose cookies. The client sends that split as
`caixas` + `itens`, and the server re-prices it.

Checkout is one decision per screen (`Checkout.jsx`): order → Levantar/Entrega
→ day → address (delivery only) → contact → payment → confirm. Success is
`/?p=XXXXXX`. Sounds live in `sensacao.js`, gesture animations in `voar.js`;
both switch off under `prefers-reduced-motion`.

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

The delivery fee is a straight-line distance from the origin set in the CRM
(`EntregaTaxa.jsx`) to the customer's street, worked out in the browser by
`src/loja/geo.js` and re-priced by `loja_criar_pedido` from the lat/lng it sends.
The 4-digit postal code picks a search area from `public/cp4.json` (GeoNames,
regenerate with `node scripts/gerar-cp.mjs PT.txt`). Those points are municipality
centres, too coarse for the fee itself. The street is then looked up in
OpenStreetMap inside that area, and a result counts only when both the street name
and the first 4 digits of OSM's postcode match (on a long street whose stretches are
far apart, the stretch with the nearest postcode wins). Never fall back to a free-text
search for the street: it matches same-named streets in other towns.

If the street is not found, the **locality** is searched inside the same postcode area
(the full text, "Gandra, Paredes", to avoid a nearer same-named hamlet): that gives an
approximate distance (`precisao: 'localidade'`), enough to charge the band and to
refuse addresses beyond the last band; the order's `entrega.aprox` is set and Vendas
flags it. **If nothing is found, delivery is refused** (client and both SQL order
functions), with a WhatsApp way out. It used to be accepted as "taxa a confirmar",
which let a 38 km order through with no fee (Nov 2026); old orders with
`taxaAConfirmar` still get a "Taxa a confirmar" chip in Vendas.

`src/loja/api.js` calls PostgREST with plain `fetch` rather than `supabase-js`, to
keep the customer-facing bundle small. Don't import `supabase-js` into `src/loja/`.

### Hours per weekday

`configuracao.loja_horarios.semana` holds each weekday's `{ abre, fecha }` (keys
`"0"` = Sunday … `"6"` = Saturday, like `extract(dow)` and `getDay()`); `null` means
closed. `loja_horario_dia()` (SQL) and `horarioDoDia()` (`src/loja/horarios.js`) apply
the same rule; without `semana` the single `abre`/`fecha` still applies. The CRM card
is `src/components/Horarios.jsx`, which also saves `abre`/`fecha` as the window common
to every open day, for clients still running an old bundle.

### Campaigns: Black Crumb (Black Friday, Nov 2026)

A campaign gets its own tab in the store (`src/loja/Black.jsx`, rules in
`src/loja/blackCrumb.js`) and its own order function, `loja_criar_pedido_black(jsonb)`.
Its config is `configuracao.loja_black` (dates, combos, prices, gift, delivery rules);
`loja_black_estado()` turns it into what the store sees in `loja_cardapio().black`.

The campaign runs in phases (`fase`), all in Lisbon time:
1. `antecipado` — until `antecipadoAte` (Fri 21h; extended from 19h on 27/11 with a direct update of `loja_black`): pre-orders with perks, any day of
   `diasAntecipado` (28/11–6/12).
2. `pausa` — until `reabre` (Sat 0h): nobody can order (`aberta: false`).
3. `noDia` — until `fim` (Mon 0h): orders only for `diasNoDia` (Sat/Sun), normal fee.

With `fechaLojaNormal`, the normal store is closed for the whole campaign: the menu tab
is hidden and `loja_criar_pedido` refuses with `fim: true`. After `fim` everything is
back to normal and the Black tab is gone.

- Combos are N cookies at a fixed price; every combo carries `brindePorCombo` free
  50 g mini cookies of **surprise flavour** (Dhara's call, 24/11: the customer does
  not choose). The store sends no `minis`, so the server adds one 0 € "sabor surpresa"
  line and touches no 50 g stock. The server still accepts `minis` (chosen flavours →
  0 € lines with `stock50`, out of `cookie50`, returned by Vendas on cancel) in case a
  future campaign lets people pick. Payment is MB WAY only, paid right away.
- Flavours are always available: the order deducts stock even below zero (negative =
  still to bake). For that reason `estoque_ajustar` and `aplicarDeltas` no longer
  clamp at 0; only setting an absolute value does.
- Each combo is stored as a `linhas` entry with `customLabel` **and** `stock`
  (`{ cookieId: qty per unit }`). `Vendas.jsx` (`stockDoPedido`), the Home agenda and
  `salesAnalytics` read `stock`, so cancelling or deleting returns the right flavours.
  Keep `stock` when rebuilding lines.
- Orders have `campanha = 'black'`; `entrega.antecipado = true` means pre-order
  (double loyalty stamps). Vendas shows a "Black" chip (cookie icon) with "selos ×2".
- `Checkout.jsx` takes a `campanha` prop (fixed days, fixed payment, own delivery-fee
  rule, no coupon), so the next campaign (Christmas) can reuse it.
- `loja_entrega_validar()` is the shared pickup/delivery validation for campaign
  order functions; the original `loja_criar_pedido` keeps its own copy.
