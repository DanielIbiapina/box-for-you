/**
 * Persistência no browser (localStorage). A verdade do pedido vive no Supabase;
 * isto só evita perder o saco ao refresh e permite reabrir o último pedido.
 */

const CART_KEY = 'bfy:loja-cart-v1'
const CONTACTO_KEY = 'bfy:loja-contacto-v1'
const ULTIMO_KEY = 'bfy:loja-ultimo-pedido'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

function ler(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function gravar(key, valor) {
  try {
    localStorage.setItem(key, JSON.stringify(valor))
  } catch { /* quota / modo privado */ }
}

export function lerCarrinho() {
  const data = ler(CART_KEY)
  if (!data?.savedAt || Date.now() - data.savedAt > TTL_MS) {
    try { localStorage.removeItem(CART_KEY) } catch { /* */ }
    return { cart: {}, caixas: [], draft: null }
  }
  return {
    cart: data.cart && typeof data.cart === 'object' ? data.cart : {},
    caixas: Array.isArray(data.caixas) ? data.caixas : [],
    draft: data.draft && typeof data.draft === 'object' ? data.draft : null,
  }
}

export function gravarCarrinho({ cart, caixas, draft }) {
  gravar(CART_KEY, { savedAt: Date.now(), cart, caixas, draft })
}

export function limparCarrinho() {
  try { localStorage.removeItem(CART_KEY) } catch { /* */ }
}

export function lerContacto() {
  const data = ler(CONTACTO_KEY)
  if (!data) return { nome: '', telefone: '', tipo: '' }
  return {
    nome: String(data.nome ?? ''),
    telefone: String(data.telefone ?? ''),
    tipo: data.tipo === 'levantar' || data.tipo === 'entrega' ? data.tipo : '',
  }
}

export function gravarContacto({ nome, telefone, tipo }) {
  gravar(CONTACTO_KEY, {
    nome: nome ?? '',
    telefone: telefone ?? '',
    tipo: tipo === 'levantar' || tipo === 'entrega' ? tipo : '',
  })
}

export function lerUltimoPedido() {
  const data = ler(ULTIMO_KEY)
  if (!data?.referencia) return null
  return {
    referencia: String(data.referencia).toUpperCase(),
    telefone: String(data.telefone ?? ''),
    total: Number(data.total) || 0,
    pagamento: String(data.pagamento ?? ''),
  }
}

export function gravarUltimoPedido(pedido) {
  gravar(ULTIMO_KEY, {
    referencia: pedido.referencia,
    telefone: pedido.telefone ?? '',
    total: pedido.total ?? 0,
    pagamento: pedido.pagamento ?? '',
  })
}

export function refDaUrl() {
  try {
    const p = new URLSearchParams(window.location.search).get('p')
    return p ? p.trim().toUpperCase() : ''
  } catch {
    return ''
  }
}

export function irParaPedido(referencia) {
  const url = new URL(window.location.href)
  url.searchParams.set('p', referencia)
  window.history.pushState(null, '', `${url.pathname}?p=${encodeURIComponent(referencia)}`)
}

export function sairDoPedido() {
  const url = new URL(window.location.href)
  url.searchParams.delete('p')
  const qs = url.searchParams.toString()
  window.history.pushState(null, '', qs ? `${url.pathname}?${qs}` : url.pathname)
}
