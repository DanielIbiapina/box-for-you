export const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export const MINI_BOX_ID = 'mini-box'
export const TASTING_BOX_ID = 'tasting-box'
export const EXTRAS = [TASTING_BOX_ID, MINI_BOX_ID]

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
  const stock = id === MINI_BOX_ID ? cardapio?.miniBox?.stock : cardapio?.tastingBox?.stock
  return Math.max(0, (stock ?? 0) - (extras[id] ?? 0))
}

export function precoExtra(cardapio, id) {
  return (id === MINI_BOX_ID ? cardapio?.miniBox?.price : cardapio?.tastingBox?.price) ?? 0
}

export function nomeExtra(id) {
  return id === MINI_BOX_ID ? 'Mini Box' : 'Tasting Box'
}

export function resumoCaixa(counts, cardapio) {
  return Object.entries(counts)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${q}× ${findCookie(cardapio, id)?.short ?? id}`)
    .join(', ')
}

/**
 * A escolha é uma lista de sabores pela ordem em que foram tocados.
 * A cada `size`, fecha-se uma Box: é assim que vai embalada e sai mais em
 * conta. Só vira Box se for mesmo mais barato; o que sobra vai avulso.
 */
export function agrupar(picks, cardapio) {
  const size = cardapio?.box?.size ?? 4
  const precoBox = cardapio?.box?.price ?? 0
  const preco = (id) => findCookie(cardapio, id)?.price ?? 0
  const caixas = []
  const soltos = []
  const nCheias = Math.floor(picks.length / size)
  for (let i = 0; i < nCheias; i++) {
    const ids = picks.slice(i * size, (i + 1) * size)
    const soma = ids.reduce((s, id) => s + preco(id), 0)
    if (precoBox > 0 && precoBox < soma) {
      caixas.push({ inicio: i * size, ids, counts: contar(ids), poupa: soma - precoBox })
    } else {
      soltos.push(...ids)
    }
  }
  const resto = picks.slice(nCheias * size)
  return {
    size,
    caixas,
    resto,
    avulsos: contar([...soltos, ...resto]),
    poupanca: caixas.reduce((s, c) => s + c.poupa, 0),
  }
}

/** Quanto se poupa, em média, por Box — para a promessa "a cada 4, poupas X". */
export function poupancaPorBox(cardapio) {
  const cs = (cardapio?.cookies ?? []).filter((c) => (c.stock ?? 0) > 0)
  if (!cs.length || !cardapio?.box) return 0
  const medio = cs.reduce((s, c) => s + (c.price ?? 0), 0) / cs.length
  return Math.max(0, Math.round((medio * cardapio.box.size - cardapio.box.price) * 100) / 100)
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

  for (const id of EXTRAS) {
    const qty = extras[id] ?? 0
    if (!qty) continue
    linhas.push({
      key: id, tipo: 'extra', id, nome: nomeExtra(id),
      detalhe: id === TASTING_BOX_ID
        ? `1 mini de cada um dos ${cardapio.tastingBox.sabores} sabores`
        : 'cookies mini sortidos',
      qty, subtotal: qty * precoExtra(cardapio, id),
    })
  }

  const nExtras = EXTRAS.reduce((s, id) => s + (extras[id] ?? 0), 0)
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
  for (const id of EXTRAS) {
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
  for (const id of EXTRAS) {
    const n = Math.min(extras?.[id] ?? 0, livreExtra(cardapio, {}, id))
    if (n > 0) nextExtras[id] = n
  }
  return { picks: nextPicks, extras: nextExtras }
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
