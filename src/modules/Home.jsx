import { useMemo } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { useReceitas } from '../stores/useReceitas'
import { useEstoque } from '../stores/useEstoque'
import { useEventos } from '../stores/useEventos'
import { useVendas } from '../stores/useVendas'
import { usePedidosVendas } from '../stores/usePedidosVendas'
import { useFinanceiro } from '../stores/useFinanceiro'
import { useCookies } from '../stores/useCookies'
import { BarChart } from '../components/BarChart'
import { Icon } from '../components/Icon'

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

const fmtEur = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

/** Mês a que uma venda do POS pertence */
const mesVenda = (s) => (s.createdAt ?? '').slice(0, 7)
/** Mês a que um pedido pertence (data escolhida ou, em falta, a de criação) */
const mesPedido = (p) => (p.dataPedido ?? p.criadoEm ?? '').slice(0, 7)
/** Mês a que uma despesa pertence */
const mesDespesa = (d) => d.mesRef || (d.data ?? '').slice(0, 7)

/** Dia civil local (YYYY-MM-DD) — evita o desalinhamento de fuso do toISOString */
function diaLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + dd
}

/** "Hoje" / "Amanhã" / "seg, 25 ago" */
function rotuloDia(dia) {
  const hoje = diaLocal()
  const amanha = diaLocal(new Date(Date.now() + 86400000))
  if (dia === hoje) return 'Hoje'
  if (dia === amanha) return 'Amanhã'
  return new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short', day: '2-digit', month: 'short',
  })
}

export function Home({ onNavigate }) {
  const { config } = useConfiguracoes()
  const { receitas } = useReceitas()
  const { ingredientes, statusIngrediente } = useEstoque()
  const { proximaFeira } = useEventos()
  const { sales } = useVendas()
  const { pedidos } = usePedidosVendas()
  const { despesas } = useFinanceiro()
  const { cookies } = useCookies()

  const now = new Date()
  const hojeKey = diaLocal(now)
  const thisMonth = monthKey(now)

  // ── Números do mês (feiras + encomendas − saídas) ─────────────────────────
  const receitaFeiras = useMemo(
    () => sales
      .filter((s) => mesVenda(s) === thisMonth && (s.totalEur ?? 0) > 0)
      .reduce((sum, s) => sum + (s.totalEur ?? 0), 0),
    [sales, thisMonth],
  )

  const receitaPedidos = useMemo(
    () => pedidos
      .filter((p) => mesPedido(p) === thisMonth && p.status !== 'cancelado')
      .reduce((sum, p) => sum + (p.totalEur ?? 0), 0),
    [pedidos, thisMonth],
  )

  const saidasMes = useMemo(
    () => despesas
      .filter((d) => mesDespesa(d) === thisMonth)
      .reduce((sum, d) => sum + (d.valorEur ?? 0), 0),
    [despesas, thisMonth],
  )

  const receitaTotal = receitaFeiras + receitaPedidos
  const lucro = receitaTotal - saidasMes
  const metaLucro = config.metaLucroMensal ?? 0
  const progressoMeta = metaLucro > 0 ? Math.max(0, Math.min(100, (lucro / metaLucro) * 100)) : null

  // ── Alertas ────────────────────────────────────────────────────────────────
  const proxFeira = proximaFeira()
  const diasParaFeira = proxFeira
    ? Math.ceil((new Date(proxFeira.data + 'T12:00:00') - now) / 86400000)
    : null
  const baixoEstoque = ingredientes.filter((i) => statusIngrediente(i) !== 'ok')
  const criticos = baixoEstoque.filter((i) => statusIngrediente(i) === 'critico')

  // ── Agenda de encomendas ───────────────────────────────────────────────────
  // Ordenada pela DATA DE ENTREGA (não pela de registo) e agrupada por dia,
  // para responder de relance a "o que tenho de fazer para amanhã?".
  const { agenda, agendaAtrasados } = useMemo(() => {
    const nomeSabor = (id, fallback) =>
      cookies.find((c) => c.id === id)?.short ?? fallback ?? id

    /** Unidades a produzir num pedido: linhas avulsas + conteúdo da BOX */
    function contar(p) {
      const porSabor = {}
      let total = 0
      const somar = (nome, q) => { porSabor[nome] = (porSabor[nome] ?? 0) + q; total += q }

      for (const l of p.linhas ?? []) {
        const q = l.qty ?? 0
        if (q > 0) somar(l.customLabel ?? nomeSabor(l.cookieId), q)
      }
      for (const [cookieId, q] of Object.entries(p.box?.counts ?? {})) {
        if (q > 0) somar(nomeSabor(cookieId), q)
      }
      const temBox = Object.values(p.box?.counts ?? {}).some((q) => q > 0)
      return { total, porSabor, temBox }
    }

    const porEntregar = pedidos.filter(
      (p) => p.status !== 'entregue' && p.status !== 'cancelado',
    )
    const dias = new Map()
    const atrasados = []

    for (const p of porEntregar) {
      const dia = p.dataPedido ?? String(p.criadoEm ?? '').slice(0, 10)
      if (!dia) continue
      if (dia < hojeKey) { atrasados.push(p); continue }
      if (!dias.has(dia)) dias.set(dia, [])
      dias.get(dia).push(p)
    }

    const lista = [...dias.entries()]
      .sort(([a], [b]) => a.localeCompare(b))   // mais próximo primeiro
      .slice(0, 4)
      .map(([data, ps]) => {
        const porSabor = {}
        let totalCookies = 0
        let totalBoxes = 0
        let valor = 0
        for (const p of ps) {
          const c = contar(p)
          totalCookies += c.total
          if (c.temBox) totalBoxes += 1
          valor += p.totalEur ?? 0
          for (const [nome, q] of Object.entries(c.porSabor)) {
            porSabor[nome] = (porSabor[nome] ?? 0) + q
          }
        }
        return {
          data,
          rotulo: rotuloDia(data),
          pedidos: ps,
          totalCookies,
          totalBoxes,
          valor,
          porSabor: Object.entries(porSabor)
            .map(([nome, qty]) => ({ nome, qty }))
            .sort((a, b) => b.qty - a.qty),
        }
      })

    return { agenda: lista, agendaAtrasados: atrasados }
  }, [pedidos, cookies, hojeKey])

  // ── Gráfico: 6 meses, feiras + encomendas ─────────────────────────────────
  const chartData = useMemo(
    () => Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
      const key = monthKey(d)
      const feirasMes = sales
        .filter((s) => mesVenda(s) === key && (s.totalEur ?? 0) > 0)
        .reduce((sum, s) => sum + (s.totalEur ?? 0), 0)
      const encomendasMes = pedidos
        .filter((p) => mesPedido(p) === key && p.status !== 'cancelado')
        .reduce((sum, p) => sum + (p.totalEur ?? 0), 0)
      return { label: d.toLocaleString('pt-BR', { month: 'short' }), value: feirasMes + encomendasMes }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sales, pedidos, thisMonth],
  )

  const dateStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  const kpis = [
    { label: 'Entrou este mês',  value: fmtEur(receitaTotal), sub: `${fmtEur(receitaFeiras)} feiras · ${fmtEur(receitaPedidos)} encomendas` },
    { label: 'Saiu este mês',    value: fmtEur(saidasMes),    sub: saidasMes === 0 ? 'nenhuma saída registada' : 'ingredientes, taxas e custos fixos' },
    { label: 'Resultado',        value: fmtEur(lucro),        sub: 'entradas menos saídas', destaque: true, negativo: lucro < 0 },
    { label: 'Receitas',         value: receitas.length,      sub: receitas.length === 0 ? 'nenhuma ainda' : 'no livro de receitas' },
  ]

  return (
    <div className="bfy-page">

      {/* ── Saudação ── */}
      <div className="mb-5">
        <h1 className="bfy-page-title">
          Olá, {config.nomeProprietaria}
        </h1>
        <p className="ink-3 capitalize mt-1" style={{ fontSize: 'var(--text-md)' }}>{dateStr}</p>
      </div>

      {/* ── Alertas ── */}
      {(baixoEstoque.length > 0 || (diasParaFeira !== null && diasParaFeira <= 7)) && (
        <div className="mb-5 space-y-2">
          {baixoEstoque.length > 0 && (
            <button
              onClick={() => onNavigate('estoque')}
              className="w-full flex items-start gap-3 rounded-2xl p-3.5 text-left transition-colors"
              style={{
                background: criticos.length ? 'var(--color-danger-soft)' : 'var(--color-warning-soft)',
                border: `1px solid ${criticos.length ? 'rgba(179,64,47,0.28)' : 'rgba(181,122,33,0.28)'}`,
              }}
            >
              <span style={{ color: criticos.length ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                <Icon name="alerta" size={19} />
              </span>
              <span className="flex-1 min-w-0" style={{ fontSize: 'var(--text-md)' }}>
                <strong style={{ color: criticos.length ? '#8C3123' : '#7A5214' }}>
                  {baixoEstoque.length === 1
                    ? `${baixoEstoque[0].nome} está abaixo do mínimo`
                    : `${baixoEstoque.length} ingredientes abaixo do mínimo`}
                </strong>
                <span className="block ink-3" style={{ fontSize: 'var(--text-sm)' }}>Ver estoque</span>
              </span>
              <span className="ink-4 mt-0.5"><Icon name="avancar" size={16} /></span>
            </button>
          )}

          {diasParaFeira !== null && diasParaFeira <= 7 && (
            <button
              onClick={() => onNavigate('producao')}
              className="w-full flex items-start gap-3 rounded-2xl p-3.5 text-left transition-colors"
              style={{ background: 'var(--color-accent-soft)', border: '1px solid rgba(154,59,28,0.22)' }}
            >
              <span style={{ color: 'var(--color-accent-dark)' }}><Icon name="calendario" size={19} /></span>
              <span className="flex-1 min-w-0" style={{ fontSize: 'var(--text-md)' }}>
                <strong style={{ color: 'var(--color-accent-dark)' }}>
                  {proxFeira?.nome ?? 'Próxima feira'}{' '}
                  {diasParaFeira > 0 ? `em ${diasParaFeira} dia${diasParaFeira > 1 ? 's' : ''}` : 'é hoje'}
                </strong>
                <span className="block ink-3" style={{ fontSize: 'var(--text-sm)' }}>Planear a produção</span>
              </span>
              <span className="ink-4 mt-0.5"><Icon name="avancar" size={16} /></span>
            </button>
          )}
        </div>
      )}

      {/* ── Agenda de encomendas: o que há para fazer, por dia de entrega ── */}
      {(agendaAtrasados.length > 0 || agenda.length > 0) && (
        <div className="bfy-card p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="bfy-eyebrow">Encomendas por entregar</h2>
            <button className="btn-ghost btn-sm" onClick={() => onNavigate('vendas')}>
              Ver todas <Icon name="avancar" size={14} />
            </button>
          </div>

          {agendaAtrasados.length > 0 && (
            <button
              onClick={() => onNavigate('vendas')}
              className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left"
              style={{ background: 'var(--color-danger-soft)', border: '1px solid rgba(179,64,47,0.28)' }}
            >
              <span style={{ color: 'var(--color-danger)' }}><Icon name="alerta" size={17} /></span>
              <span style={{ fontSize: 'var(--text-sm)', color: '#8C3123' }}>
                <strong>{agendaAtrasados.length} encomenda{agendaAtrasados.length > 1 ? 's' : ''} com data já passada</strong>
              </span>
            </button>
          )}

          {agenda.map((dia) => (
            <div key={dia.data} className="bfy-sunk p-3">
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="font-bold ink-1" style={{ fontSize: 'var(--text-md)' }}>
                  {dia.rotulo}
                  <span className="ink-3 font-normal"> · {dia.pedidos.length} encomenda{dia.pedidos.length > 1 ? 's' : ''}</span>
                </span>
                <span className="bfy-num font-bold shrink-0" style={{ color: 'var(--color-accent-dark)', fontSize: 'var(--text-md)' }}>
                  {fmtEur(dia.valor)}
                </span>
              </div>

              {/* O número que interessa: quanto há para produzir */}
              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="bfy-chip bfy-chip-accent">
                  <Icon name="cookie" size={13} /> {dia.totalCookies} cookie{dia.totalCookies !== 1 ? 's' : ''}
                </span>
                {dia.totalBoxes > 0 && (
                  <span className="bfy-chip">
                    <Icon name="caixa" size={13} /> {dia.totalBoxes} box
                  </span>
                )}
              </div>

              {/* Repartição por sabor, para saber exatamente o que fazer */}
              {dia.porSabor.length > 0 && (
                <p className="ink-2" style={{ fontSize: 'var(--text-xs)', lineHeight: 1.5 }}>
                  {dia.porSabor.map((s) => `${s.qty}× ${s.nome}`).join(' · ')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bfy-card p-4">
            <div className="bfy-eyebrow mb-1.5">{kpi.label}</div>
            <div
              className="bfy-title bfy-num"
              style={{
                fontSize: 'var(--text-xl)',
                color: kpi.negativo
                  ? 'var(--color-danger)'
                  : kpi.destaque ? 'var(--color-success)' : 'var(--ink-1)',
              }}
            >
              {kpi.value}
            </div>
            <div className="ink-4 mt-1" style={{ fontSize: 'var(--text-2xs)', lineHeight: 1.35 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Meta ── */}
      {progressoMeta !== null && (
        <div className="bfy-card p-4 mb-5">
          <div className="flex items-baseline justify-between mb-2 gap-3">
            <span className="bfy-eyebrow">Meta de lucro do mês</span>
            <span className="bfy-num ink-2" style={{ fontSize: 'var(--text-sm)' }}>
              {fmtEur(lucro)} <span className="ink-4">de {fmtEur(metaLucro)}</span>
            </span>
          </div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-sunk)' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressoMeta}%`,
                background: progressoMeta >= 100 ? 'var(--color-success)' : 'var(--color-accent)',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Gráfico + próxima feira ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="bfy-card p-5">
          <h2 className="bfy-eyebrow mb-4">Entradas — últimos 6 meses</h2>
          <BarChart data={chartData} />
        </div>

        <div className="bfy-card p-5">
          <h2 className="bfy-eyebrow mb-4">Próxima feira</h2>
          {proxFeira ? (
            <div>
              <p className="bfy-title" style={{ fontSize: 'var(--text-xl)', color: 'var(--color-accent-dark)' }}>
                {proxFeira.nome}
              </p>
              <div className="mt-2 space-y-1.5">
                {proxFeira.local && (
                  <p className="ink-2 flex items-center gap-2" style={{ fontSize: 'var(--text-sm)' }}>
                    <span className="ink-4"><Icon name="etiqueta" size={15} /></span>
                    {proxFeira.local}
                  </p>
                )}
                <p className="ink-2 flex items-center gap-2" style={{ fontSize: 'var(--text-sm)' }}>
                  <span className="ink-4"><Icon name="calendario" size={15} /></span>
                  {new Date(proxFeira.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </p>
              </div>
              {diasParaFeira !== null && (
                <span
                  className="bfy-chip mt-3"
                  style={
                    diasParaFeira <= 3
                      ? { background: 'var(--color-accent-soft)', color: 'var(--color-accent-dark)', borderColor: 'rgba(154,59,28,0.22)' }
                      : undefined
                  }
                >
                  {diasParaFeira > 0 ? `Em ${diasParaFeira} dia${diasParaFeira > 1 ? 's' : ''}` : 'É hoje'}
                </span>
              )}
            </div>
          ) : (
            <div className="bfy-empty" style={{ padding: '1.5rem 0' }}>
              <Icon name="calendario" size={30} />
              <p style={{ fontSize: 'var(--text-md)' }}>Nenhuma feira planeada</p>
              <button className="btn-ghost btn-sm" onClick={() => onNavigate('config')}>
                <Icon name="mais" size={15} /> Cadastrar evento
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Destaque: calcular produção ── */}
      <button
        onClick={() => onNavigate('producao')}
        className="w-full text-left border-none cursor-pointer transition-transform active:scale-[0.99] mb-5 relative overflow-hidden"
        style={{ background: 'var(--color-primary)', borderRadius: 'var(--radius-card)', minHeight: 150, padding: '1.35rem 1.5rem' }}
      >
        <div className="relative z-10" style={{ maxWidth: '60%' }}>
          <p className="bfy-eyebrow" style={{ color: 'var(--color-accent)' }}>Gestão da produção</p>
          <h2 className="bfy-title mt-2" style={{ fontSize: 'var(--text-2xl)', color: 'var(--ink-on-dark)' }}>
            Calcular produção
          </h2>
          <p className="mt-1.5" style={{ fontSize: 'var(--text-sm)', color: 'var(--ink-on-dark-2)' }}>
            Escolhe as receitas e vê o que precisas de comprar
          </p>
          <span
            className="inline-flex items-center gap-2 font-bold px-4 py-2 mt-4"
            style={{ background: 'var(--color-accent)', color: '#fff', borderRadius: 'var(--radius-btn)', fontSize: 'var(--text-sm)' }}
          >
            Calcular agora <Icon name="avancar" size={15} />
          </span>
        </div>
        <img
          src="/mascote-cramb.png"
          alt=""
          className="absolute bottom-0 right-2 pointer-events-none select-none"
          style={{ height: '88%', maxHeight: 158, objectFit: 'contain' }}
        />
      </button>

    </div>
  )
}
