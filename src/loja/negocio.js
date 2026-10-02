/**
 * Dados do negócio que a loja mostra ao cliente.
 * Se o MB WAY mudar, muda aqui — é o único sítio.
 */

/** Como aparece no ecrã. */
export const MBWAY = '926 937 941'

/** O que vai para a área de transferência (sem espaços, como se marca). */
export const MBWAY_COPIA = MBWAY.replace(/\s/g, '')

/** WhatsApp da loja (com indicativo, só dígitos). */
export const WHATSAPP = '351926937941'

/** Abre conversa com a loja no WhatsApp, já com uma mensagem escrita. */
export const linkWhatsApp = (texto) =>
  `https://wa.me/${WHATSAPP}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
