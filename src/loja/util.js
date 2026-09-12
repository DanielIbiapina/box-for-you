export const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

export const MINI_BOX_ID = 'mini-box'
export const TASTING_BOX_ID = 'tasting-box'

export function findCookie(cardapio, id) {
  return cardapio?.cookies?.find((c) => c.id === id) ?? null
}

/** Quantas unidades de um sabor já estão comprometidas (carrinho + caixas + rascunho). */
export function usadoDoSabor(id, cart, caixas, boxDraft) {
  let n = cart[id] ?? 0
  for (const caixa of caixas) n += caixa[id] ?? 0
  if (boxDraft) n += boxDraft[id] ?? 0
  return n
}

/** Stock ainda escolhível de um sabor. */
export function disponivel(cookie, cart, caixas, boxDraft) {
  return Math.max(0, (cookie.stock ?? 0) - usadoDoSabor(cookie.id, cart, caixas, boxDraft))
}

/** Tasting Box: cada uma consome 1 cookie de 50g de cada sabor — stock é o mínimo. */
export function disponivelTasting(cardapio, cart) {
  return Math.max(0, (cardapio?.tastingBox?.stock ?? 0) - (cart[TASTING_BOX_ID] ?? 0))
}

export function disponivelMini(cardapio, cart) {
  return Math.max(0, (cardapio?.miniBox?.stock ?? 0) - (cart[MINI_BOX_ID] ?? 0))
}

export function resumoCaixa(counts, cardapio) {
  return Object.entries(counts)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${q}× ${findCookie(cardapio, id)?.short ?? id}`)
    .join(', ')
}

export function contarCaixa(counts) {
  return Object.values(counts).reduce((s, q) => s + (q ?? 0), 0)
}

/** Linhas do carrinho prontas para mostrar, já com subtotal. */
export function linhasCarrinho(cardapio, cart, caixas) {
  if (!cardapio) return []
  const linhas = []

  for (const [id, qty] of Object.entries(cart)) {
    if (!qty) continue
    if (id === MINI_BOX_ID) {
      linhas.push({
        key: id, image: '', nome: 'Mini Box', detalhe: 'cookies mini sortidos',
        qty, unit: cardapio.miniBox.price, subtotal: qty * cardapio.miniBox.price, tipo: 'item',
      })
    } else if (id === TASTING_BOX_ID) {
      linhas.push({
        key: id, image: '', nome: 'Tasting Box',
        detalhe: `1 mini de cada um dos ${cardapio.tastingBox.sabores} sabores`,
        qty, unit: cardapio.tastingBox.price, subtotal: qty * cardapio.tastingBox.price, tipo: 'item',
      })
    } else {
      const c = findCookie(cardapio, id)
      if (!c) continue
      linhas.push({
        key: id, image: c.image, nome: c.nome, detalhe: 'cookie individual',
        qty, unit: c.price, subtotal: qty * c.price, tipo: 'item',
      })
    }
  }

  caixas.forEach((counts, i) => {
    const primeira = Object.entries(counts).find(([, q]) => q > 0)?.[0]
    linhas.push({
      key: `caixa-${i}`, indice: i,
      image: findCookie(cardapio, primeira)?.image ?? '',
      nome: `Box de ${cardapio.box.size}`, detalhe: resumoCaixa(counts, cardapio),
      qty: 1, unit: cardapio.box.price, subtotal: cardapio.box.price, tipo: 'caixa',
    })
  })

  return linhas
}

export const totalCarrinho = (linhas) => linhas.reduce((s, l) => s + l.subtotal, 0)

export const totalItens = (cart, caixas) =>
  Object.values(cart).reduce((s, q) => s + q, 0) + caixas.length

export function fmtData(iso) {
  if (!iso) return ''
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })
}

/**
 * Corta o saco ao stock actual: caixas incompletas caem, avulsos e rascunho
 * descem até ao que ainda há. Mini/Tasting têm o próprio balde.
 */
export function clampCarrinho(cardapio, cart, caixas, draft) {
  if (!cardapio) return { cart: {}, caixas: [], draft: null }
  const stock = Object.fromEntries((cardapio.cookies ?? []).map((c) => [c.id, Math.max(0, c.stock ?? 0)]))

  const nextCaixas = []
  for (const caixa of caixas ?? []) {
    const ok = Object.entries(caixa).every(([id, q]) => q <= 0 || (stock[id] ?? 0) >= q)
    if (!ok) continue
    for (const [id, q] of Object.entries(caixa)) {
      if (q > 0) stock[id] = (stock[id] ?? 0) - q
    }
    nextCaixas.push(caixa)
  }

  let nextDraft = null
  if (draft && typeof draft === 'object') {
    const clamped = {}
    let any = false
    for (const [id, q] of Object.entries(draft)) {
      const n = Math.min(Math.max(0, q ?? 0), Math.max(0, stock[id] ?? 0))
      if (n > 0) {
        clamped[id] = n
        stock[id] = (stock[id] ?? 0) - n
        any = true
      } else {
        clamped[id] = 0
      }
    }
    nextDraft = any ? clamped : null
  }

  const nextCart = {}
  for (const [id, q] of Object.entries(cart ?? {})) {
    if (!q) continue
    if (id === MINI_BOX_ID) {
      const n = Math.min(q, Math.max(0, cardapio.miniBox?.stock ?? 0))
      if (n > 0) nextCart[id] = n
    } else if (id === TASTING_BOX_ID) {
      const n = Math.min(q, Math.max(0, cardapio.tastingBox?.stock ?? 0))
      if (n > 0) nextCart[id] = n
    } else {
      const n = Math.min(q, Math.max(0, stock[id] ?? 0))
      if (n > 0) {
        nextCart[id] = n
        stock[id] = (stock[id] ?? 0) - n
      }
    }
  }

  return { cart: nextCart, caixas: nextCaixas, draft: nextDraft }
}

export function podeDuplicarCaixa(counts, cardapio, cart, caixas, draft) {
  return Object.entries(counts ?? {}).every(([id, q]) => {
    if (!q) return true
    const c = findCookie(cardapio, id)
    return c ? disponivel(c, cart, caixas, draft) >= q : false
  })
}
