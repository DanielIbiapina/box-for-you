import { resolveProductMeta, lineUnitPrice, MINI_BOX_ID, TASTING_BOX_ID } from './catalog'

/** Dia civil local (YYYY-MM-DD) — evita desalinhamento UTC vs feira no fuso local */
export function todayKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Dia civil local da venda a partir de createdAt (ISO) */
export function saleDayKey(sale) {
  const iso = sale?.createdAt
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10)
  return todayKey(d)
}

export function isSaleOnDay(sale, dayKey) {
  return saleDayKey(sale) === dayKey
}

export function filterSalesByDay(sales, dayKey) {
  return sales.filter((s) => isSaleOnDay(s, dayKey))
}

export function isGiveawayKind(kind) {
  return kind === 'demo' || kind === 'fidelidade'
}

export function giveawayFlavorId(s) {
  return s?.demoFlavorId || s?.flavorId || null
}

export function describePosSale(s, catalog, miniBoxPrice = 7) {
  if (s.kind === 'demo') {
    const m = resolveProductMeta(giveawayFlavorId(s), catalog)
    return `Demonstração · ${m.short}`
  }
  if (s.kind === 'fidelidade') {
    const m = resolveProductMeta(giveawayFlavorId(s), catalog)
    return `Fidelidade · ${m.short}`
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
    const m = resolveProductMeta(giveawayFlavorId(s), catalog)
    return [{ label: m.nome, qty: 1, sub: 'Prova grátis' }]
  }
  if (s.kind === 'fidelidade') {
    const m = resolveProductMeta(giveawayFlavorId(s), catalog)
    return [{ label: m.nome, qty: 1, sub: 'Cartão fidelidade' }]
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

/**
 * Contagem de cookies vendidos por productId (inclui legacy e custom como id próprio).
 * Provas grátis e cartão fidelidade ficam de fora — não são vendas e têm
 * contagem própria em computePosMetrics(), para não contaminar rankings.
 */
export function aggregateCookieCounts(sales, catalog) {
  const counts = {}
  const add = (id, qty) => {
    counts[id] = (counts[id] ?? 0) + qty
  }
  for (const s of sales) {
    if (s.kind === 'order') {
      for (const ln of s.lines ?? []) {
        // Caixas são produtos, não sabores — ficam fora do ranking de sabores
        if (ln.productId === MINI_BOX_ID || ln.productId === TASTING_BOX_ID) continue
        add(ln.customLabel ? `custom:${ln.customLabel}` : ln.productId, ln.qty ?? 0)
      }
    } else if (s.kind === 'box') {
      for (const id of s.boxFlavors ?? []) add(id, 1)
    }
  }
  return counts
}

/**
 * Contagem de cookies por sabor a partir de pedidos diretos (WhatsApp, pessoal
 * ou loja online — todos caem na mesma tabela `pedidos`). Mini Box, Tasting Box
 * e caixas extras (customLabel) ficam fora, igual ao ranking da Feira: não são
 * 1 sabor só. A 1ª caixa de cada pedido (coluna nativa `box.counts`) entra
 * normalmente, sabor a sabor.
 */
export function aggregatePedidoCookieCounts(pedidos) {
  const counts = {}
  const add = (id, qty) => {
    counts[id] = (counts[id] ?? 0) + qty
  }
  for (const p of pedidos) {
    if (p.status === 'cancelado') continue
    for (const ln of p.linhas ?? []) {
      if (ln.customLabel) continue
      if (ln.cookieId === MINI_BOX_ID || ln.cookieId === TASTING_BOX_ID) continue
      add(ln.cookieId, ln.qty ?? 0)
    }
    for (const [cookieId, qty] of Object.entries(p.box?.counts ?? {})) {
      if (qty > 0) add(cookieId, qty)
    }
  }
  return counts
}

/** Soma dois ou mais mapas { id: qty } num só — usado para combinar Feira + Pedidos. */
export function mergeCookieCounts(...countMaps) {
  const merged = {}
  for (const map of countMaps) {
    for (const [id, qty] of Object.entries(map)) {
      merged[id] = (merged[id] ?? 0) + qty
    }
  }
  return merged
}

/** Transforma um mapa { id: qty } no array ordenado usado pelos rankings. */
export function rankFromCounts(counts, catalog, limit = 12) {
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

export function topFlavorsRanking(sales, catalog, limit = 12) {
  return rankFromCounts(aggregateCookieCounts(sales, catalog), catalog, limit)
}

export function computePosMetrics(sales, catalog) {
  let total = 0
  const byCookie = Object.fromEntries(catalog.map((c) => [c.id, 0]))
  let miniBoxCount = 0
  const emptyByFlavor = () => Object.fromEntries(catalog.map((c) => [c.id, 0]))
  const demoCount = { total: 0, byFlavor: emptyByFlavor() }
  const fidelidadeCount = { total: 0, byFlavor: emptyByFlavor() }
  const byPayment = {
    dinheiro: { count: 0, eur: 0 },
    mbway: { count: 0, eur: 0 },
    multibanco: { count: 0, eur: 0 },
  }

  for (const s of sales) {
    total += s.totalEur ?? 0
    if ((s.totalEur ?? 0) > 0 && s.paymentId && s.paymentId !== 'gratis' && s.paymentId !== 'fidelidade' && byPayment[s.paymentId]) {
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
      const fid = giveawayFlavorId(s)
      if (demoCount.byFlavor[fid] != null) demoCount.byFlavor[fid]++
    } else if (s.kind === 'fidelidade') {
      fidelidadeCount.total++
      const fid = giveawayFlavorId(s)
      if (fidelidadeCount.byFlavor[fid] != null) fidelidadeCount.byFlavor[fid]++
    } else if (s.kind === 'box') {
      for (const fid of s.boxFlavors ?? []) {
        if (byCookie[fid] != null) byCookie[fid]++
      }
    }
  }

  const revenueSales = sales.filter((s) => (s.totalEur ?? 0) > 0).length
  return { total, byCookie, demoCount, fidelidadeCount, byPayment, revenueSales, miniBoxCount }
}
