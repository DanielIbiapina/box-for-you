import { resolveProductMeta, lineUnitPrice, MINI_BOX_ID } from './catalog'

export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function isSaleOnDay(sale, dayKey) {
  return (sale.createdAt ?? '').startsWith(dayKey)
}

export function filterSalesByDay(sales, dayKey) {
  return sales.filter((s) => isSaleOnDay(s, dayKey))
}

export function describePosSale(s, catalog, miniBoxPrice = 7) {
  if (s.kind === 'demo') {
    const m = resolveProductMeta(s.demoFlavorId, catalog)
    return `Demonstração · ${m.short}`
  }
  if (s.kind === 'box') {
    const counts = {}
    for (const id of s.boxFlavors ?? []) counts[id] = (counts[id] ?? 0) + 1
    const parts = Object.entries(counts).map(([id, n]) => {
      const m = resolveProductMeta(id, catalog)
      return `${n}× ${m.short}`
    })
    return `BOX · ${parts.join(', ') || '—'}`
  }
  if (s.kind === 'order') {
    return (s.lines ?? [])
      .map((ln) => {
        const m = resolveProductMeta(ln.productId, catalog, ln)
        const p = lineUnitPrice(ln, catalog, miniBoxPrice)
        return `${ln.qty}× ${m.short}${ln.customLabel ? '' : ` (${p.toFixed(2).replace('.', ',')}€)`}`
      })
      .join(' · ')
  }
  return s.kind ?? '—'
}

export function posSaleDetailLines(s, catalog, miniBoxPrice = 7) {
  if (s.kind === 'demo') {
    const m = resolveProductMeta(s.demoFlavorId, catalog)
    return [{ label: m.nome, qty: 1, sub: 'Prova grátis' }]
  }
  if (s.kind === 'box') {
    const counts = {}
    for (const id of s.boxFlavors ?? []) counts[id] = (counts[id] ?? 0) + 1
    return Object.entries(counts).map(([id, qty]) => {
      const m = resolveProductMeta(id, catalog)
      return { label: m.nome, qty, sub: 'Na BOX' }
    })
  }
  if (s.kind === 'order') {
    return (s.lines ?? []).map((ln) => {
      const m = resolveProductMeta(ln.productId, catalog, ln)
      const unit = lineUnitPrice(ln, catalog, miniBoxPrice)
      return {
        label: m.nome,
        qty: ln.qty,
        sub: `${unit.toFixed(2).replace('.', ',')}€ / un.`,
      }
    })
  }
  return []
}

/** Contagem de cookies por productId (inclui legacy e custom como id próprio) */
export function aggregateCookieCounts(sales, catalog) {
  const counts = {}
  const add = (id, qty) => {
    counts[id] = (counts[id] ?? 0) + qty
  }
  for (const s of sales) {
    if (s.kind === 'order') {
      for (const ln of s.lines ?? []) {
        if (ln.productId === MINI_BOX_ID) continue
        add(ln.customLabel ? `custom:${ln.customLabel}` : ln.productId, ln.qty ?? 0)
      }
    } else if (s.kind === 'box') {
      for (const id of s.boxFlavors ?? []) add(id, 1)
    } else if (s.kind === 'demo') {
      add(s.demoFlavorId, 1)
    }
  }
  return counts
}

export function topFlavorsRanking(sales, catalog, limit = 12) {
  const counts = aggregateCookieCounts(sales, catalog)
  return Object.entries(counts)
    .map(([id, qty]) => {
      if (id.startsWith('custom:')) {
        return { id, label: id.replace('custom:', ''), qty, emoji: '✨' }
      }
      const m = resolveProductMeta(id, catalog)
      return { id, label: m.nome, short: m.short, qty, emoji: m.emoji }
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit)
}

export function computePosMetrics(sales, catalog) {
  let total = 0
  const byCookie = Object.fromEntries(catalog.map((c) => [c.id, 0]))
  let miniBoxCount = 0
  const demoCount = { total: 0, byFlavor: Object.fromEntries(catalog.map((c) => [c.id, 0])) }
  const byPayment = {
    dinheiro: { count: 0, eur: 0 },
    mbway: { count: 0, eur: 0 },
    multibanco: { count: 0, eur: 0 },
  }

  for (const s of sales) {
    total += s.totalEur ?? 0
    if ((s.totalEur ?? 0) > 0 && s.paymentId && s.paymentId !== 'gratis' && byPayment[s.paymentId]) {
      byPayment[s.paymentId].count++
      byPayment[s.paymentId].eur += s.totalEur ?? 0
    }
    if (s.kind === 'order') {
      for (const ln of s.lines ?? []) {
        if (ln.productId === MINI_BOX_ID) miniBoxCount += ln.qty ?? 0
        else if (byCookie[ln.productId] != null) byCookie[ln.productId] += ln.qty ?? 0
      }
    } else if (s.kind === 'demo') {
      demoCount.total++
      if (demoCount.byFlavor[s.demoFlavorId] != null) demoCount.byFlavor[s.demoFlavorId]++
    } else if (s.kind === 'box') {
      for (const fid of s.boxFlavors ?? []) {
        if (byCookie[fid] != null) byCookie[fid]++
      }
    }
  }

  const revenueSales = sales.filter((s) => (s.totalEur ?? 0) > 0).length
  return { total, byCookie, demoCount, byPayment, revenueSales, miniBoxCount }
}
