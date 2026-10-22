// Gera public/cp4.json — a zona de cada código postal (4 primeiros dígitos), para a
// taxa de entrega da loja (src/loja/geo.js). Fonte: GeoNames, PT.zip
// (https://download.geonames.org/export/zip/PT.zip), licença CC BY 4.0.
//
// Uso: node scripts/gerar-cp.mjs caminho/para/PT.txt
//
// Formato: { "<CP4>": [lat, lng, raioKm] } — o centro da zona e até onde ela vai.
// O GeoNames não tem um ponto por código postal: na cidade dá o centro do
// concelho (todo o 4470, Maia, é um ponto só), nas freguesias rurais dá o lugar.
// Por isso a zona só serve para limitar onde se procura a rua no mapa.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [, , ficheiro] = process.argv
if (!ficheiro) {
  console.error('Uso: node scripts/gerar-cp.mjs caminho/para/PT.txt')
  process.exit(1)
}

const SAIDA = join(import.meta.dirname, '..', 'public', 'cp4.json')
const CP7 = /^(\d{4})-\d{3}$/
const RAIO_MIN = 8 // km — um ponto só pode ser o centro de um concelho inteiro
const FOLGA = 4 // km para lá do ponto mais afastado
const RAIO_MAX = 20 // km — há lugares mal posicionados na fonte

function distanciaKm(a, b) {
  const rad = (g) => (g * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

const porCP4 = new Map()
for (const linha of readFileSync(ficheiro, 'utf8').split('\n')) {
  const c = linha.split('\t')
  const m = c.length >= 11 && c[1].match(CP7)
  if (!m) continue
  const lat = Number(c[9])
  const lng = Number(c[10])
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
  if (!porCP4.has(m[1])) porCP4.set(m[1], [])
  porCP4.get(m[1]).push({ lat, lng })
}

const zonas = {}
for (const [cp4, pontos] of [...porCP4].sort(([a], [b]) => a.localeCompare(b))) {
  const centro = {
    lat: pontos.reduce((s, p) => s + p.lat, 0) / pontos.length,
    lng: pontos.reduce((s, p) => s + p.lng, 0) / pontos.length,
  }
  const longe = Math.max(...pontos.map((p) => distanciaKm(centro, p)))
  zonas[cp4] = [+centro.lat.toFixed(4), +centro.lng.toFixed(4), Math.min(RAIO_MAX, Math.ceil(Math.max(RAIO_MIN, longe + FOLGA)))]
}

const json = JSON.stringify(zonas)
writeFileSync(SAIDA, json)
console.log(`${porCP4.size} zonas → public/cp4.json (${(json.length / 1024).toFixed(0)} KB)`)
