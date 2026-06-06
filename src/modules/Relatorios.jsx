import { useEffect, useMemo, useState } from 'react'
import { useEventos } from '../stores/useEventos'
import { usePedidosVendas } from '../stores/usePedidosVendas'
import { useClientes } from '../stores/useClientes'
import { BarChart } from '../components/BarChart'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readFeirasPos() {
  try {
    const raw = localStorage.getItem('cookies-sales:v1')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v)

const fmtDate = (iso) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })


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

function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  )
}

function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
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

// ─── Componente principal ─────────────────────────────────────────────────────

const POS_INICIAL = 20

export function Relatorios() {
  const { eventos } = useEventos()
  const { pedidos: pedidosVendas } = usePedidosVendas()
  const { clientes } = useClientes()
  const salesPos = readFeirasPos()

  const now = new Date()
  const [mesSelecionado, setMesSelecionado] = useState(monthKey(now))
  const [tabVendas, setTabVendas] = useState('avulsas') // 'avulsas' | 'pos'
  const [posVisiveis, setPosVisiveis] = useState(POS_INICIAL)

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

  // Receita mensal combinada (POS + pedidos diretos) por mês — para o gráfico
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

  // Stats do mês selecionado
  const statsMes = useMemo(() => {
    const posVendas = salesPos.filter(
      (s) => (s.createdAt ?? '').startsWith(mesSelecionado) && (s.totalEur ?? 0) > 0,
    )
    const posReceita = posVendas.reduce((sum, s) => sum + (s.totalEur ?? 0), 0)
    const demos = salesPos.filter(
      (s) => (s.createdAt ?? '').startsWith(mesSelecionado) && s.kind === 'demo',
    ).length
    const diretasMes = pedidosVendas.filter((p) => p.criadoEm.startsWith(mesSelecionado) && p.status !== 'cancelado')
    const diretaReceita = diretasMes.reduce((sum, p) => sum + p.totalEur, 0)
    return {
      totalReceita: posReceita + diretaReceita,
      posVendas: posVendas.length,
      diretasVendas: diretasMes.length,
      demos,
    }
  }, [salesPos, pedidosVendas, mesSelecionado])

  // Pedidos diretos do mês
  const diretasDoMes = useMemo(
    () => pedidosVendas.filter((p) => p.criadoEm.startsWith(mesSelecionado) && p.status !== 'cancelado'),
    [pedidosVendas, mesSelecionado],
  )

  // Últimas vendas POS do mês
  const posMes = useMemo(
    () => salesPos.filter((s) => (s.createdAt ?? '').startsWith(mesSelecionado) && (s.totalEur ?? 0) > 0),
    [salesPos, mesSelecionado],
  )

  const posMesVisivel = useMemo(
    () => posMes.slice(0, posVisiveis),
    [posMes, posVisiveis],
  )

  const posRestantes = Math.max(0, posMes.length - posVisiveis)

  const porEvento = useMemo(() => {
    return eventos.map((ev) => {
      if (!ev.data) return { ...ev, receita: 0, vendas: 0 }
      const dia = ev.data
      const posDay    = salesPos.filter((s) => (s.createdAt ?? '').startsWith(dia) && (s.totalEur ?? 0) > 0)
      const diretaDay = pedidosVendas.filter((p) => p.criadoEm.startsWith(dia) && p.status !== 'cancelado')
      return {
        ...ev,
        receita: posDay.reduce((s, x) => s + (x.totalEur ?? 0), 0) + diretaDay.reduce((s, p) => s + p.totalEur, 0),
        vendas: posDay.length + diretaDay.length,
      }
    })
  }, [eventos, salesPos, pedidosVendas])

  function exportarResumo() {
    const mesObj = meses.find((m) => m.key === mesSelecionado)
    const lines = [
      `Relatório Crumb Lab`,
      `Mês: ${mesObj?.label ?? mesSelecionado}`,
      `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
      '',
      `Receita total: ${fmtEuro(statsMes.totalReceita)}`,
      `Vendas POS (feiras): ${statsMes.posVendas}`,
      `Vendas diretas: ${statsMes.diretasVendas}`,
      `Demos registradas: ${statsMes.demos}`,
      '',
      'Vendas diretas:',
      ...diretasDoMes.map((p) => {
        const c = clientes.find((x) => x.id === p.clienteId)
        return `  ${fmtDate(p.criadoEm)} | ${c?.nome ?? '—'} | ${p.totalEur.toFixed(2)}€ | ${p.formaPagamento} | ${p.status}`
      }),
    ]
    navigator.clipboard?.writeText(lines.join('\n'))
    alert('Resumo copiado!')
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-10 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-black"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
          >
            Relatórios
          </h1>
          <p className="text-sm mt-1 opacity-55" style={{ color: 'var(--color-text)' }}>
            Feiras + vendas diretas combinadas
          </p>
        </div>
        <button className="btn-ghost text-xs px-4 py-2" onClick={exportarResumo}>
          Exportar
        </button>
      </div>

      {/* Gráfico */}
      <div className="bfy-card p-5">
        <h2
          className="text-xs font-bold uppercase tracking-widest mb-4 opacity-55"
          style={{ color: 'var(--color-text)' }}
        >
          Receita total — últimos 6 meses (€)
        </h2>
        <BarChart data={chartData} height={110} />
      </div>

      {/* Seletor de mês */}
      <div className="bfy-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest opacity-55" style={{ color: 'var(--color-text)' }}>
            Relatório Mensal
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {meses.map((m) => (
            <button
              key={m.key}
              onClick={() => setMesSelecionado(m.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: mesSelecionado === m.key ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.07)',
                color: mesSelecionado === m.key ? '#fff' : 'var(--color-text)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            {
              icon: <IconEuro />,
              value: fmtEuro(statsMes.totalReceita),
              label: 'Receita total',
              accent: true,
            },
            {
              icon: <IconTrend />,
              value: statsMes.posVendas,
              label: 'Vendas (POS)',
            },
            {
              icon: <IconReceipt />,
              value: statsMes.diretasVendas,
              label: 'Vendas diretas',
            },
            {
              icon: <IconStar />,
              value: statsMes.demos,
              label: 'Demos',
            },
          ].map((k, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 flex flex-col gap-2"
              style={{
                background: k.accent ? 'rgba(154,59,28,0.07)' : 'rgba(29,16,8,0.04)',
                border: `1px solid ${k.accent ? 'rgba(154,59,28,0.18)' : 'rgba(29,16,8,0.07)'}`,
              }}
            >
              <div style={{ color: k.accent ? 'var(--color-accent-dark)' : 'rgba(29,16,8,0.4)' }}>
                {k.icon}
              </div>
              <div
                className="text-xl font-black tabular-nums leading-none"
                style={{ fontFamily: 'var(--font-title)', color: k.accent ? 'var(--color-accent-dark)' : 'var(--color-text)' }}
              >
                {k.value}
              </div>
              <div className="text-xs opacity-50 leading-tight" style={{ color: 'var(--color-text)' }}>
                {k.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vendas do mês */}
      <div className="bfy-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold uppercase tracking-widest opacity-55" style={{ color: 'var(--color-text)' }}>
            Vendas do mês
          </h2>
          {/* Tabs */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: '1.5px solid rgba(29,16,8,0.12)' }}>
            {[
              { id: 'avulsas', label: `Diretas (${diretasDoMes.length})` },
              { id: 'pos', label: `POS (${posMes.length})` },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTabVendas(t.id)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: tabVendas === t.id ? 'var(--color-accent-dark)' : 'transparent',
                  color: tabVendas === t.id ? '#fff' : 'var(--color-text)',
                }}
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
                <div className="flex justify-center mb-3 opacity-20" style={{ color: 'var(--color-text)' }}>
                  <IconReceipt />
                </div>
                <p className="text-sm opacity-45" style={{ color: 'var(--color-text)' }}>
                  Nenhuma venda direta neste mês.
                </p>
                <p className="text-xs opacity-35 mt-2" style={{ color: 'var(--color-text)' }}>
                  Regista pedidos diretos em Vendas
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
                      style={{ background: 'rgba(29,16,8,0.04)', border: '1px solid rgba(29,16,8,0.07)' }}
                    >
                      <div className="opacity-30 shrink-0" style={{ color: 'var(--color-text)' }}>
                        <IconReceipt />
                      </div>
                      <div className="flex-1 min-w-0">
                        {c && (
                          <span className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--color-accent-dark)' }}>
                            <IconUser /> {c.nome}
                          </span>
                        )}
                        <div className="flex gap-3 mt-0.5 text-xs opacity-45 flex-wrap" style={{ color: 'var(--color-text)' }}>
                          <span>{fmtDate(p.criadoEm)}</span>
                          <span>{p.formaPagamento}</span>
                          <span>{p.status}</span>
                          {p.notas && <span className="truncate max-w-xs">{p.notas}</span>}
                        </div>
                      </div>
                      <span className="text-base font-black tabular-nums shrink-0" style={{ color: 'var(--color-accent-dark)' }}>
                        {fmtEuro(p.totalEur)}
                      </span>
                    </div>
                  )
                })}
                <div
                  className="flex justify-between items-center rounded-xl px-3 py-2 mt-1"
                  style={{ background: 'rgba(154,59,28,0.07)', border: '1px solid rgba(154,59,28,0.15)' }}
                >
                  <span className="text-xs font-bold opacity-60" style={{ color: 'var(--color-text)' }}>Total diretas</span>
                  <span className="font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(diretasDoMes.reduce((s, p) => s + p.totalEur, 0))}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {tabVendas === 'pos' && (
          <>
            {posMes.length === 0 ? (
              <p className="text-sm text-center py-8 opacity-40" style={{ color: 'var(--color-text)' }}>
                Nenhuma venda POS registrada neste mês.
              </p>
            ) : (
              <div className="space-y-1.5">
                {posMesVisivel.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 rounded-xl px-3 py-2"
                    style={{ background: 'rgba(29,16,8,0.04)', border: '1px solid rgba(29,16,8,0.06)' }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                        {s.kind === 'box' ? '📦 BOX' : s.kind === 'order' ? '🛍 Avulso' : s.kind}
                      </p>
                      <p className="text-[10px] opacity-40" style={{ color: 'var(--color-text)' }}>
                        {fmtDate(s.createdAt)} · {fmtTime(s.createdAt)}
                      </p>
                    </div>
                    <span className="text-sm font-black tabular-nums shrink-0" style={{ color: 'var(--color-accent-dark)' }}>
                      {fmtEuro(s.totalEur ?? 0)}
                    </span>
                  </div>
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
                {posVisiveis > POS_INICIAL && posRestantes === 0 && (
                  <button
                    type="button"
                    className="btn-ghost w-full text-xs py-2.5 mt-1 opacity-60"
                    onClick={() => setPosVisiveis(POS_INICIAL)}
                  >
                    Ver menos
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Por evento */}
      <div className="bfy-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <div className="opacity-45" style={{ color: 'var(--color-text)' }}>
            <IconCalendar />
          </div>
          <h2 className="text-xs font-bold uppercase tracking-widest opacity-55" style={{ color: 'var(--color-text)' }}>
            Por Evento / Feira
          </h2>
        </div>

        {porEvento.length === 0 ? (
          <p className="text-sm text-center py-6 opacity-40" style={{ color: 'var(--color-text)' }}>
            Nenhum evento cadastrado. Adicione em Configurações.
          </p>
        ) : (
          <div className="space-y-2">
            {porEvento.map((ev) => (
              <div
                key={ev.id}
                className="flex items-center gap-4 rounded-xl px-4 py-3"
                style={{ background: 'rgba(29,16,8,0.04)', border: '1px solid rgba(29,16,8,0.07)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                    {ev.nome}
                  </p>
                  <p className="text-xs opacity-50" style={{ color: 'var(--color-text)' }}>
                    {ev.data
                      ? new Date(ev.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                        })
                      : '—'}
                    {ev.local ? ` · ${ev.local}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-black text-base tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                    {fmtEuro(ev.receita)}
                  </p>
                  <p className="text-xs opacity-50" style={{ color: 'var(--color-text)' }}>
                    {ev.vendas} venda{ev.vendas !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
