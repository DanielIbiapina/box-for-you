/**
 * Distância da morada do cliente até à nossa morada de partida, para a taxa
 * de entrega (em linha reta). O servidor volta a calcular a taxa ao criar o
 * pedido — isto é para o cliente a ver antes.
 *
 * Como se encontra a morada:
 *  1. Os 4 primeiros dígitos do código postal dão a zona (public/cp4.json,
 *     gerado do GeoNames por scripts/gerar-cp.mjs). É o centro do concelho ou
 *     do lugar — grosseiro de mais para a taxa, mas diz onde procurar.
 *  2. Procura-se a rua no mapa (OpenStreetMap) só dentro dessa zona.
 *  3. Só vale um resultado com o mesmo nome de rua E cujo código postal no
 *     mapa comece pelos mesmos 4 dígitos. Entre esses: o número de porta
 *     certo, senão o código postal completo certo, senão o meio da rua.
 * Sem essa certeza a taxa fica "a confirmar" e a dona combina com o cliente.
 *
 * Porquê: a pesquisa só por rua apanhava ruas homónimas noutro concelho
 * (uma morada a 11 km deu 3,9 km).
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const CP7 = /^(\d{4})\s*-?\s*(\d{3})$/
const DISPERSAO_MAX = 1.5 // km — troços mais afastados do que isto são ruas diferentes

/** O código postal está completo (4 + 3 dígitos)? */
export const cpCompleto = (cp) => CP7.test(String(cp ?? '').trim())

const tentar = async (fn) => {
  try { return await fn() } catch { return null }
}
const espera = (ms) => new Promise((r) => setTimeout(r, ms))

// ── zonas postais ──────────────────────────────────────────────────────────
let zonas = null
async function zonaDe(cp4) {
  zonas ??= fetch('/cp4.json')
    .then((r) => {
      if (!r.ok) throw new Error(`cp4.json ${r.status}`)
      return r.json()
    })
    .catch((e) => {
      zonas = null // volta a tentar da próxima vez
      throw e
    })
  const z = (await zonas)[cp4]
  return z ? { lat: z[0], lng: z[1], raioKm: z[2] } : null
}

// ── nomes de rua ───────────────────────────────────────────────────────────
const ABREVIATURAS = {
  r: 'rua', av: 'avenida', avda: 'avenida', tv: 'travessa', trav: 'travessa', pc: 'praca', pca: 'praca',
  pct: 'praceta', pcta: 'praceta', lg: 'largo', al: 'alameda', estr: 'estrada', calc: 'calcada', bc: 'beco', urb: 'urbanizacao',
}
const TIPOS = new Set([
  'rua', 'avenida', 'travessa', 'praca', 'praceta', 'largo', 'alameda', 'estrada', 'calcada', 'beco', 'viela',
  'caminho', 'rotunda', 'urbanizacao', 'bairro', 'quinta', 'cais', 'escadas', 'ladeira', 'via', 'vila',
])
const LIGACOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'd'])
// o que vem depois do nome da rua: número de porta, andar, lado
const RUIDO = new Set(['n', 'num', 'numero', 'esq', 'dto', 'dt', 'dta', 'frt', 'frente', 'tras', 'rc', 'cv', 'andar', 'apt', 'apartamento', 'lote', 'bloco', 'casa', 'hab'])
const NUMERO = /^\d+[a-z]?$/

const normal = (p) => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * "R. de Brito Capelo, 100, 2.º Esq" → { rua: 'Rua de Brito Capelo', porta: '100',
 * tipo: 'rua', nome: 'brito capelo' }. tipo/nome servem para comparar com o mapa.
 */
function partirMorada(texto) {
  const [primeira = '', ...resto] = String(texto ?? '').split(',')
  const palavras = (s) => s.replace(/[º°ª./]/g, ' ').split(/\s+/).map((p) => [p, normal(p)]).filter(([, n]) => n)
  const toks = palavras(primeira)
  const tirados = []
  // "Rua 19" fica com o 19: o nome nunca desce abaixo de duas palavras
  while (toks.length > 2 && (NUMERO.test(toks.at(-1)[1]) || RUIDO.has(toks.at(-1)[1]))) tirados.unshift(toks.pop())
  const porta = [...tirados, ...palavras(resto.join(' '))].find(([, n]) => NUMERO.test(n))?.[1] ?? ''

  const [cabeca, ...cauda] = toks
  const tipo = cabeca && TIPOS.has(ABREVIATURAS[cabeca[1]] ?? cabeca[1]) ? ABREVIATURAS[cabeca[1]] ?? cabeca[1] : ''
  const nome = (tipo ? cauda : toks).map(([, n]) => n).filter((n) => !LIGACOES.has(n)).join(' ')
  const rua = [tipo && ABREVIATURAS[cabeca[1]] ? tipo : cabeca?.[0], ...cauda.map(([p]) => p)].filter(Boolean).join(' ')
  return { rua, porta, tipo, nome }
}

/** O mesmo nome; o tipo (Rua/Travessa…) só conta se os dois o tiverem. */
const mesmaRua = (a, b) => !!a.nome && a.nome === b.nome && (!a.tipo || !b.tipo || a.tipo === b.tipo)

// ── mapa ───────────────────────────────────────────────────────────────────
async function procurar(params) {
  const url = `${NOMINATIM}?${new URLSearchParams({
    format: 'jsonv2', countrycodes: 'pt', 'accept-language': 'pt', addressdetails: '1', ...params,
  })}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) return []
  const lista = await r.json()
  return Array.isArray(lista) ? lista : []
}

const ponto = (x) => ({ lat: Number(x.lat), lng: Number(x.lon) })
const cpDoMapa = (x) => String(x.address?.postcode ?? '').replace(/\s/g, '')
const ruaDoMapa = (x) => x.address?.road ?? x.address?.pedestrian ?? x.address?.square ?? (x.category === 'highway' ? x.name : '')

/** Coordenadas de uma morada portuguesa (rua + código postal). null = não deu para ter a certeza. */
export async function localizar({ morada, localidade, cp }) {
  const m = String(cp ?? '').trim().match(CP7)
  if (!m) return null
  return tentar(async () => {
    const [, cp4, cp3] = m
    const zona = await zonaDe(cp4)
    const alvo = partirMorada(morada)
    if (!zona || !alvo.nome) return null

    const dLat = zona.raioKm / 111
    const dLng = zona.raioKm / (111 * Math.cos((zona.lat * Math.PI) / 180))
    const area = {
      viewbox: [zona.lng - dLng, zona.lat + dLat, zona.lng + dLng, zona.lat - dLat].map((n) => n.toFixed(4)).join(','),
      bounded: '1',
      limit: '40',
    }
    const certos = (lista) => lista.filter((x) => cpDoMapa(x).slice(0, 4) === cp4 && mesmaRua(alvo, partirMorada(ruaDoMapa(x))))

    // 1.º como foi escrita (com porta e localidade); 2.º só o nome da rua
    let bons = certos(await procurar({
      ...area, street: [alvo.porta, alvo.rua].filter(Boolean).join(' '), city: String(localidade ?? '').trim(),
    }))
    if (!bons.length) {
      await espera(1000) // regra do OpenStreetMap: no máximo 1 pedido por segundo
      bons = certos(await procurar({ ...area, street: alvo.rua }))
    }
    if (!bons.length) return null

    const porta = alvo.porta && bons.find((x) => normal(String(x.address?.house_number ?? '')) === alvo.porta)
    if (porta) return ponto(porta)
    const exato = bons.find((x) => cpDoMapa(x) === `${cp4}-${cp3}`)
    if (exato) return ponto(exato)
    // Vários troços da mesma rua: o meio, se forem mesmo a mesma rua
    const pts = bons.map(ponto)
    const meio = {
      lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
      lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length,
    }
    return pts.every((p) => distanciaKm(meio, p) <= DISPERSAO_MAX) ? meio : null
  })
}

/** Coordenadas de uma morada escrita de uma vez (a morada de partida, no CRM). */
export async function localizarTexto(texto) {
  return tentar(async () => {
    const [primeiro] = await procurar({ q: String(texto ?? '').trim(), limit: '1' })
    return primeiro ? ponto(primeiro) : null
  })
}

/** Distância em linha reta, em km (fórmula de haversine — a mesma do servidor). */
export function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** A taxa para esta distância, ou null se for mais longe do que entregamos. */
export function taxaPara(km, faixas) {
  const faixa = [...(faixas ?? [])].sort((x, y) => x.ateKm - y.ateKm).find((f) => km <= f.ateKm)
  return faixa ? Number(faixa.preco) || 0 : null
}
