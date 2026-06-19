import { scheduleSync } from './syncService'
import { LEGACY_COOKIES } from './catalog'
import { BOW_FEIRA_SALES } from './bowFeiraSalesData'

const MIGRATION_KEY = 'bfy:migrations-applied'
const SALES_KEY = 'cookies-sales:v1'
const EVENTOS_KEY = 'bfy:eventos'
const COOKIES_KEY = 'bfy:feiras-cookies'

const FEIRA_BOW_2026 = {
  id: 'feira-brazil-origem-week-2026',
  nome: 'Feira do Brazil Origem Week',
  local: 'Portugal',
  data: '2026-05-01',
  dataFim: '2026-05-03',
  dias: ['2026-05-01', '2026-05-02', '2026-05-03'],
  status: 'concluida',
  tipo: 'multi-dia',
}

const BOW_DAYS = new Set(['2026-05-01', '2026-05-02', '2026-05-03'])

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
  scheduleSync(key)
}

function applied(id) {
  const map = readJson(MIGRATION_KEY, {})
  return !!map[id]
}

function markApplied(id) {
  const map = readJson(MIGRATION_KEY, {})
  map[id] = new Date().toISOString()
  writeJson(MIGRATION_KEY, map)
}

function ensureBowImportSales() {
  let sales = readJson(SALES_KEY, [])
  const bowLinked = sales.filter(
    (s) =>
      s.eventId === FEIRA_BOW_2026.id ||
      (String(s.id).startsWith('import-feira') && BOW_DAYS.has((s.createdAt ?? '').slice(0, 10))),
  )
  if (bowLinked.length >= BOW_FEIRA_SALES.length) return

  const existingIds = new Set(sales.map((s) => s.id))
  const toAdd = BOW_FEIRA_SALES.filter((s) => !existingIds.has(s.id))
  if (!toAdd.length) return

  sales = [...sales, ...toAdd]
  writeJson(SALES_KEY, sales)
}

function ensureBrazilOrigemWeekFeira() {
  let eventos = readJson(EVENTOS_KEY, [])
  const idx = eventos.findIndex((e) => e.id === FEIRA_BOW_2026.id)
  if (idx === -1) {
    eventos = [...eventos, FEIRA_BOW_2026].sort((a, b) => (a.data || '').localeCompare(b.data || ''))
    writeJson(EVENTOS_KEY, eventos)
  } else {
    eventos[idx] = { ...eventos[idx], ...FEIRA_BOW_2026 }
    writeJson(EVENTOS_KEY, eventos)
  }

  let sales = readJson(SALES_KEY, [])
  let changed = false
  sales = sales.map((s) => {
    const day = (s.createdAt ?? '').slice(0, 10)
    if (BOW_DAYS.has(day) && s.eventId !== FEIRA_BOW_2026.id) {
      changed = true
      return { ...s, eventId: FEIRA_BOW_2026.id }
    }
    return s
  })
  if (changed) writeJson(SALES_KEY, sales)

  if (!applied('feira-bow-2026')) markApplied('feira-bow-2026')
}

function ensureLegacyCookiesInCatalog() {
  if (applied('legacy-cookies-catalog')) return
  let cookies = readJson(COOKIES_KEY, [])
  const ids = new Set(cookies.map((c) => c.id))
  let changed = false
  for (const leg of LEGACY_COOKIES) {
    if (!ids.has(leg.id)) {
      cookies.push({ ...leg })
      changed = true
    } else {
      cookies = cookies.map((c) =>
        c.id === leg.id ? { ...c, ativoNoCardapio: false } : c,
      )
      changed = true
    }
  }
  if (changed) writeJson(COOKIES_KEY, cookies)
  markApplied('legacy-cookies-catalog')
}

/** Remove venda avulsa 07/06/2026 05:02 · 10,50€ */
function removeSale20260607() {
  if (applied('remove-sale-2026-06-07-0502')) return
  let sales = readJson(SALES_KEY, [])
  const before = sales.length
  sales = sales.filter((s) => {
    if (s.kind !== 'order') return true
    if (Math.abs((s.totalEur ?? 0) - 10.5) > 0.01) return true
    const d = new Date(s.createdAt)
    if (Number.isNaN(d.getTime())) return true
    const match =
      d.getFullYear() === 2026 &&
      d.getMonth() === 5 &&
      d.getDate() === 7 &&
      d.getHours() === 5 &&
      d.getMinutes() === 2
    return !match
  })
  if (sales.length !== before) writeJson(SALES_KEY, sales)
  markApplied('remove-sale-2026-06-07-0502')
}

export function runDataMigrations() {
  ensureLegacyCookiesInCatalog()
  ensureBowImportSales()
  ensureBrazilOrigemWeekFeira()
  removeSale20260607()
}
