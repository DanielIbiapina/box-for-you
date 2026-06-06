# Box for You — Bake Your Dreams

App offline-first para gestão de uma marca de cookies: receitas, estoque, produção, preços, relatórios, vendas em feiras e configurações.

## Stack

- React 19
- Vite 8
- Tailwind CSS 4

## Comandos

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/
npm run preview   # serve o build localmente
npm run lint      # ESLint
```

Não há suite de testes. Valide mudanças de UI com `npm run dev` no navegador.

## Módulos

| Tela | Arquivo | Função |
|------|---------|--------|
| Início | `src/modules/Home.jsx` | Dashboard |
| Receitas | `src/modules/Receitas.jsx` | Cadastro de receitas |
| Estoque | `src/modules/Estoque.jsx` | Ingredientes e movimentações |
| Produção | `src/modules/Producao.jsx` | Lotes de produção |
| Preços | `src/modules/Precificacao.jsx` | Precificação |
| Relatórios | `src/modules/Relatorios.jsx` | Relatórios e exportação |
| Feiras | `src/modules/Feiras.jsx` | POS para vendas em feiras |
| Config | `src/modules/Configuracoes.jsx` | Negócio, eventos, reset |

A navegação fica em `src/App.jsx`. Dados persistem em `localStorage` (sem backend).

## Ícones do menu

Os ícones da navegação ficam em **`public/icons/`** e são referenciados como `/icons/...` no código.

| Arquivo esperado | Tela |
|------------------|------|
| `nav-inicio.png` | Início |
| `nav-receitas.png` | Receitas |
| `nav-estoque.png` | Estoque |
| `nav-producao.png` | Produção |
| `nav-precos.png` | Preços |
| `nav-relatorios.png` | Relatórios |
| `nav-feiras.png` | Feiras |
| `nav-config.png` | Config |
| `logo.png` | Logo na sidebar tablet |

**Já incluídos:** `nav-receitas.png`, `nav-estoque.png`, `nav-producao.png`.

**Pendentes:** os demais arquivos da tabela acima.

## Estrutura

```
src/
├── App.jsx              # Shell + navegação
├── index.css            # Tema e utilitários Tailwind
├── components/          # Modal, BarChart
├── modules/             # Telas do app
└── stores/              # Hooks de localStorage
public/
├── favicon.svg
└── icons/               # Ícones PNG do menu
```

## Persistência (`localStorage`)

| Chave | Conteúdo |
|-------|----------|
| `bfy:receitas` | Receitas |
| `bfy:ingredientes` | Ingredientes |
| `bfy:movimentacoes` | Movimentações de estoque |
| `bfy:eventos` | Feiras / eventos |
| `bfy:configuracoes` | Configurações do negócio |
| `cookies-sales:v1` | Vendas do POS (Feiras) |
