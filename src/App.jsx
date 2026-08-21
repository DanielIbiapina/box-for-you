import { useEffect, useState } from 'react'
import { Home } from './modules/Home'
import { Receitas } from './modules/Receitas'
import { Estoque } from './modules/Estoque'
import { Producao } from './modules/Producao'
import { Relatorios } from './modules/Relatorios'
import { Feiras } from './modules/Feiras'
import { Vendas } from './modules/Vendas'
import { Financeiro } from './modules/Financeiro'
import { Configuracoes } from './modules/Configuracoes'
import { SyncBar } from './components/SyncBar'
import { Icon } from './components/Icon'

/**
 * Navegação.
 * `primary` marca os destinos do dia-a-dia — são esses que ficam na barra
 * inferior do telemóvel; os restantes vivem em "Mais". No desktop mostra-se
 * tudo na sidebar, onde há espaço.
 */
const NAV = [
  { id: 'home',       label: 'Início',          icon: 'inicio',     primary: true },
  { id: 'vendas',     label: 'Vendas',          icon: 'vendas',     primary: true },
  { id: 'feiras',     label: 'Feiras',          icon: 'feiras',     primary: true },
  { id: 'producao',   label: 'Produção',        icon: 'producao',   primary: true },
  { id: 'estoque',    label: 'Estoque',         icon: 'estoque' },
  { id: 'receitas',   label: 'Receitas',        icon: 'receitas' },
  { id: 'financeiro', label: 'Entradas/Saídas', icon: 'financeiro' },
  { id: 'relatorios', label: 'Relatórios',      icon: 'relatorios' },
  { id: 'config',     label: 'Definições',      icon: 'config' },
]

const PRIMARY = NAV.filter((n) => n.primary)
const SECONDARY = NAV.filter((n) => !n.primary)

export default function App() {
  const [active, setActive] = useState('home')
  const [feirasPosMode, setFeirasPosMode] = useState(false)
  const [maisAberto, setMaisAberto] = useState(false)

  // Fecha a folha "Mais" com Escape
  useEffect(() => {
    if (!maisAberto) return
    const onKey = (e) => e.key === 'Escape' && setMaisAberto(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [maisAberto])

  function go(id) {
    setActive(id)
    setMaisAberto(false)
  }

  function renderModule() {
    switch (active) {
      case 'home':       return <Home onNavigate={go} />
      case 'receitas':   return <Receitas />
      case 'estoque':    return <Estoque />
      case 'producao':   return <Producao />
      case 'vendas':     return <Vendas />
      case 'financeiro': return <Financeiro />
      case 'relatorios': return <Relatorios />
      case 'feiras':     return <Feiras onPosModeChange={setFeirasPosMode} />
      case 'config':     return <Configuracoes />
      default:           return <Home onNavigate={go} />
    }
  }

  const isFeirasPos = active === 'feiras' && feirasPosMode
  const activeItem = NAV.find((n) => n.id === active)
  const secondaryAtivo = SECONDARY.some((n) => n.id === active)

  return (
    <div className="flex h-[100dvh] overflow-hidden" style={{ background: 'var(--color-bg)' }}>

      {/* ── Sidebar desktop (≥1024px) — escondida no modo caixa ── */}
      <nav
        aria-label="Navegação principal"
        className={`${isFeirasPos ? 'hidden' : 'hidden lg:flex'} flex-col w-56 shrink-0 h-full`}
        style={{ background: 'var(--color-primary)' }}
      >
        <div className="px-4 pt-5 pb-4 shrink-0">
          <img src="/hero-crumb.png" alt="Crumb Lab" style={{ width: '100%', objectFit: 'contain', maxHeight: 68 }} />
          <p className="text-center mt-2" style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-on-dark-3)', letterSpacing: '0.06em' }}>
            cookies. coffee. repeat
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-0.5">
          {NAV.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => go(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors"
                style={{
                  background: isActive ? 'var(--color-surface)' : 'transparent',
                  color: isActive ? 'var(--color-accent-dark)' : 'var(--ink-on-dark-2)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: 'var(--text-md)',
                }}
              >
                <Icon name={item.icon} size={21} strokeWidth={isActive ? 2 : 1.75} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>

        <div
          className="px-4 py-3 shrink-0"
          style={{ fontSize: 'var(--text-2xs)', color: 'var(--ink-on-dark-3)', borderTop: '1px solid rgba(255,255,255,0.08)' }}
        >
          © 2025 Crumb Lab
        </div>
      </nav>

      {/* ── Sidebar de ícones: tablet sempre; desktop só no modo caixa ── */}
      <nav
        aria-label="Navegação principal"
        className={`hidden md:flex ${isFeirasPos ? '' : 'lg:hidden'} flex-col w-[4.5rem] shrink-0 h-full items-center py-4 gap-1`}
        style={{ background: 'var(--color-primary)' }}
      >
        <div className="w-11 h-11 mb-2 rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <img src="/mascote-cramb.png" alt="Crumb Lab" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        </div>
        {NAV.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => go(item.id)}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className="w-11 h-11 flex items-center justify-center rounded-xl transition-colors"
              style={{
                background: isActive ? 'var(--color-surface)' : 'transparent',
                color: isActive ? 'var(--color-accent-dark)' : 'var(--ink-on-dark-2)',
              }}
            >
              <Icon name={item.icon} size={22} strokeWidth={isActive ? 2 : 1.75} />
            </button>
          )
        })}
      </nav>

      {/* ── Conteúdo ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SyncBar />

        {/* Cabeçalho mobile: dá contexto de onde se está */}
        {!isFeirasPos && (
          <header
            className="md:hidden shrink-0 flex items-center gap-2.5 px-4 py-2.5"
            style={{ background: 'var(--color-primary)' }}
          >
            <img src="/mascote-cramb.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            <span className="bfy-title" style={{ fontSize: 'var(--text-lg)', color: 'var(--ink-on-dark)' }}>
              {activeItem?.label ?? 'Crumb Lab'}
            </span>
          </header>
        )}

        <main className={`flex-1 min-h-0 ${isFeirasPos ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {renderModule()}
          {!isFeirasPos && <div className="md:hidden h-20" />}
        </main>

        {/* ── Barra inferior mobile: 4 destinos + Mais (sem scroll horizontal) ── */}
        {!isFeirasPos && (
          <nav
            aria-label="Navegação principal"
            className="md:hidden shrink-0 flex"
            style={{
              background: 'var(--color-primary)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            {PRIMARY.map((item) => {
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors"
                  style={{
                    minHeight: '3.5rem',
                    color: isActive ? 'var(--color-bg)' : 'var(--ink-on-dark-3)',
                  }}
                >
                  <Icon name={item.icon} size={22} strokeWidth={isActive ? 2.2 : 1.75} />
                  <span style={{ fontSize: '0.6875rem', fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>
                    {item.label}
                  </span>
                </button>
              )
            })}
            <button
              onClick={() => setMaisAberto(true)}
              aria-expanded={maisAberto}
              aria-haspopup="menu"
              className="flex flex-col items-center justify-center flex-1 gap-1 transition-colors"
              style={{
                minHeight: '3.5rem',
                color: secondaryAtivo ? 'var(--color-bg)' : 'var(--ink-on-dark-3)',
              }}
            >
              <Icon name={secondaryAtivo ? activeItem.icon : 'config'} size={22} strokeWidth={secondaryAtivo ? 2.2 : 1.75} />
              <span style={{ fontSize: '0.6875rem', fontWeight: secondaryAtivo ? 700 : 500, lineHeight: 1 }}>
                {secondaryAtivo ? activeItem.label : 'Mais'}
              </span>
            </button>
          </nav>
        )}
      </div>

      {/* ── Folha "Mais" ── */}
      {maisAberto && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          style={{ background: 'rgba(29,16,8,0.45)' }}
          onClick={() => setMaisAberto(false)}
        >
          <div
            role="menu"
            aria-label="Mais secções"
            className="rounded-t-2xl p-3 pb-6"
            style={{ background: 'var(--color-surface)', paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full mx-auto mb-3" style={{ background: 'var(--line-2)' }} />
            {SECONDARY.map((item) => {
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  role="menuitem"
                  onClick={() => go(item.id)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors"
                  style={{
                    background: isActive ? 'var(--color-accent-soft)' : 'transparent',
                    color: isActive ? 'var(--color-accent-dark)' : 'var(--ink-1)',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  <Icon name={item.icon} size={21} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
