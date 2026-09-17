/**
 * Icon set do Crumb Lab.
 *
 * Traço único (stroke), 24×24, herda `currentColor` e o tamanho via prop.
 * Substitui os emojis usados como cromo de interface — emojis de produto
 * (sabores do cardápio) continuam a ser dados do negócio, não ícones.
 *
 * Uso:  <Icon name="alerta" size={16} />
 */

const PATHS = {
  // ── Navegação ─────────────────────────────────────────────────────────────
  inicio: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  estoque: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </>
  ),
  receitas: (
    <>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19a1 1 0 0 1 1 1v14.5" />
      <path d="M4 4.5v14A2.5 2.5 0 0 0 6.5 21H20" />
      <path d="M8 8h8M8 12h6" />
    </>
  ),
  producao: (
    <>
      <path d="M4 6h16v3a8 8 0 0 1-16 0z" />
      <path d="M6 21h12" />
      <path d="M12 17v4" />
      <path d="M9 3v2M12 2.5V5M15 3v2" />
    </>
  ),
  vendas: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.2a4 4 0 0 1 0 7.6" />
    </>
  ),
  financeiro: (
    <>
      <path d="M12 2v20" />
      <path d="M17 5.5H9.75a3.25 3.25 0 0 0 0 6.5h4.5a3.25 3.25 0 0 1 0 6.5H6" />
    </>
  ),
  relatorios: (
    <>
      <path d="M3 21h18" />
      <path d="M6 21V11M11 21V5M16 21v-7M21 21v-4" />
    </>
  ),
  feiras: (
    <>
      <path d="M3 9.5 5 4h14l2 5.5" />
      <path d="M3 9.5a2.5 2.5 0 0 0 4.5 1.5 2.5 2.5 0 0 0 4.5 0 2.5 2.5 0 0 0 4.5 0A2.5 2.5 0 0 0 21 9.5" />
      <path d="M4.5 12.5V20a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-7.5" />
    </>
  ),
  config: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2.5M12 19.5V22M4.22 4.22l1.78 1.78M18 18l1.78 1.78M2 12h2.5M19.5 12H22M4.22 19.78 6 18M18 6l1.78-1.78" />
    </>
  ),

  // ── Ações ─────────────────────────────────────────────────────────────────
  mais: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  editar: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
    </>
  ),
  lixo: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  fechar: <path d="M18 6 6 18M6 6l12 12" />,
  check: <path d="M20 6 9 17l-5-5" />,
  voltar: <path d="M19 12H5M12 5l-7 7 7 7" />,
  avancar: <path d="M5 12h14M12 5l7 7-7 7" />,
  descarregar: (
    <>
      <path d="M12 3v12" />
      <path d="M7 10.5 12 15.5l5-5" />
      <path d="M4 20h16" />
    </>
  ),
  carregar: (
    <>
      <path d="M12 16V4" />
      <path d="M7 9 12 4l5 5" />
      <path d="M4 20h16" />
    </>
  ),
  procurar: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  sair: (
    <>
      <path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),

  // ── Semântica ─────────────────────────────────────────────────────────────
  alerta: (
    <>
      <path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  dica: (
    <>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .9 1.6h5.2c.1-.6.4-1.2.9-1.6A6 6 0 0 0 12 3z" />
    </>
  ),
  calendario: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  caixa: (
    <>
      <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5 12 12l9-4.5M12 12v9" />
      <path d="M7.5 5.2 16.5 9.8" />
    </>
  ),
  cookie: (
    <>
      <path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4.5-3 4.5 4.5 0 0 1-4.5-6z" />
      <path d="M9 9.5h.01M14 13h.01M9.5 15h.01" />
    </>
  ),
  carrinho: (
    <>
      <circle cx="9" cy="20" r="1.5" />
      <circle cx="18" cy="20" r="1.5" />
      <path d="M2 3h2.5l2.4 12.1a1 1 0 0 0 1 .9h9.3a1 1 0 0 0 1-.8L21 7H6" />
    </>
  ),
  recibo: (
    <>
      <path d="M5 3h14v18l-2.3-1.6-2.35 1.6L12 19.4 9.65 21 7.3 19.4 5 21z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  troféu: (
    <>
      <path d="M8 3h8v6a4 4 0 0 1-8 0z" />
      <path d="M8 5H5.5A1.5 1.5 0 0 0 4 6.5 3.5 3.5 0 0 0 7.5 10H8" />
      <path d="M16 5h2.5A1.5 1.5 0 0 1 20 6.5 3.5 3.5 0 0 1 16.5 10H16" />
      <path d="M12 13v4M9 21h6M10 17h4" />
    </>
  ),
  massa: (
    <>
      <path d="M12 3 3 7.5 12 12l9-4.5z" />
      <path d="M3 12.5 12 17l9-4.5" />
      <path d="M3 17 12 21.5 21 17" />
    </>
  ),
  etiqueta: (
    <>
      <path d="M3 3h7.6a2 2 0 0 1 1.4.6l8.4 8.4a2 2 0 0 1 0 2.8l-6.6 6.6a2 2 0 0 1-2.8 0L3.6 13A2 2 0 0 1 3 11.6z" />
      <path d="M7.5 7.5h.01" />
    </>
  ),
  tendencia: (
    <>
      <path d="M3 17.5 9.5 11l4 4L21 7.5" />
      <path d="M15.5 7.5H21v5.5" />
    </>
  ),
  festa: (
    <>
      <path d="M3.5 20.5 8 8l8 8z" />
      <path d="M14 3v.01M18.5 6.5v.01M21 12v.01M17 15v.01M11 4.5v.01" />
    </>
  ),
  estrela: <path d="m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8z" />,
  fidelidade: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9.5h18" />
      <path d="m8 15 1.6 1.6L13.5 12.5" />
    </>
  ),
  utilizador: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  telefone: (
    <path d="M21.5 16.9v2.8a1.9 1.9 0 0 1-2.1 1.9 18.9 18.9 0 0 1-8.2-2.9 18.6 18.6 0 0 1-5.7-5.7A18.9 18.9 0 0 1 2.6 4.7 1.9 1.9 0 0 1 4.5 2.6h2.8a1.9 1.9 0 0 1 1.9 1.6 12 12 0 0 0 .7 2.7 1.9 1.9 0 0 1-.5 2L8.2 10.1a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.4 12 12 0 0 0 2.7.7 1.9 1.9 0 0 1 1.7 2z" />
  ),
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M17.5 6.5h.01" />
    </>
  ),
}

export function Icon({ name, size = 20, strokeWidth = 1.75, className = '', style, ...rest }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ flexShrink: 0, display: 'block', ...style }}
      {...rest}
    >
      {d}
    </svg>
  )
}
