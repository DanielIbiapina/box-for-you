/**
 * Distância da morada do cliente até à nossa morada de partida, para a taxa
 * de entrega (em linha reta). O servidor volta a calcular a taxa ao criar o
 * pedido — isto é para o cliente a ver antes.
 *
 * Só se aceita uma posição quando o mapa (OpenStreetMap) encontra a rua, a
 * localidade E o código postal juntos. Sem essa certeza a taxa fica "a
 * confirmar" e a dona combina com o cliente.
 *
 * Porquê: o OpenStreetMap quase não conhece os códigos postais da zona do
 * Porto e a pesquisa só por rua apanhava ruas homónimas noutro sítio (uma
 * morada a 11 km deu 3,9 km). Provisório: a seguir vem uma tabela de códigos
 * postais dentro do próprio site.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'
const CP7 = /^(\d{4})\s*-?\s*(\d{3})$/

/** O código postal está completo (4 + 3 dígitos)? */
export const cpCompleto = (cp) => CP7.test(String(cp ?? '').trim())

async function procurar(params) {
  const url = `${NOMINATIM}?${new URLSearchParams({
    format: 'jsonv2', limit: '1', countrycodes: 'pt', 'accept-language': 'pt', ...params,
  })}`
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!r.ok) return null
  const [primeiro] = await r.json()
  if (!primeiro) return null
  const lat = Number(primeiro.lat)
  const lng = Number(primeiro.lon)
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
}

const tentar = async (fn) => {
  try { return await fn() } catch { return null }
}

/** Coordenadas de uma morada portuguesa (rua + localidade + CP juntos). null = não deu. */
export async function localizar({ morada, localidade, cp }) {
  const cpLimpo = String(cp ?? '').trim()
  if (!cpCompleto(cpLimpo)) return null
  return tentar(() => procurar({
    street: String(morada ?? '').trim(),
    city: String(localidade ?? '').trim(),
    postalcode: cpLimpo,
  }))
}

/** Coordenadas de uma morada escrita de uma vez (a morada de partida, no CRM). */
export async function localizarTexto(texto) {
  return tentar(() => procurar({ q: String(texto ?? '').trim() }))
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
