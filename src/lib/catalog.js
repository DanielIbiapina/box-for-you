/** Sabores históricos — mantidos para estatísticas, podem ficar fora do cardápio ativo */
export const LEGACY_COOKIES = [
  { id: 'legacy-mm', nome: 'M&M', short: 'M&M', emoji: '🍬', price: 3, image: '', ativoNoCardapio: false },
  { id: 'legacy-bow', nome: 'Especial Brasil (BOW)', short: 'BOW', emoji: '🇧🇷', price: 3.5, image: '', ativoNoCardapio: false },
  { id: 'legacy-brigadeiros', nome: '4 Brigadeiros', short: 'Brigadeiros', emoji: '🍫', price: 5, image: '', ativoNoCardapio: false },
]

export const MINI_BOX_ID = 'mini-box'

export function readCookieCatalog() {
  let cookies = []
  try {
    cookies = JSON.parse(localStorage.getItem('bfy:feiras-cookies') || '[]')
  } catch {
    cookies = []
  }
  const byId = new Map(cookies.map((c) => [c.id, c]))
  for (const leg of LEGACY_COOKIES) {
    if (!byId.has(leg.id)) byId.set(leg.id, { ...leg })
  }
  return [...byId.values()]
}

/** Cookies visíveis no POS (Gerir Cardápio pode desativar sem apagar) */
export function menuCookies(cookies) {
  return cookies.filter((c) => c.ativoNoCardapio !== false)
}

export function resolveProductMeta(productId, catalog, line = null) {
  if (line?.customLabel) {
    return {
      nome: line.customLabel,
      short: line.customLabel,
      emoji: line.customEmoji ?? '✨',
      image: '',
    }
  }
  const c = catalog.find((x) => x.id === productId)
  if (c) return { nome: c.nome, short: c.short, emoji: c.emoji, image: c.image ?? '' }
  if (productId === MINI_BOX_ID) {
    return { nome: 'Box Mini Cookies', short: 'Box Mini', emoji: '🍪', image: '' }
  }
  return { nome: String(productId), short: String(productId), emoji: '❓', image: '' }
}

export function lineUnitPrice(line, catalog, miniBoxPrice) {
  if (line.unitPrice != null) return line.unitPrice
  if (line.customLabel && line.unitPrice == null && line.customPrice != null) return line.customPrice
  const c = catalog.find((x) => x.id === line.productId)
  if (c) return c.price
  if (line.productId === MINI_BOX_ID) return miniBoxPrice
  return 0
}
