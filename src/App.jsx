import { useState } from 'react'
import { Home } from './modules/Home'
import { Receitas } from './modules/Receitas'
import { Estoque } from './modules/Estoque'
import { Producao } from './modules/Producao'
import { Precificacao } from './modules/Precificacao'
import { Relatorios } from './modules/Relatorios'
import { Feiras } from './modules/Feiras'
import { Vendas } from './modules/Vendas'
import { Configuracoes } from './modules/Configuracoes'
import { SyncBar } from './components/SyncBar'

// ─── Ícone SVG para o item "Vendas" no nav ────────────────────────────────────

function NavSvgIcon({ size = 28, active = false, children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        opacity: active ? 1 : 0.55,
        transition: 'opacity 0.15s',
        color: 'var(--color-text-light)',
      }}
    >
      {children}
    </svg>
  )
}

function VendasNavSvg(props) {
  return (
    <NavSvgIcon {...props}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </NavSvgIcon>
  )
}

function ConfigNavSvg(props) {
  return (
    <NavSvgIcon {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </NavSvgIcon>
  )
}

const NAV = [
  { id: 'home',         label: 'Início',     icon: '/icons/nav-inicio.png' },
  { id: 'estoque',      label: 'Estoque',    icon: '/icons/nav-estoque.png' },
  { id: 'receitas',     label: 'Receitas',   icon: '/icons/nav-receitas.png' },
  { id: 'producao',     label: 'Produção',   icon: '/icons/nav-producao.png' },
  { id: 'precificacao', label: 'Preços',     icon: '/icons/nav-precos.png' },
  { id: 'vendas',       label: 'Vendas',     icon: '/icons/nav-vendas.png' },
  { id: 'relatorios',   label: 'Relatórios', icon: '/icons/nav-relatorios.png' },
  { id: 'feiras',       label: 'Feiras',     icon: '/icons/nav-feiras.png' },
  { id: 'config',       label: 'Config',     svg: 'config' },
]

function NavIcon({ item, size = 28, active = false }) {
  if (item.svg === 'config') return <ConfigNavSvg size={size} active={active} />
  if (item.svg === 'vendas') return <VendasNavSvg size={size} active={active} />
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'block',
        width: size,
        height: size,
        flexShrink: 0,
        background: `url(${item.icon}) center/contain no-repeat`,
        opacity: active ? 1 : 0.55,
        transition: 'opacity 0.15s',
      }}
    />
  )
}

export default function App() {
  const [active, setActive] = useState('home')
  const [feirasPosMode, setFeirasPosMode] = useState(false)

  function renderModule() {
    const nav = (id) => setActive(id)
    switch (active) {
      case 'home':         return <Home onNavigate={nav} />
      case 'receitas':     return <Receitas />
      case 'estoque':      return <Estoque />
      case 'producao':     return <Producao />
      case 'precificacao': return <Precificacao />
      case 'vendas':       return <Vendas />
      case 'relatorios':   return <Relatorios />
      case 'feiras':       return <Feiras onPosModeChange={setFeirasPosMode} />
      case 'config':       return <Configuracoes />
      default:             return <Home onNavigate={nav} />
    }
  }

  const isFeirasPos = active === 'feiras' && feirasPosMode

  return (
    <div
      className="flex h-[100dvh] overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* ── Sidebar desktop (>=1024px) — oculta só no modo caixa ── */}
      <nav
        className={`${isFeirasPos ? 'hidden' : 'hidden lg:flex'} flex-col w-56 shrink-0 h-full`}
        style={{ background: 'var(--color-primary)' }}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-3 shrink-0">
          <img
            src="/hero-crumb.png"
            alt="Crumb Lab"
            style={{ width: '100%', objectFit: 'contain', maxHeight: 72 }}
          />
          <p
            className="text-[11px] mt-2 tracking-wide text-center"
            style={{ color: 'var(--color-text-light)', opacity: 0.55 }}
          >
            cookies. coffee. repeat
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-0.5">
          {NAV.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                style={{
                  background: isActive ? 'var(--color-surface)' : 'transparent',
                  color: isActive ? 'var(--color-accent-dark)' : 'var(--color-text-light)',
                  opacity: isActive ? 1 : 0.8,
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                <NavIcon item={item} size={28} active={isActive} />
                <span className="text-sm">{item.label}</span>
                {isActive && (
                  <span
                    className="ml-auto w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: 'var(--color-accent-dark)' }}
                  />
                )}
              </button>
            )
          })}
        </div>

        <div
          className="px-4 py-3 text-[10px] shrink-0"
          style={{
            color: 'var(--color-text-light)',
            opacity: 0.35,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          © 2025 Crumb Lab
        </div>
      </nav>

      {/* ── Sidebar ícones: tablet sempre, desktop só no modo caixa ── */}
      <nav
        className={`hidden md:flex ${isFeirasPos ? '' : 'lg:hidden'} flex-col w-[4.75rem] shrink-0 h-full items-center py-4 gap-1`}
        style={{ background: 'var(--color-primary)' }}
      >
        <div className="w-12 h-12 mb-1 rounded-xl overflow-hidden shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <img src="/hero-crumb.png" alt="Crumb Lab" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
        {NAV.map((item) => {
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              title={item.label}
              className="w-12 h-12 flex items-center justify-center rounded-xl transition-all"
              style={{
                background: isActive ? 'var(--color-surface)' : 'transparent',
              }}
            >
              <NavIcon item={item} size={30} active={isActive} />
            </button>
          )
        })}
      </nav>

      {/* ── Área de conteúdo + bottom nav ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <SyncBar />
        <main className={`flex-1 min-h-0 ${isFeirasPos ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {renderModule()}
          {!isFeirasPos && <div className="md:hidden h-16" />}
        </main>

        {/* ── Bottom nav mobile (<768px) — oculta no modo caixa ── */}
        <nav
          className={`md:hidden shrink-0 flex overflow-x-auto no-scrollbar ${isFeirasPos ? 'hidden' : ''}`}
          style={{
            background: 'var(--color-primary)',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            minHeight: '3.75rem',
          }}
        >
          {NAV.map((item) => {
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => setActive(item.id)}
                className="flex flex-col items-center justify-center flex-1 min-w-[4rem] py-1.5 gap-0.5 transition-all"
                style={{
                  color: isActive ? 'var(--color-surface)' : 'rgba(237,224,212,0.5)',
                }}
              >
                <NavIcon item={item} size={26} active={isActive} />
                <span className="text-[9px] font-semibold leading-none">{item.label}</span>
                {isActive && (
                  <span
                    className="w-1 h-1 rounded-full mt-0.5"
                    style={{ background: 'var(--color-accent)' }}
                  />
                )}
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
