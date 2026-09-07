# Box for You — Bake Your Dreams

Duas páginas no mesmo projeto:

| URL | O que é | Quem entra |
|-----|---------|-----------|
| `/` | **Loja** — o cliente escolhe cookies e faz o pedido | qualquer pessoa |
| `/crm/` | **Gestão** — receitas, estoque, produção, preços, relatórios, vendas | só a dona (login Supabase) |

A gestão fica fora da raiz de propósito: quem abre o site não descobre que existe.
Isso é só discrição — quem protege a app a sério é o login do Supabase e o RLS.

## Stack

- React 19
- Vite 8
- Tailwind CSS 4

## Comandos

```bash
npm install
npm run dev       # loja: http://localhost:5173 · gestão: http://localhost:5173/crm/
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

## Persistência

Os dados vivem no **Supabase** (Postgres + realtime), através de
`src/stores/DataProvider.jsx`. As colunas são snake_case na base e camelCase na
app — `src/stores/mappers.js` faz a tradução nos dois sentidos. O esquema está
em `supabase/schema.sql` e a parte da loja em `supabase/loja.sql`.

<details>
<summary>Chaves antigas de <code>localStorage</code> (histórico, já migradas)</summary>

| Chave | Conteúdo |
|-------|----------|
| `bfy:receitas` | Receitas |
| `bfy:ingredientes` | Ingredientes |
| `bfy:movimentacoes` | Movimentações de estoque |
| `bfy:eventos` | Feiras / eventos |
| `bfy:configuracoes` | Configurações do negócio |
| `cookies-sales:v1` | Vendas do POS (Feiras) |

</details>


## Loja pública (`/`)

O cliente abre o link, escolhe sabores, monta uma Box, deixa o contacto e o
pedido cai no módulo **Vendas** como `pendente`, marcado com o chip 🛒 Loja.
Não há pagamento online: ele escolhe entre MB WAY, Multibanco ou Dinheiro e a
dona confirma pelo telemóvel.

### Como está ligada aos dados

A loja **não fala com as tabelas**. O RLS continua a só deixar entrar quem
está autenticado. O visitante anónimo só pode chamar duas funções
(`supabase/loja.sql`, correr no SQL Editor):

| Função | O que faz |
|--------|-----------|
| `loja_cardapio()` | devolve sabores ativos, preços das caixas e stock |
| `loja_criar_pedido(jsonb)` | valida, **recalcula o total no servidor**, cria cliente + pedido e dá baixa no stock |

Recalcular no servidor é o ponto central: o preço que o browser envia é
ignorado, portanto ninguém compra uma caixa por €0,01 mexendo no devtools.

### O que o cliente vê

Sabores ativos no cardápio (os mesmos que a dona gere em **Cardápio do caixa**),
com badge de **Esgotado** quando o stock chega a zero. A Box de 4, a Mini Box e
a Tasting Box usam os preços da `configuracao` — mudar o preço na app muda a
loja na hora.

### Ficheiros

```
index.html          → src/loja/main.jsx     (loja)
crm/index.html      → src/main.jsx          (gestão)
src/loja/
├── Loja.jsx        # estado do carrinho + secções da página
├── Cardapio.jsx    # grelha de sabores
├── Caixas.jsx      # construtor da Box + caixas prontas
├── Checkout.jsx    # resumo → contacto → envio
├── Sucesso.jsx     # confirmação
├── api.js          # os dois RPC, por fetch (sem supabase-js)
└── util.js         # preços, stock disponível, linhas do carrinho
```

A loja não importa o `supabase-js` de propósito: são dois POST, e assim a
página que o cliente abre no telemóvel fica ~110 kB gzip mais leve.
