/**
 * Persistência no browser (localStorage). A verdade do pedido vive no Supabase;
 * isto só evita perder o saco ao refresh e permite reabrir o último pedido.
 */

const CART_KEY = 'bfy:loja-cart-v2'
const CART_KEY_V1 = 'bfy:loja-cart-v1'
const CONTACTO_KEY = 'bfy:loja-contacto-v1'
const EXTRA_IDS = ['mini-box', 'tasting-box']
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

const valido = (data) => data?.savedAt && Date.now() - data.savedAt <= TTL_MS

const expandir = (counts) => Object.entries(counts ?? {})
  .flatMap(([id, q]) => Array.from({ length: Math.max(0, Number(q) || 0) }, () => id))

/**
 * O saco é a lista de sabores pela ordem em que foram tocados (`picks`) e as
 * caixas prontas (`extras`). Um saco do formato antigo (Box montada à mão +
 * avulsos) é convertido uma vez, para ninguém perder o que já tinha escolhido.
 */
export function lerCarrinho() {
  const v2 = ler(CART_KEY)
  if (valido(v2)) {
    return {
      picks: Array.isArray(v2.picks) ? v2.picks.filter((x) => typeof x === 'string') : [],
      extras: v2.extras && typeof v2.extras === 'object' ? v2.extras : {},
    }
  }

  const v1 = ler(CART_KEY_V1)
  try { localStorage.removeItem(CART_KEY_V1) } catch { /* */ }
  if (!valido(v1)) return { picks: [], extras: {} }

  const cart = v1.cart && typeof v1.cart === 'object' ? v1.cart : {}
  const soltos = Object.fromEntries(Object.entries(cart).filter(([id]) => !EXTRA_IDS.includes(id)))
  const extras = Object.fromEntries(Object.entries(cart).filter(([id, q]) => EXTRA_IDS.includes(id) && q > 0))
  const picks = [
    ...(Array.isArray(v1.caixas) ? v1.caixas.flatMap(expandir) : []),
    ...expandir(v1.draft),
    ...expandir(soltos),
  ]
  return { picks, extras }
}

export function gravarCarrinho({ picks, extras }) {
  gravar(CART_KEY, { savedAt: Date.now(), picks, extras })
}

export function limparCarrinho() {
  try { localStorage.removeItem(CART_KEY) } catch { /* */ }
}

/** Contacto e morada ficam neste telemóvel, para o próximo pedido ser 3 toques. */
export function lerContacto() {
  const data = ler(CONTACTO_KEY) ?? {}
  return {
    nome: String(data.nome ?? ''),
    telefone: String(data.telefone ?? ''),
    tipo: data.tipo === 'levantar' || data.tipo === 'entrega' ? data.tipo : '',
    morada: String(data.morada ?? ''),
    localidade: String(data.localidade ?? ''),
    cp: String(data.cp ?? ''),
  }
}

export function gravarContacto({ nome, telefone, tipo, morada, localidade, cp }) {
  gravar(CONTACTO_KEY, {
    nome: nome ?? '',
    telefone: telefone ?? '',
    tipo: tipo === 'levantar' || tipo === 'entrega' ? tipo : '',
    morada: morada ?? '',
    localidade: localidade ?? '',
    cp: cp ?? '',
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
