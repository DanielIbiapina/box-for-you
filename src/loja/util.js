export const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export const MINI_BOX_ID = 'mini-box'
export const TASTING_BOX_ID = 'tasting-box'
// A Tasting Box foi extinta (out/2026): a loja só vende a Mini Box como caixa especial.
export const EXTRAS = [MINI_BOX_ID]

/**
 * Mini cookies de 50 g: cada sabor tem a sua versão pequena, com stock próprio
 * (Estoque › Cookies 50g) e um preço único. No saco vivem junto das caixas
 * especiais (`extras`), com a chave "mini50:<sabor>".
 */
export const MINI50 = 'mini50:'
export const ehMini50 = (id) => String(id).startsWith(MINI50)
export const chaveMini50 = (cookieId) => `${MINI50}${cookieId}`
const saborMini50 = (id) => String(id).slice(MINI50.length)
/** As chaves do saco que a loja ainda vende (Mini Box e mini cookies de 50 g). */
export const chavesExtras = (extras) => Object.keys(extras ?? {}).filter((id) => EXTRAS.includes(id) || ehMini50(id))

export function findCookie(cardapio, id) {
  return cardapio?.cookies?.find((c) => c.id === id) ?? null
}

export function contar(ids) {
  const m = {}
  for (const id of ids) m[id] = (m[id] ?? 0) + 1
  return m
}

/** Quantas vezes um sabor já está na escolha. */
export function vezes(picks, id) {
  let n = 0
  for (const p of picks) if (p === id) n++
  return n
}

/** Stock ainda escolhível de um sabor. */
export function livreSabor(cookie, picks) {
  if (!cookie) return 0
  return Math.max(0, (cookie.stock ?? 0) - vezes(picks, cookie.id))
}

export function livreExtra(cardapio, extras, id) {
  // sem preço (0 €) não está à venda — nunca sair de graça por engano
  if (!(precoExtra(cardapio, id) > 0)) return 0
  let stock
  if (ehMini50(id)) stock = findCookie(cardapio, saborMini50(id))?.stock50
  else stock = id === MINI_BOX_ID ? cardapio?.miniBox?.stock : cardapio?.tastingBox?.stock
  return Math.max(0, (stock ?? 0) - (extras[id] ?? 0))
}

export function precoExtra(cardapio, id) {
  if (ehMini50(id)) return Number(cardapio?.mini50?.price) || 0
  return (id === MINI_BOX_ID ? cardapio?.miniBox?.price : cardapio?.tastingBox?.price) ?? 0
}

export function nomeExtra(id, cardapio) {
  if (ehMini50(id)) return `${findCookie(cardapio, saborMini50(id))?.nome ?? 'Mini cookie'} · 50 g`
  return id === MINI_BOX_ID ? 'Mini Box' : 'Tasting Box'
}

export function resumoCaixa(counts, cardapio) {
  return Object.entries(counts)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${q}× ${findCookie(cardapio, id)?.short ?? id}`)
    .join(', ')
}

/**
 * O preço "normal" de um cookie: o mais comum no cardápio (em empate, o mais
 * baixo). O servidor usa a mesma regra (supabase/loja.sql).
 */
export function precoNormal(cardapio) {
  const conta = new Map()
  for (const c of cardapio?.cookies ?? []) {
    const p = Number(c.price) || 0
    conta.set(p, (conta.get(p) ?? 0) + 1)
  }
  let melhor = null
  for (const [p, n] of conta) {
    if (!melhor || n > melhor.n || (n === melhor.n && p < melhor.p)) melhor = { p, n }
  }
  return melhor?.p ?? 0
}

/**
 * Na Box só entram os cookies normais (100 g, ao preço normal). Os que custam
 * outra coisa — mais caros (ex.: "Mini Cookies" a 5 €) ou mais baratos (ex.:
 * um cookie de 50 g) — vão sempre à parte, pelo seu preço.
 */
export function entraNaBox(cardapio, id, normal = precoNormal(cardapio)) {
  const c = findCookie(cardapio, id)
  return Boolean(c) && Math.abs((Number(c.price) || 0) - normal) < 0.005
}

/** Arruma a escolha: primeiro os que podem ir na Box (por ordem de toque), depois os que vão à parte. */
export function arrumarEscolha(picks, cardapio) {
  const normal = precoNormal(cardapio)
  const naBox = []
  const fora = []
  for (const id of picks ?? []) (entraNaBox(cardapio, id, normal) ? naBox : fora).push(id)
  return [...naBox, ...fora]
}

/**
 * A escolha é uma lista de sabores pela ordem em que foram tocados (arrumada
 * por arrumarEscolha: os que vão à parte ficam no fim). A cada `size` cookies
 * de preço normal fecha-se uma Box: é assim que vai embalada e sai mais em
 * conta. Só vira Box se for mesmo mais barato; o que sobra vai avulso.
 */
export function agrupar(picks, cardapio) {
  const size = cardapio?.box?.size ?? 4
  const precoBox = cardapio?.box?.price ?? 0
  const preco = (id) => findCookie(cardapio, id)?.price ?? 0
  const normal = precoNormal(cardapio)
  const naBox = picks.filter((id) => entraNaBox(cardapio, id, normal))
  const fora = picks.filter((id) => !entraNaBox(cardapio, id, normal))
  const caixas = []
  const soltos = []
  const nCheias = Math.floor(naBox.length / size)
  for (let i = 0; i < nCheias; i++) {
    const ids = naBox.slice(i * size, (i + 1) * size)
    const soma = ids.reduce((s, id) => s + preco(id), 0)
    if (precoBox > 0 && precoBox < soma) {
      caixas.push({ inicio: i * size, ids, counts: contar(ids), poupa: soma - precoBox })
    } else {
      soltos.push(...ids)
    }
  }
  const resto = naBox.slice(nCheias * size)
  return {
    size,
    caixas,
    resto,
    fora,
    avulsos: contar([...soltos, ...resto, ...fora]),
    poupanca: caixas.reduce((s, c) => s + c.poupa, 0),
  }
}

/** Quanto se poupa por Box com cookies de preço normal — a promessa "a cada 4, poupas X". */
export function poupancaPorBox(cardapio) {
  if (!cardapio?.box || !(cardapio.cookies ?? []).length) return 0
  const normal = precoNormal(cardapio)
  return Math.max(0, Math.round((normal * cardapio.box.size - cardapio.box.price) * 100) / 100)
}

/** Tudo o que o saco precisa de mostrar: linhas, totais, poupança. */
export function resumoPedido(picks, extras, cardapio) {
  const g = agrupar(picks, cardapio)
  const linhas = []

  g.caixas.forEach((cx, i) => {
    linhas.push({
      key: `caixa-${cx.inicio}`, tipo: 'caixa', indice: i, inicio: cx.inicio, ids: cx.ids,
      nome: `Box de ${g.size}`, detalhe: resumoCaixa(cx.counts, cardapio),
      qty: 1, subtotal: cardapio.box.price,
    })
  })

  for (const [id, qty] of Object.entries(g.avulsos)) {
    const c = findCookie(cardapio, id)
    if (!c) continue
    linhas.push({
      key: id, tipo: 'avulso', id, image: c.image, nome: c.nome,
      detalhe: `${fmtEuro(c.price)} cada`, qty, subtotal: qty * c.price,
    })
  }

  // mini cookies de 50 g primeiro (são cookies), a Mini Box no fim
  const chaves = chavesExtras(extras).sort((a, b) => Number(ehMini50(b)) - Number(ehMini50(a)))
  for (const id of chaves) {
    const qty = extras[id] ?? 0
    if (!qty) continue
    const preco = precoExtra(cardapio, id)
    linhas.push({
      key: id, tipo: 'extra', id, nome: nomeExtra(id, cardapio),
      image: ehMini50(id) ? findCookie(cardapio, saborMini50(id))?.image : undefined,
      detalhe: ehMini50(id)
        ? `${fmtEuro(preco)} cada`
        : cardapio.miniBox?.descricao || '5 mini cookies de 25 g',
      qty, subtotal: qty * preco,
    })
  }

  const nExtras = chaves.reduce((s, id) => s + (extras[id] ?? 0), 0)
  return {
    ...g,
    linhas,
    total: linhas.reduce((s, l) => s + l.subtotal, 0),
    nCookies: picks.length,
    nItens: picks.length + nExtras,
  }
}

/** O que vai para o servidor. Ele revalida tudo e recalcula o total. */
export function payloadPedido(picks, extras, cardapio) {
  const g = agrupar(picks, cardapio)
  const itens = Object.entries(g.avulsos).map(([id, qty]) => ({ id, qty }))
  // "mini-box" e "mini50:<sabor>" — o servidor reconhece os dois
  for (const id of chavesExtras(extras)) {
    if ((extras[id] ?? 0) > 0) itens.push({ id, qty: extras[id] })
  }
  return { itens, caixas: g.caixas.map((c) => c.counts) }
}

/**
 * Corta a escolha ao stock actual. Guarda as escolhas mais antigas e tira
 * do fim o que já não há; sabores que saíram do cardápio caem.
 */
export function clampEscolha(cardapio, picks, extras) {
  const stock = Object.fromEntries(
    (cardapio?.cookies ?? []).map((c) => [c.id, Math.max(0, c.stock ?? 0)]),
  )
  const usados = {}
  const nextPicks = []
  for (const id of picks ?? []) {
    if (!(id in stock)) continue
    if ((usados[id] ?? 0) >= stock[id]) continue
    usados[id] = (usados[id] ?? 0) + 1
    nextPicks.push(id)
  }
  const nextExtras = {}
  for (const id of chavesExtras(extras)) {
    const n = Math.min(extras?.[id] ?? 0, livreExtra(cardapio, {}, id))
    if (n > 0) nextExtras[id] = n
  }
  // preços podem ter mudado desde que o carrinho foi guardado
  return { picks: arrumarEscolha(nextPicks, cardapio), extras: nextExtras }
}

function isoLocal(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export const hojeIso = () => isoLocal(new Date())

/** Os próximos dias, prontos para chips: Hoje, Amanhã, sáb, dom… */
export function proximosDias(n = 8) {
  const base = new Date()
  base.setHours(12, 0, 0, 0)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const semana = d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')
    return {
      iso: isoLocal(d),
      rotulo: i === 0 ? 'Hoje' : i === 1 ? 'Amanhã' : semana,
      dia: d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', ''),
    }
  })
}

export function fmtData(iso) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
}
