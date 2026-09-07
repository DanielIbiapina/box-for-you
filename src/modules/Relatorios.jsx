import { useEffect, useMemo, useState } from 'react'
import { useEventos } from '../stores/useEventos'
import { usePedidosVendas } from '../stores/usePedidosVendas'
import { useClientes } from '../stores/useClientes'
import { useVendas } from '../stores/useVendas'
import { Icon } from '../components/Icon'
import { BarChart } from '../components/BarChart'
import { Modal } from '../components/Modal'
import { FeiraHistoricoPanel } from '../components/FeiraHistoricoPanel'
import { withLegacyCookies } from '../lib/catalog'
import { useCookies } from '../stores/useCookies'
import {
  describePosSale,
  aggregateCookieCounts,
  aggregatePedidoCookieCounts,
  mergeCookieCounts,
  rankFromCounts,
  computePosMetrics,
} from '../lib/salesAnalytics'
import { summarizeEvent, formatEventDateRange, orphanFairDayEvents } from '../lib/feiraHistory'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

const PAY_LABELS = { dinheiro: 'Dinheiro', mbway: 'MB WAY', multibanco: 'Multibanco', gratis: 'Grátis' }

// ─── Ícones SVG ──────────────────────────────────────────────────────────────

function IconEuro() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <circle cx="12" cy="12" r="9" />
      <path d="M14.5 8.5A4 4 0 0 0 8 12a4 4 0 0 0 6.5 3.5" />
      <path d="M7 10.5h5M7 13.5h5" />
    </svg>
  )
}

function IconCart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6Z" />
    </svg>
  )
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2l-3 2-3-2-3 2-3-2-3 2Z" />
      <path d="M8 9h8M8 13h6" />
    </svg>
  )
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
      <path d="M3 17l5-5 4 4 9-9" />
      <path d="M15 7h5v5" />
    </svg>
  )
}

function PosSaleRow({ sale, catalog }) {
  const title = describePosSale(sale, catalog)

  return (
    <div
      className="flex items-start gap-3 rounded-xl px-3 py-2.5"
      style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold leading-snug" style={{ color: 'var(--color-text)' }}>
          {title}
        </p>
        <p className="text-[11px] mt-0.5 ink-3">
          {fmtDate(sale.createdAt)} · {fmtTime(sale.createdAt)}
          {sale.paymentId && sale.paymentId !== 'gratis' && (
            <span> · {PAY_LABELS[sale.paymentId] ?? sale.paymentId}</span>
          )}
        </p>
      </div>
      <span className="text-sm font-black tabular-nums shrink-0" style={{ color: 'var(--color-accent-dark)' }}>
        {fmtEuro(sale.totalEur ?? 0)}
      </span>
    </div>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

const POS_INICIAL = 20

export function Relatorios() {
  const { eventos } = useEventos()
  const { pedidos: pedidosVendas } = usePedidosVendas()
  const { clientes } = useClientes()
  const { sales: salesPos } = useVendas()
  const { cookies: cookiesAtivos } = useCookies()
  const catalog = useMemo(() => withLegacyCookies(cookiesAtivos), [cookiesAtivos])

  const now = new Date()
  const [mesSelecionado, setMesSelecionado] = useState(monthKey(now))
  const [tabVendas, setTabVendas] = useState('avulsas')
  const [posVisiveis, setPosVisiveis] = useState(POS_INICIAL)
  const [historicoEvent, setHistoricoEvent] = useState(null)
  const [incluirFeira, setIncluirFeira] = useState(true)
  const [incluirPedidos, setIncluirPedidos] = useState(true)

  useEffect(() => {
    setPosVisiveis(POS_INICIAL)
  }, [mesSelecionado])

  const meses = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      return {
        key: monthKey(d),
        label: d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' }),
        short: d.toLocaleString('pt-BR', { month: 'short' }),
      }
    }).reverse()
  }, [])

  const chartData = useMemo(() => {
    return meses.slice().reverse().map((m) => {
      const posVal = salesPos
        .filter((s) => (s.createdAt ?? '').startsWith(m.key) && (s.totalEur ?? 0) > 0)
        .reduce((sum, s) => sum + (s.totalEur ?? 0), 0)
      const diretaVal = pedidosVendas
        .filter((p) => p.criadoEm.startsWith(m.key) && p.status !== 'cancelado')
        .reduce((sum, p) => sum + p.totalEur, 0)
      return { label: m.short, value: posVal + diretaVal }
    })
  }, [salesPos, pedidosVendas, meses])

  const statsMes = useMemo(() => {
    const posVendas = salesPos.filter(
      (s) => (s.createdAt ?? '').startsWith(mesSelecionado) && (s.totalEur ?? 0) > 0,
    )
    const posReceita = posVendas.reduce((sum, s) => sum + (s.totalEur ?? 0), 0)
    const demos = salesPos.filter(
      (s) => (s.createdAt ?? '').startsWith(mesSelecionado) && s.kind === 'demo',
    ).length
    const diretasMes = pedidosVendas.filter(
      (p) => p.criadoEm.startsWith(mesSelecionado) && p.status !== 'cancelado',
    )
    const diretaReceita = diretasMes.reduce((sum, p) => sum + p.totalEur, 0)
    const cookiesVendidos = Object.values(
      aggregateCookieCounts(
        salesPos.filter((s) => (s.createdAt ?? '').startsWith(mesSelecionado)),
        catalog,
      ),
    ).reduce((a, b) => a + b, 0)

    return {
      totalReceita: posReceita + diretaReceita,
      posVendas: posVendas.length,
      diretasVendas: diretasMes.length,
      demos,
      cookiesVendidos,
      ticketMedio: posVendas.length ? posReceita / posVendas.length : 0,
    }
  }, [salesPos, pedidosVendas, mesSelecionado, catalog])

  const pagamentosMes = useMemo(
    () =>
      computePosMetrics(
        salesPos.filter((s) => (s.createdAt ?? '').startsWith(mesSelecionado)),
        catalog,
      ).byPayment,
    [salesPos, mesSelecionado, catalog],
  )

  const rankingSabores = useMemo(() => {
    const feira = incluirFeira
      ? aggregateCookieCounts(
          salesPos.filter((s) => (s.createdAt ?? '').startsWith(mesSelecionado)),
          catalog,
        )
      : {}
    const pedidos = incluirPedidos
      ? aggregatePedidoCookieCounts(
          pedidosVendas.filter((p) => (p.criadoEm ?? '').startsWith(mesSelecionado)),
        )
      : {}
    return rankFromCounts(mergeCookieCounts(feira, pedidos), catalog, 15)
  }, [salesPos, pedidosVendas, mesSelecionado, catalog, incluirFeira, incluirPedidos])

  const rankingAllTime = useMemo(() => {
    const feira = incluirFeira ? aggregateCookieCounts(salesPos, catalog) : {}
    const pedidos = incluirPedidos ? aggregatePedidoCookieCounts(pedidosVendas) : {}
    return rankFromCounts(mergeCookieCounts(feira, pedidos), catalog, 10)
  }, [salesPos, pedidosVendas, catalog, incluirFeira, incluirPedidos])

  const maxRank = Math.max(...rankingSabores.map((r) => r.qty), 1)

  const insights = useMemo(() => {
    const posMes = salesPos.filter(
      (s) => (s.createdAt ?? '').startsWith(mesSelecionado) && (s.totalEur ?? 0) > 0,
    )
    const byDay = {}
    const byPay = {}
    for (const s of posMes) {
      const day = (s.createdAt ?? '').slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + (s.totalEur ?? 0)
      const p = s.paymentId ?? 'outro'
      byPay[p] = (byPay[p] ?? 0) + 1
    }
    const bestDay = Object.entries(byDay).sort((a, b) => b[1] - a[1])[0]
    const topPay = Object.entries(byPay).sort((a, b) => b[1] - a[1])[0]
    const champion = rankingSabores[0]
    return { bestDay, topPay, champion }
  }, [salesPos, mesSelecionado, rankingSabores])

  const diretasDoMes = useMemo(
    () => pedidosVendas.filter((p) => p.criadoEm.startsWith(mesSelecionado) && p.status !== 'cancelado'),
    [pedidosVendas, mesSelecionado],
  )

  const posMes = useMemo(
    () => salesPos.filter((s) => (s.createdAt ?? '').startsWith(mesSelecionado) && (s.totalEur ?? 0) > 0),
    [salesPos, mesSelecionado],
  )

  const posMesVisivel = useMemo(() => posMes.slice(0, posVisiveis), [posMes, posVisiveis])
  const posRestantes = Math.max(0, posMes.length - posVisiveis)

  const porEvento = useMemo(() => {
    const all = [...eventos, ...orphanFairDayEvents(salesPos, eventos)]
    return all
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
      .map((ev) => {
        const stats = summarizeEvent(salesPos, ev, catalog)
        return {
          ...ev,
          dateLabel: formatEventDateRange(ev),
          receita: stats.total,
          vendas: stats.vendas,
          cookies: Object.values(aggregateCookieCounts(stats.evSales, catalog)).reduce((a, b) => a + b, 0),
          stats,
        }
      })
  }, [eventos, salesPos, catalog])

  function exportarResumo() {
    const mesObj = meses.find((m) => m.key === mesSelecionado)
    const lines = [
      `Relatório Crumb Lab`,
      `Mês: ${mesObj?.label ?? mesSelecionado}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      `Receita total: ${fmtEuro(statsMes.totalReceita)}`,
      `Vendas POS: ${statsMes.posVendas}`,
      `Vendas diretas: ${statsMes.diretasVendas}`,
      `Cookies vendidos (POS): ${statsMes.cookiesVendidos}`,
      `Demos: ${statsMes.demos}`,
      '',
      'Top sabores:',
      ...rankingSabores.slice(0, 10).map((r, i) => `  ${i + 1}. ${r.label} — ${r.qty}`),
    ]
    navigator.clipboard?.writeText(lines.join('\n'))
    alert('Resumo copiado!')
  }

  return (
    <div className="bfy-page space-y-5">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="bfy-page-title">
            Relatórios & Métricas
          </h1>
          <p className="text-sm mt-1 ink-3">
            Feiras, vendas diretas e ranking de sabores
          </p>
        </div>
        <button className="btn-ghost text-xs px-4 py-2" onClick={exportarResumo}>
          Exportar
        </button>
      </div>

      {/* Gráfico */}
      <div className="bfy-card p-5">
        <h2 className="bfy-eyebrow mb-4">
          Receita total — últimos 6 meses (€)
        </h2>
        <BarChart data={chartData} height={110} />
      </div>

      {/* Seletor de mês + KPIs */}
      <div className="bfy-card p-5 space-y-4">
        <h2 className="bfy-eyebrow">
          Relatório mensal
        </h2>

        <div className="flex flex-wrap gap-2">
          {meses.map((m) => (
            <button
              key={m.key}
              onClick={() => setMesSelecionado(m.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: mesSelecionado === m.key ? 'var(--color-accent-dark)' : 'var(--line-1)',
                color: mesSelecionado === m.key ? '#fff' : 'var(--color-text)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { icon: <IconEuro />, value: fmtEuro(statsMes.totalReceita), label: 'Receita', accent: true },
            { icon: <IconTrend />, value: statsMes.posVendas, label: 'Vendas POS' },
            { icon: <IconReceipt />, value: statsMes.diretasVendas, label: 'Diretas' },
            { icon: <IconCart />, value: statsMes.cookiesVendidos, label: 'Cookies POS' },
            { icon: <IconStar />, value: statsMes.demos, label: 'Demos' },
            {
              icon: <IconEuro />,
              value: statsMes.ticketMedio ? fmtEuro(statsMes.ticketMedio) : '—',
              label: 'Ticket POS',
            },
          ].map((k, i) => (
            <div
              key={i}
              className="rounded-2xl p-3 flex flex-col gap-1.5"
              style={{
                background: k.accent ? 'var(--color-accent-soft)' : 'var(--color-surface-sunk)',
                border: `1px solid ${k.accent ? 'rgba(154,59,28,0.18)' : 'var(--line-1)'}`,
              }}
            >
              <div style={{ color: k.accent ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.4)' }}>
                {k.icon}
              </div>
              <div
                className="text-lg font-black tabular-nums leading-none"
                style={{
                  fontFamily: 'var(--font-title)',
                  color: k.accent ? 'var(--color-accent-dark)' : 'var(--color-text)',
                }}
              >
                {k.value}
              </div>
              <div className="text-[11px] leading-tight ink-3">
                {k.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total por forma de pagamento (POS) */}
      <div className="bfy-card p-5 space-y-3">
        <h2 className="bfy-eyebrow">
          Total por forma de pagamento — {meses.find((m) => m.key === mesSelecionado)?.label}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'dinheiro', label: 'Dinheiro' },
            { id: 'mbway', label: 'MB WAY' },
            { id: 'multibanco', label: 'Multibanco' },
          ].map((p) => {
            const r = pagamentosMes[p.id] ?? { count: 0, eur: 0 }
            return (
              <div
                key={p.id}
                className="rounded-xl px-3 py-2.5"
                style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
              >
                <div className="text-[11px] font-bold ink-3">{p.label}</div>
                <div className="text-lg font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
                  {fmtEuro(r.eur)}
                </div>
                <div className="text-[11px] ink-4">{r.count}×</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Insights divertidos */}
      <div className="grid sm:grid-cols-3 gap-3">
        {insights.champion && (
          <div className="bfy-card p-4" style={{ background: 'var(--color-accent-soft)' }}>
            <div className="flex items-center gap-2 mb-1.5" style={{ color: 'var(--color-accent-dark)' }}>
              <Icon name="troféu" size={17} />
              <span className="bfy-eyebrow" style={{ color: 'var(--color-accent-dark)' }}>Campeão do mês</span>
            </div>
            <p className="bfy-title" style={{ fontSize: 'var(--text-lg)', color: 'var(--color-accent-dark)' }}>
              {insights.champion.label}
            </p>
            <p className="ink-3" style={{ fontSize: 'var(--text-xs)' }}>
              {insights.champion.qty} unidades vendidas
            </p>
          </div>
        )}
        {insights.bestDay && (
          <div className="bfy-card p-4">
            <div className="flex items-center gap-2 mb-1.5 ink-3">
              <Icon name="calendario" size={17} />
              <span className="bfy-eyebrow">Melhor dia de feira</span>
            </div>
            <p className="bfy-title" style={{ fontSize: 'var(--text-lg)' }}>
              {fmtDate(insights.bestDay[0] + 'T12:00:00')}
            </p>
            <p className="ink-3 bfy-num" style={{ fontSize: 'var(--text-xs)' }}>
              {fmtEuro(insights.bestDay[1])} no caixa
            </p>
          </div>
        )}
        {insights.topPay && (
          <div className="bfy-card p-4">
            <div className="flex items-center gap-2 mb-1.5 ink-3">
              <Icon name="financeiro" size={17} />
              <span className="bfy-eyebrow">Pagamento favorito</span>
            </div>
            <p className="bfy-title" style={{ fontSize: 'var(--text-lg)' }}>
              {PAY_LABELS[insights.topPay[0]] ?? insights.topPay[0]}
            </p>
            <p className="ink-3" style={{ fontSize: 'var(--text-xs)' }}>
              {insights.topPay[1]} vendas este mês
            </p>
          </div>
        )}
      </div>

      {/* Ranking sabores */}
      <div className="bfy-card p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="bfy-eyebrow">
            Ranking de sabores — {meses.find((m) => m.key === mesSelecionado)?.label}
          </h2>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={incluirFeira}
                onChange={(e) => setIncluirFeira(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-accent-dark)]"
              />
              Feira
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer" style={{ color: 'var(--color-text)' }}>
              <input
                type="checkbox"
                checked={incluirPedidos}
                onChange={(e) => setIncluirPedidos(e.target.checked)}
                className="w-4 h-4 accent-[var(--color-accent-dark)]"
              />
              Pedidos
            </label>
          </div>
        </div>
        {!incluirFeira && !incluirPedidos ? (
          <p className="text-sm text-center py-6 ink-3">
            Marca "Feira" e/ou "Pedidos" pra ver o ranking.
          </p>
        ) : rankingSabores.length === 0 ? (
          <p className="text-sm text-center py-6 ink-3">
            Nenhum cookie vendido neste mês {incluirFeira && incluirPedidos ? '' : incluirFeira ? '(Feira)' : '(Pedidos)'}.
          </p>
        ) : (
          <div className="space-y-2">
            {rankingSabores.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3">
                <span
                  className="w-6 text-center text-xs font-black shrink-0"
                  style={{ color: i < 3 ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.35)' }}
                >
                  {i + 1}
                </span>
                <span className="text-lg shrink-0">{r.emoji}</span>
                <span className="w-28 sm:w-36 text-xs font-bold truncate" style={{ color: 'var(--color-text)' }}>
                  {r.label}
                </span>
                <div className="flex-1 rounded-full h-2 overflow-hidden" style={{ background: 'var(--color-surface-sunk)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(r.qty / maxRank) * 100}%`,
                      background:
                        i === 0
                          ? 'var(--color-accent-dark)'
                          : i === 1
                            ? 'var(--color-accent)'
                            : 'rgba(154,59,28,0.45)',
                    }}
                  />
                </div>
                <span className="w-8 text-right text-sm font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
                  {r.qty}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] pt-1 ink-3">
          {incluirFeira && incluirPedidos
            ? 'Junta vendas do Caixa da Feira com pedidos diretos (WhatsApp, pessoal) e da loja online.'
            : incluirFeira
              ? 'Só vendas do Caixa da Feira — desmarca "Feira" e marca "Pedidos" pra ver os diretos/loja.'
              : 'Só pedidos diretos (WhatsApp, pessoal) e da loja online — marca "Feira" pra somar o caixa.'}
          {' '}Inclui sabores atuais, históricos (ex. BOW) e vendas personalizadas.
        </p>
      </div>

      {/* Hall da fama — all time */}
      {rankingAllTime.length > 0 && (
        <div className="bfy-card p-5">
          <h2 className="bfy-eyebrow mb-3">
            Hall da fama (desde sempre)
            {!incluirFeira || !incluirPedidos ? (
              <span className="font-normal opacity-60"> — {incluirFeira ? 'só Feira' : 'só Pedidos'}</span>
            ) : null}
          </h2>
          <div className="flex flex-wrap gap-2">
            {rankingAllTime.slice(0, 5).map((r, i) => (
              <span
                key={r.id}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
                style={{
                  background: 'var(--color-surface-sunk)',
                  color: 'var(--color-text)',
                }}
              >
                {r.emoji} {r.short ?? r.label}
                <span className="opacity-45">×{r.qty}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Vendas do mês */}
      <div className="bfy-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="bfy-eyebrow">
            Vendas do mês
          </h2>
          <div className="bfy-segment" role="tablist">
            {[
              { id: 'avulsas', label: `Diretas (${diretasDoMes.length})` },
              { id: 'pos', label: `POS (${posMes.length})` },
            ].map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tabVendas === t.id}
                onClick={() => setTabVendas(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {tabVendas === 'avulsas' && (
          <>
            {diretasDoMes.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm ink-3">
                  Nenhuma venda direta neste mês.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {diretasDoMes.map((p) => {
                  const c = clientes.find((x) => x.id === p.clienteId)
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-3"
                      style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
                    >
                      <div className="flex-1 min-w-0">
                        {c && (
                          <span className="text-xs font-bold" style={{ color: 'var(--color-accent-dark)' }}>
                            {c.nome}
                          </span>
                        )}
                        <div className="flex gap-3 mt-0.5 text-xs flex-wrap ink-3">
                          <span>{fmtDate(p.criadoEm)}</span>
                          <span>{p.formaPagamento}</span>
                          {p.notas && <span className="truncate max-w-xs">{p.notas}</span>}
                        </div>
                      </div>
                      <span className="text-base font-black tabular-nums shrink-0" style={{ color: 'var(--color-accent-dark)' }}>
                        {fmtEuro(p.totalEur)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {tabVendas === 'pos' && (
          <>
            {posMes.length === 0 ? (
              <p className="text-sm text-center py-8 ink-3">
                Nenhuma venda POS neste mês.
              </p>
            ) : (
              <div className="space-y-1.5">
                {posMesVisivel.map((s) => (
                  <PosSaleRow key={s.id} sale={s} catalog={catalog} />
                ))}
                {posRestantes > 0 && (
                  <button
                    type="button"
                    className="btn-ghost w-full text-xs py-2.5 mt-1"
                    onClick={() => setPosVisiveis((n) => Math.min(n + POS_INICIAL, posMes.length))}
                  >
                    Ver mais ({posRestantes} restantes)
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Por evento / feira */}
      <div className="bfy-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="ink-3">
            <IconCalendar />
          </div>
          <h2 className="bfy-eyebrow">
            Por evento / feira
          </h2>
        </div>

        {porEvento.length === 0 ? (
          <p className="text-sm text-center py-6 ink-3">
            Nenhum evento cadastrado.
          </p>
        ) : (
          <div className="space-y-2">
            {porEvento.map((ev) => (
              <button
                key={ev.id}
                type="button"
                onClick={() => setHistoricoEvent(ev)}
                className="w-full flex items-center gap-4 rounded-xl px-4 py-3 text-left transition-all hover:bg-black/[0.02]"
                style={{ background: 'var(--color-surface-sunk)', border: '1px solid var(--line-1)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                    {ev.nome}
                    {ev.virtual ? (
                      <span className="font-semibold opacity-45 text-xs ml-1.5">· sem evento cadastrado</span>
                    ) : null}
                  </p>
                  <p className="text-xs ink-3">
                    {ev.dateLabel}
                    {ev.local ? ` · ${ev.local}` : ''}
                    {ev.stats?.dayBreakdown?.length > 1 ? ` · ${ev.stats.dayBreakdown.length} dias` : ''}
                    {ev.cookies > 0 ? ` · ${ev.cookies} cookies` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-base tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(ev.receita)}
                  </p>
                  <p className="text-xs ink-3">
                    {ev.vendas} venda{ev.vendas !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {historicoEvent && (
        <Modal title={historicoEvent.nome} onClose={() => setHistoricoEvent(null)} size="lg">
          <FeiraHistoricoPanel evento={historicoEvent} sales={salesPos} catalog={catalog} />
        </Modal>
      )}
    </div>
  )
}
