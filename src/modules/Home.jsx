import { useMemo } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'
import { useReceitas } from '../stores/useReceitas'
import { useEstoque } from '../stores/useEstoque'
import { useEventos } from '../stores/useEventos'
import { BarChart } from '../components/BarChart'

function readFeiras() {
  try {
    const raw = localStorage.getItem('cookies-sales:v1')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function fmtCurrency(v, symbol = '€') {
  return `${symbol} ${v.toFixed(2).replace('.', ',')}`
}

export function Home({ onNavigate }) {
  const { config } = useConfiguracoes()
  const { receitas } = useReceitas()
  const { ingredientes, statusIngrediente } = useEstoque()
  const { eventos, proximaFeira } = useEventos()
  const feiras = readFeiras()
  const now = new Date()
  const thisMonth = monthKey(now)

  const receitaMes = useMemo(
    () =>
      feiras
        .filter((s) => (s.createdAt ?? '').startsWith(thisMonth) && (s.totalEur ?? 0) > 0)
        .reduce((sum, s) => sum + (s.totalEur ?? 0), 0),
    [feiras, thisMonth],
  )

  const proxFeira = proximaFeira()
  const diasParaFeira = proxFeira
    ? Math.ceil((new Date(proxFeira.data + 'T12:00:00') - now) / 86400000)
    : null

  const baixoEstoque = ingredientes.filter((i) => statusIngrediente(i) !== 'ok')

  const chartData = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
        const key = monthKey(d)
        const label = d.toLocaleString('pt-BR', { month: 'short' })
        const value = feiras
          .filter((s) => (s.createdAt ?? '').startsWith(key) && (s.totalEur ?? 0) > 0)
          .reduce((sum, s) => sum + (s.totalEur ?? 0), 0)
        return { label, value }
      }),
    [feiras],
  )

  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const kpis = [
    {
      label: 'Receita Feiras (mês)',
      value: fmtCurrency(receitaMes),
      icon: '💶',
      sub: `acumulado de ${now.toLocaleString('pt-BR', { month: 'long' })}`,
    },
    {
      label: 'Lucro Líquido (mês)',
      value: fmtCurrency(receitaMes),
      icon: '📈',
      sub: 'custo ainda não cadastrado',
    },
    {
      label: 'Custo de Produção',
      value: `€ 0,00`,
      icon: '🧾',
      sub: 'cadastre ingredientes',
    },
    {
      label: 'Receitas Cadastradas',
      value: receitas.length,
      icon: '📚',
      sub: receitas.length === 0 ? 'nenhuma ainda' : `${receitas.length} receita${receitas.length > 1 ? 's' : ''}`,
    },
  ]

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-8">
      {/* Header / Saudação */}
      <div className="mb-5">
        <h1
          className="text-3xl font-black leading-tight"
          style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text)' }}
        >
          Olá, {config.nomeProprietaria}! 🍪
        </h1>
        <p
          className="text-sm mt-1 capitalize"
          style={{ color: 'var(--color-text)', opacity: 0.55 }}
        >
          {dateStr}
        </p>
      </div>

      {/* Alertas inteligentes */}
      {(baixoEstoque.length > 0 || (diasParaFeira !== null && diasParaFeira <= 7)) && (
        <div
          className="mb-5 rounded-2xl p-4 space-y-1.5"
          style={{ background: 'var(--color-warning)', borderRadius: '16px' }}
        >
          {baixoEstoque.length > 0 && (
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              ⚠️{' '}
              {baixoEstoque.length === 1
                ? `"${baixoEstoque[0].nome}" está abaixo do estoque mínimo`
                : `${baixoEstoque.length} ingredientes abaixo do estoque mínimo`}
            </p>
          )}
          {diasParaFeira !== null && diasParaFeira <= 7 && (
            <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
              📅 Próxima feira{proxFeira?.nome ? ` "${proxFeira.nome}"` : ''} em{' '}
              {diasParaFeira > 0 ? `${diasParaFeira} dia${diasParaFeira > 1 ? 's' : ''}` : 'hoje'} —
              produção planejada?
            </p>
          )}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {kpis.map((kpi, i) => (
          <div
            key={i}
            className="bfy-card p-4"
          >
            <div className="text-2xl mb-2">{kpi.icon}</div>
            <div
              className="text-[11px] font-semibold mb-1 leading-tight"
              style={{ color: 'var(--color-text)', opacity: 0.55 }}
            >
              {kpi.label}
            </div>
            <div
              className="text-xl font-black leading-none"
              style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
            >
              {kpi.value}
            </div>
            <div className="text-[10px] mt-1" style={{ color: 'var(--color-text)', opacity: 0.45 }}>
              {kpi.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Gráfico + Próxima Feira */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="bfy-card p-5">
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text)', opacity: 0.55 }}
          >
            Receita Feiras — últimos 6 meses (€)
          </h3>
          <BarChart data={chartData} />
        </div>

        <div className="bfy-card p-5">
          <h3
            className="text-xs font-bold uppercase tracking-wider mb-4"
            style={{ color: 'var(--color-text)', opacity: 0.55 }}
          >
            Próxima Feira
          </h3>
          {proxFeira ? (
            <div>
              <p
                className="text-xl font-black mb-1 leading-tight"
                style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
              >
                {proxFeira.nome}
              </p>
              {proxFeira.local && (
                <p className="text-sm mb-1" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                  📍 {proxFeira.local}
                </p>
              )}
              <p className="text-sm mb-3" style={{ color: 'var(--color-text)', opacity: 0.7 }}>
                📅{' '}
                {new Date(proxFeira.data + 'T12:00:00').toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                {diasParaFeira !== null && (
                  <span
                    className="px-3 py-1 rounded-xl text-sm font-bold"
                    style={{
                      background: diasParaFeira <= 3 ? 'var(--color-accent)' : 'var(--color-success)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {diasParaFeira > 0
                      ? `⏳ Em ${diasParaFeira} dia${diasParaFeira > 1 ? 's' : ''}`
                      : '🎉 Hoje!'}
                  </span>
                )}
                <span
                  className="px-2 py-1 rounded-lg text-xs font-semibold"
                  style={{ background: 'rgba(61,43,31,0.08)', color: 'var(--color-text)' }}
                >
                  {proxFeira.status === 'planejada'
                    ? 'Planejada'
                    : proxFeira.status === 'em_andamento'
                    ? 'Em andamento'
                    : 'Concluída'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <span className="text-5xl mb-3">🗓️</span>
              <p className="text-sm font-semibold" style={{ color: 'var(--color-text)', opacity: 0.5 }}>
                Nenhuma feira planejada
              </p>
              <button
                className="btn-ghost mt-3 text-xs px-4 py-1.5"
                onClick={() => onNavigate('config')}
              >
                + Cadastrar evento
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hero — Calcular Produção */}
      <button
        onClick={() => onNavigate('producao')}
        className="w-full text-left border-none cursor-pointer transition-all hover:opacity-90 active:scale-[0.99] mb-5 relative overflow-hidden"
        style={{
          background: 'var(--color-primary)',
          borderRadius: 'var(--radius-card)',
          minHeight: 148,
          padding: '1.25rem 1.5rem',
        }}
      >
        <div className="relative z-10" style={{ maxWidth: '58%' }}>
          <p
            className="text-[10px] font-bold tracking-widest uppercase mb-2"
            style={{ color: 'var(--color-accent)', letterSpacing: '0.12em' }}
          >
            ✦ gestão da produção
          </p>
          <h2
            className="text-2xl font-black leading-tight mb-2"
            style={{ fontFamily: 'var(--font-title)', color: 'var(--color-text-light)' }}
          >
            Calcular Produção
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--color-text-light)', opacity: 0.6 }}>
            Planeje suas receitas e quantidades com facilidade
          </p>
          <span
            className="inline-flex items-center gap-2 text-xs font-bold px-4 py-2"
            style={{
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 'var(--radius-btn)',
            }}
          >
            Calcular agora →
          </span>
        </div>
        <img
          src="/mascote-cramb.png"
          alt="mascote Crumb Lab"
          className="absolute bottom-0 right-0 pointer-events-none"
          style={{ height: '90%', maxHeight: 160, objectFit: 'contain' }}
        />
      </button>

      {/* Acesso rápido — todos os módulos */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Estoque',     icon: '/icons/nav-estoque.png',    module: 'estoque' },
          { label: 'Receitas',    icon: '/icons/nav-receitas.png',   module: 'receitas' },
          { label: 'Produção',    icon: '/icons/nav-producao.png',   module: 'producao' },
          { label: 'Preços',      icon: '/icons/nav-precos.png',     module: 'precificacao' },
          { label: 'Feiras',      icon: '/icons/nav-feiras.png',     module: 'feiras' },
          { label: 'Relatórios',  icon: '/icons/nav-relatorios.png', module: 'relatorios' },
        ].map((item) => (
          <button
            key={item.module}
            onClick={() => onNavigate(item.module)}
            className="bfy-card flex flex-col items-center justify-center gap-2 py-4 px-2 border-none cursor-pointer transition-all hover:opacity-90 active:scale-95"
          >
            <img src={item.icon} alt={item.label} style={{ width: 32, height: 32, objectFit: 'contain' }} />
            <span className="text-[11px] font-bold" style={{ color: 'var(--color-text)', opacity: 0.8 }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>

      {/* Rodapé */}
      
    </div>
  )
}
