/**
 * Ícones da Crumb Lab, desenhados à mão para a marca (nada de emoji).
 * Traço redondo e grosso como o contorno das mascotes da logo; cor do texto
 * (currentColor), por isso pintam-se com `color`. Grelha de 24×24.
 */

function Svg({ size = 20, children, className, ...resto }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false" className={className} {...resto}
    >
      {children}
    </svg>
  )
}

/** Contorno do cookie com a dentada (dois arcos) em cima à direita. */
const COOKIE = 'M20.9 11.25A9 9 0 1 1 13.25 3.6a3.2 3.2 0 0 0 5.1 2.55 3.2 3.2 0 0 0 2.55 5.1Z'

/** Pepitas de chocolate: manchas irregulares, não pontos redondos. */
function Pepitas({ cor = 'currentColor' }) {
  return (
    <g fill={cor} stroke="none">
      <path d="M7.4 8.9c.5-.7 1.7-.6 2 .2.3.9-.4 1.6-1.2 1.6-.9 0-1.3-1-.8-1.8Z" />
      <path d="M12.6 12.2c.7-.4 1.8 0 1.8.9 0 .8-.8 1.3-1.6 1.1-.8-.2-.9-1.5-.2-2Z" />
      <path d="M7.6 15.2c.6-.5 1.6-.2 1.7.6.1.8-.6 1.3-1.3 1.2-.8-.1-1-1.2-.4-1.8Z" />
      <path d="M15.6 16.4c.5-.6 1.5-.5 1.7.2.2.8-.5 1.3-1.2 1.2-.7-.1-1-.9-.5-1.4Z" />
      <path d="M11.2 6.6c.5-.3 1.2 0 1.2.6 0 .6-.6.9-1.1.8-.6-.1-.6-1.1-.1-1.4Z" />
    </g>
  )
}

/** Cookie mordido, com pepitas. */
export function IconeCookie({ size, cheio = false, ...p }) {
  return (
    <Svg size={size} {...p}>
      <path d={COOKIE} fill={cheio ? 'currentColor' : 'none'} />
      <Pepitas cor={cheio ? 'var(--icone-fundo, #0A0604)' : 'currentColor'} />
    </Svg>
  )
}

/** Oferta: caixa embrulhada com laço, com pepitas de cookie no papel. */
export function IconePresente({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <rect x="3.4" y="8.2" width="17.2" height="4" rx="1.2" />
      <path d="M5 12.2v6.8a1.6 1.6 0 0 0 1.6 1.6h10.8A1.6 1.6 0 0 0 19 19v-6.8M12 8.2v12.4" />
      <path d="M12 8.2c-1.7-.2-4.8-1-4.8-3 0-2.1 3.1-1.9 4.8 3ZM12 8.2c1.7-.2 4.8-1 4.8-3 0-2.1-3.1-1.9-4.8 3Z" />
      <path d="M8.2 15.6h.01M15.6 17.2h.01M8.6 18.4h.01" strokeWidth="2.4" />
    </Svg>
  )
}

/** Mota de entrega com a caixa atrás. */
export function IconeMota({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <circle cx="6" cy="17.5" r="2.4" />
      <circle cx="18.2" cy="17.5" r="2.4" />
      <path d="M8.4 17.5h5.4l1.4-3.2c.4-1-.3-2-1.3-2H9.6c-2.6 0-4.6 1.8-5 4.4" />
      <path d="M15.8 17.5 14.1 7.2h-1.6M14.1 7.2h2.3" />
      <rect x="3.2" y="6.4" width="6.2" height="4.6" rx="1.1" />
      <path d="M6.3 8.7h.01" strokeWidth="2.4" />
    </Svg>
  )
}

/** Saco de papel da cozinha (levantar), com um cookie estampado. */
export function IconeSaco({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <path d="M5.2 8.2h13.6l-1.1 11a1.6 1.6 0 0 1-1.6 1.4H7.9a1.6 1.6 0 0 1-1.6-1.4Z" />
      <path d="M9 10.4V7a3 3 0 0 1 6 0v3.4" />
      <circle cx="12" cy="15.2" r="2.4" />
      <path d="M11.4 14.6h.01M12.7 15.8h.01" strokeWidth="2.2" />
    </Svg>
  )
}

/** Telemóvel com o sinal do pagamento (MB WAY). */
export function IconeTelemovel({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <rect x="5.5" y="2.8" width="10" height="18.4" rx="2.6" />
      <path d="M9.4 5.8h2.2" />
      <path d="M8.6 13.2l1.7 1.7 3.2-3.6" />
      <path d="M18.6 9.2a4 4 0 0 1 0 5.6M20.8 7a7.2 7.2 0 0 1 0 10" />
    </Svg>
  )
}

/** Nota de euro (pagar em dinheiro). */
export function IconeNotas({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <rect x="2.6" y="6.2" width="18.8" height="11.6" rx="2.2" />
      <path d="M15 9.6a2.9 2.9 0 1 0 0 4.8M8.8 11.2h4M8.8 12.8h4" />
      <path d="M5.8 9.4h.01M18.2 14.6h.01" strokeWidth="2.4" />
    </Svg>
  )
}

/** Marcador de local (sítio de levantamento). */
export function IconePin({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <path d="M12 21.2s-6.6-5.4-6.6-11a6.6 6.6 0 0 1 13.2 0c0 5.6-6.6 11-6.6 11Z" />
      <circle cx="12" cy="10.2" r="2.4" />
    </Svg>
  )
}

/** Pessoa (contacto). */
export function IconePessoa({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <circle cx="12" cy="8.2" r="3.6" />
      <path d="M4.8 20.4c.9-3.8 3.7-6 7.2-6s6.3 2.2 7.2 6" />
    </Svg>
  )
}

/** Etiqueta de preço (poupança). */
export function IconeEtiqueta({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <path d="M3.4 12.4V4.9a1.5 1.5 0 0 1 1.5-1.5h7.5l8.3 8.3a1.6 1.6 0 0 1 0 2.2l-7.2 7.2a1.6 1.6 0 0 1-2.2 0Z" />
      <circle cx="8" cy="8" r="1.4" />
      <path d="m10.6 15.4 4.6-4.6" />
    </Svg>
  )
}

/** Bilhete com recortes (cupão). */
export function IconeCupao({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <path d="M4.2 5.6h15.6a1.2 1.2 0 0 1 1.2 1.2v3a2.2 2.2 0 0 0 0 4.4v3a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 17.2v-3a2.2 2.2 0 0 0 0-4.4v-3a1.2 1.2 0 0 1 1.2-1.2Z" />
      <path d="M15 8v8" strokeDasharray="1.4 2.2" />
    </Svg>
  )
}

/** Montra com toldo (pedido feito na loja online). */
export function IconeLoja({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <path d="M3.4 9.6 5 4.6h14l1.6 5" />
      <path d="M3.4 9.6a2.85 2.85 0 0 0 5.7 0 2.85 2.85 0 0 0 5.7 0 2.85 2.85 0 0 0 5.7 0" />
      <path d="M5 12.4v7.6h14v-7.6M10 20v-4.4h4V20" />
    </Svg>
  )
}

/** Calendário (dias da encomenda). */
export function IconeCalendario({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <rect x="3.6" y="5" width="16.8" height="15.4" rx="2.4" />
      <path d="M3.6 9.6h16.8M8.2 3v3.6M15.8 3v3.6" />
      <path d="M8 13.4h.01M12 13.4h.01M16 13.4h.01M8 16.8h.01M12 16.8h.01" strokeWidth="2.4" />
    </Svg>
  )
}

/** Livro com fita e ponto de exclamação (Livro de Reclamações). */
export function IconeLivro({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <path d="M5 19.4V5a2 2 0 0 1 2-2h12v14.6H7a2 2 0 0 0-2 1.8Zm0 0A2 2 0 0 0 7 21.2h12" />
      <path d="M12.2 6.8v4.6" />
      <path d="M12.2 14.2h.01" strokeWidth="2.6" />
    </Svg>
  )
}

/** Selo do cartão de fidelidade, a dobrar. */
export function IconeSelos({ size, ...p }) {
  return (
    <Svg size={size} {...p}>
      <circle cx="9" cy="12" r="5.6" />
      <path d="M15.4 6.9a5.6 5.6 0 1 1 0 10.2" />
      <path d="m6.6 12 1.7 1.7 3.2-3.4" />
    </Svg>
  )
}
