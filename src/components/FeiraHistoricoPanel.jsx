import { useMemo, useState } from 'react'
import { summarizeEvent, formatEventDateRange } from '../lib/feiraHistory'
import { describePosSale, topFlavorsRanking } from '../lib/salesAnalytics'

const PAYMENT_FILTERS = [
  { id: 'all', label: 'Todos' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'mbway', label: 'MB WAY' },
  { id: 'multibanco', label: 'Multibanco' },
  { id: 'gratis', label: 'Provas' },
]

const PAYMENT_LABELS = {
  dinheiro: 'Dinheiro',
  mbway: 'MB WAY',
  multibanco: 'Multibanco',
  gratis: 'Prova grátis',
}

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const fmtDay = (day) =>
  new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

const fmtDayShort = (day) =>
  new Date(day + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  })

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

function paymentLabel(id) {
  return PAYMENT_LABELS[id] ?? id ?? '—'
}

export function FeiraHistoricoPanel({ evento, sales, catalog }) {
  const { total, vendas, demos, dayBreakdown, evSales } = summarizeEvent(
    sales,
    evento,
    catalog,
  )

  const isMultiDay = dayBreakdown.length > 1
  const [selectedDay, setSelectedDay] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('all')

  const dayStats = useMemo(() => {
    if (selectedDay === 'all') return { total, vendas, demos }
    const d = dayBreakdown.find((x) => x.day === selectedDay)
    return d
      ? { total: d.total, vendas: d.vendas, demos: d.demos }
      : { total: 0, vendas: 0, demos: 0 }
  }, [selectedDay, total, vendas, demos, dayBreakdown])

  const dayScopedSales = useMemo(() => {
    const list = evSales.filter((s) => (s.totalEur ?? 0) > 0 || s.kind === 'demo' || (s.desconto ?? 0) > 0)
    if (selectedDay === 'all') return list
    return list.filter((s) => (s.createdAt ?? '').slice(0, 10) === selectedDay)
  }, [evSales, selectedDay])

  const filteredSales = useMemo(() => {
    if (paymentFilter === 'all') return dayScopedSales
    if (paymentFilter === 'gratis') {
      return dayScopedSales.filter((s) => s.kind === 'demo' || s.paymentId === 'gratis')
    }
    return dayScopedSales.filter((s) => s.paymentId === paymentFilter)
  }, [dayScopedSales, paymentFilter])

  const flavorRanking = useMemo(
    () => topFlavorsRanking(dayScopedSales, catalog, 12),
    [dayScopedSales, catalog],
  )
  const maxRankBar = Math.max(...flavorRanking.map((r) => r.qty), 1)

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs opacity-50" style={{ color: 'var(--color-text)' }}>
          {formatEventDateRange(evento)}
          {evento.local ? ` · ${evento.local}` : ''}
        </p>

        {isMultiDay && (
          <div
            className="flex flex-wrap gap-2 mt-3 pb-1"
            role="tablist"
            aria-label="Dias da feira"
          >
            <DayTab
              active={selectedDay === 'all'}
              onClick={() => setSelectedDay('all')}
              label="Todos"
              sub={fmtEuro(total)}
            />
            {dayBreakdown.map((d) => (
              <DayTab
                key={d.day}
                active={selectedDay === d.day}
                onClick={() => setSelectedDay(d.day)}
                label={fmtDayShort(d.day)}
                sub={fmtEuro(d.total)}
              />
            ))}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            {
              label: selectedDay === 'all' ? 'Caixa total' : 'Caixa do dia',
              value: fmtEuro(dayStats.total),
              accent: true,
            },
            { label: 'Vendas', value: dayStats.vendas },
            { label: 'Demos', value: dayStats.demos },
          ].map(({ label, value, accent }) => (
            <div
              key={label}
              className="rounded-xl p-3 text-center"
              style={{
                background: accent ? 'rgba(154,59,28,0.08)' : 'rgba(29,16,8,0.04)',
              }}
            >
              <p
                className="text-lg font-black tabular-nums"
                style={{ color: accent ? 'var(--color-accent-dark)' : 'var(--color-text)' }}
              >
                {value}
              </p>
              <p className="text-[10px] opacity-45 mt-0.5" style={{ color: 'var(--color-text)' }}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {isMultiDay && selectedDay === 'all' && dayBreakdown.length > 0 && (
        <div className="space-y-2">
          <p
            className="text-[11px] font-black uppercase tracking-widest opacity-45"
            style={{ color: 'var(--color-text)' }}
          >
            Resumo por dia
          </p>
          {dayBreakdown.map((d) => (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelectedDay(d.day)}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all hover:bg-black/[0.03]"
              style={{ background: 'rgba(29,16,8,0.04)', border: '1px solid rgba(29,16,8,0.06)' }}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold capitalize" style={{ color: 'var(--color-text)' }}>
                  {fmtDay(d.day)}
                </p>
                <p className="text-[10px] opacity-45" style={{ color: 'var(--color-text)' }}>
                  {d.vendas} venda{d.vendas !== 1 ? 's' : ''}
                  {d.demos > 0 ? ` · ${d.demos} demo${d.demos !== 1 ? 's' : ''}` : ''}
                </p>
              </div>
              <span className="font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                {fmtEuro(d.total)}
              </span>
            </button>
          ))}
        </div>
      )}

      {isMultiDay && selectedDay !== 'all' && (
        <p className="text-sm font-semibold capitalize" style={{ color: 'var(--color-text)' }}>
          {fmtDay(selectedDay)}
        </p>
      )}

      {flavorRanking.length > 0 && (
        <div className="space-y-2">
          <p
            className="text-[11px] font-black uppercase tracking-widest opacity-45"
            style={{ color: 'var(--color-text)' }}
          >
            Cookies vendidos{selectedDay !== 'all' ? ' · dia' : ''}
          </p>
          <div className="space-y-1.5">
            {flavorRanking.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <span className="w-28 font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                  {r.emoji} {r.short ?? r.label}
                </span>
                <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'rgba(29,16,8,0.1)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(r.qty / maxRankBar) * 100}%`, background: 'var(--color-accent)' }}
                  />
                </div>
                <span className="w-5 text-right font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
                  {r.qty}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dayScopedSales.length > 0 && (
        <div className="space-y-1.5 max-h-[min(52vh,520px)] overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p
              className="text-[11px] font-black uppercase tracking-widest opacity-45"
              style={{ color: 'var(--color-text)' }}
            >
              Registos{filteredSales.length !== dayScopedSales.length
                ? ` · ${filteredSales.length}/${dayScopedSales.length}`
                : selectedDay !== 'all'
                  ? ` · ${filteredSales.length}`
                  : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 mb-1">
            {PAYMENT_FILTERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPaymentFilter(p.id)}
                className="rounded-lg px-2 py-1 text-[10px] font-bold transition-all"
                style={{
                  background: paymentFilter === p.id ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.05)',
                  color: paymentFilter === p.id ? '#fff' : 'var(--color-text)',
                  border: paymentFilter === p.id
                    ? '1.5px solid var(--color-accent-dark)'
                    : '1px solid rgba(29,16,8,0.1)',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {filteredSales.length === 0 ? (
            <p className="text-xs opacity-40 py-2" style={{ color: 'var(--color-text)' }}>
              Nenhum registo com este filtro.
            </p>
          ) : (
            filteredSales.map((s) => (
              <div
                key={s.id}
                className="rounded-lg px-2.5 py-2 text-xs"
                style={{ background: 'rgba(29,16,8,0.03)', border: '1px solid rgba(29,16,8,0.05)' }}
              >
                <div className="flex justify-between gap-2">
                  <span className="opacity-45 shrink-0">
                    {isMultiDay && selectedDay === 'all'
                      ? `${(s.createdAt ?? '').slice(8, 10)}/${(s.createdAt ?? '').slice(5, 7)} · ${fmtTime(s.createdAt)}`
                      : fmtTime(s.createdAt)}
                  </span>
                  <span className="font-black tabular-nums shrink-0" style={{ color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(s.totalEur ?? 0)}
                  </span>
                </div>
                <p className="opacity-65 mt-0.5 truncate" style={{ color: 'var(--color-text)' }}>
                  {describePosSale(s, catalog)}
                </p>
                <p className="opacity-40 mt-0.5" style={{ color: 'var(--color-text)' }}>
                  {s.kind === 'demo' || s.paymentId === 'gratis'
                    ? 'Prova grátis'
                    : paymentLabel(s.paymentId)}
                  {(s.desconto ?? 0) > 0 ? ` · desconto −${fmtEuro(s.desconto)}` : ''}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {dayStats.vendas === 0 && dayStats.demos === 0 && (
        <p className="text-sm text-center py-4 opacity-40" style={{ color: 'var(--color-text)' }}>
          {selectedDay === 'all'
            ? 'Sem vendas POS associadas a esta feira.'
            : 'Nenhum registo neste dia.'}
        </p>
      )}
    </div>
  )
}

function DayTab({ active, onClick, label, sub }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className="rounded-xl px-3 py-2 text-left transition-all shrink-0"
      style={{
        background: active ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.05)',
        border: active ? '2px solid var(--color-accent-dark)' : '1.5px solid rgba(29,16,8,0.1)',
        color: active ? '#fff' : 'var(--color-text)',
      }}
    >
      <span className="block text-xs font-bold capitalize">{label}</span>
      <span
        className="block text-[10px] font-black tabular-nums mt-0.5"
        style={{ opacity: active ? 0.85 : 0.5 }}
      >
        {sub}
      </span>
    </button>
  )
}
