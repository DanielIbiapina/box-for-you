import { filterSalesByDay, computePosMetrics, saleDayKey, isGiveawayKind } from './salesAnalytics'

export function eventDays(ev) {
  if (ev?.dias?.length) return ev.dias
  if (ev?.data) return [ev.data]
  return []
}

export function saleBelongsToEvent(sale, ev) {
  if (!ev) return false
  if (sale.eventId === ev.id) return true
  const day = saleDayKey(sale)
  return day !== '' && eventDays(ev).includes(day)
}

export function getEventPosSales(sales, ev) {
  return sales.filter((s) => saleBelongsToEvent(s, ev))
}

export function summarizeEvent(sales, ev, catalog) {
  const evSales = getEventPosSales(sales, ev)
  const paid = evSales.filter((s) => (s.totalEur ?? 0) > 0)
  const total = paid.reduce((sum, s) => sum + (s.totalEur ?? 0), 0)

  const explicitDays = eventDays(ev)
  const inferredDays = [
    ...new Set(
      evSales.map((s) => saleDayKey(s)).filter(Boolean),
    ),
  ].sort()

  const dayKeys = explicitDays.length ? explicitDays : inferredDays

  const dayBreakdown = dayKeys.map((day) => {
    const daySales = filterSalesByDay(evSales, day)
    const metrics = computePosMetrics(daySales, catalog)
    return {
      day,
      total: metrics.total,
      vendas: daySales.filter((s) => (s.totalEur ?? 0) > 0).length,
      demos: daySales.filter((s) => s.kind === 'demo').length,
      fidelidades: daySales.filter((s) => s.kind === 'fidelidade').length,
    }
  })

  const cookiesVendidos = dayBreakdown.reduce((acc, d) => acc + d.vendas, 0)

  return {
    total,
    vendas: paid.length,
    demos: evSales.filter((s) => s.kind === 'demo').length,
    fidelidades: evSales.filter((s) => s.kind === 'fidelidade').length,
    dayBreakdown,
    evSales,
    cookiesVendidos,
  }
}

export function formatEventDateRange(ev) {
  const dias = eventDays(ev)
  if (dias.length > 1) {
    const fmt = (d) =>
      new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    return `${fmt(dias[0])} – ${fmt(dias[dias.length - 1])}`
  }
  if (ev?.data) {
    return new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }
  return '—'
}

/** Dias com vendas POS que não pertencem a nenhum evento cadastrado */
export function orphanFairDayEvents(sales, eventos) {
  const activeDays = new Set()
  for (const s of sales) {
    if ((s.totalEur ?? 0) <= 0 && !isGiveawayKind(s.kind)) continue
    const day = saleDayKey(s)
    if (day) activeDays.add(day)
  }

  const orphans = []
  for (const day of activeDays) {
    const daySales = sales.filter((s) => saleDayKey(s) === day)
    const covered = daySales.some((s) =>
      eventos.some((ev) => saleBelongsToEvent(s, ev)),
    )
    if (covered) continue
    orphans.push({
      id: `orphan-day-${day}`,
      nome: `Feira ${new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })}`,
      data: day,
      status: 'concluida',
      virtual: true,
    })
  }

  return orphans.sort((a, b) => (b.data || '').localeCompare(a.data || ''))
}

export function listFeirasWithStats(sales, eventos, catalog) {
  const all = [...eventos, ...orphanFairDayEvents(sales, eventos)]
  return all
    .map((ev) => {
      const stats = summarizeEvent(sales, ev, catalog)
      return { ev, stats }
    })
    .filter(
      ({ ev, stats }) =>
        stats.vendas > 0 ||
        stats.demos > 0 ||
        stats.fidelidades > 0 ||
        stats.total > 0 ||
        ev.status === 'concluida' ||
        ev.tipo === 'multi-dia',
    )
    .sort((a, b) => (b.ev.data || '').localeCompare(a.ev.data || ''))
}
