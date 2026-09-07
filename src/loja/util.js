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
        key: id, emoji: '🎁', nome: 'Mini Box', detalhe: 'cookies mini sortidos',
        qty, unit: cardapio.miniBox.price, subtotal: qty * cardapio.miniBox.price, tipo: 'item',
      })
    } else if (id === TASTING_BOX_ID) {
      linhas.push({
        key: id, emoji: '🥄', nome: 'Tasting Box',
        detalhe: `1 mini de cada um dos ${cardapio.tastingBox.sabores} sabores`,
        qty, unit: cardapio.tastingBox.price, subtotal: qty * cardapio.tastingBox.price, tipo: 'item',
      })
    } else {
      const c = findCookie(cardapio, id)
      if (!c) continue
      linhas.push({
        key: id, emoji: c.emoji, nome: c.nome, detalhe: 'cookie individual',
        qty, unit: c.price, subtotal: qty * c.price, tipo: 'item',
      })
    }
  }

  caixas.forEach((counts, i) => {
    linhas.push({
      key: `caixa-${i}`, indice: i, emoji: '📦',
      nome: `Box de ${cardapio.box.size}`, detalhe: resumoCaixa(counts, cardapio),
      qty: 1, unit: cardapio.box.price, subtotal: cardapio.box.price, tipo: 'caixa',
    })
  })

  return linhas
}

export const totalCarrinho = (linhas) => linhas.reduce((s, l) => s + l.subtotal, 0)

export const totalItens = (cart, caixas) =>
  Object.values(cart).reduce((s, q) => s + q, 0) + caixas.length
