/**
 * Distância da morada do cliente até à nossa morada de partida, para a taxa
 * de entrega. A morada vira coordenadas pelo OpenStreetMap (Nominatim —
 * gratuito, sem chave); a distância é em linha reta. O servidor volta a
 * calcular a taxa ao criar o pedido — isto é só para o cliente a ver antes.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

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

/**
 * Coordenadas de uma morada portuguesa. Tenta a morada completa e, se o mapa
 * não a conhecer, só o código postal (que chega para a distância). null = não deu.
 */
export async function localizar({ morada, localidade, cp }) {
  const cpLimpo = String(cp ?? '').trim()
  try {
    return (
      (await procurar({ street: String(morada ?? '').trim(), city: String(localidade ?? '').trim(), ...(cpLimpo ? { postalcode: cpLimpo } : {}) })) ??
      (cpLimpo ? await procurar({ postalcode: cpLimpo }) : null) ??
      (await procurar({ q: `${String(morada ?? '').trim()}, ${String(localidade ?? '').trim()}` }))
    )
  } catch {
    return null
  }
}

/** Coordenadas de uma morada escrita de uma vez (ex.: a morada de partida, no CRM). */
export async function localizarTexto(texto) {
  try {
    return await procurar({ q: String(texto ?? '').trim() })
  } catch {
    return null
  }
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
