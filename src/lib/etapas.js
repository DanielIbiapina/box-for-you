/**
 * Etapas de um pedido, como o cliente as vê na página de acompanhamento
 * (/?p=REFERENCIA) e a dona as avança em Vendas.
 *
 * Partilhado entre a loja e o CRM — sem dependências, para não pesar na loja.
 *
 * O `status` do pedido (pendente | pago | entregue | cancelado) continua a
 * tratar do pagamento e do stock; a `etapa` é só o andamento:
 *   recebido → confirmado → preparando → pronto → a_caminho (só entrega) → entregue
 * Pedidos antigos sem etapa tiram-na do status (pago = confirmado, entregue = entregue).
 */

export const TODAS_ETAPAS = ['recebido', 'confirmado', 'preparando', 'pronto', 'a_caminho', 'entregue']

/** As etapas que fazem sentido para este pedido (só a entrega passa por "a caminho"). */
export function etapasDo(pedido) {
  const entrega = pedido?.entrega?.tipo === 'entrega'
  return TODAS_ETAPAS.filter((e) => e !== 'a_caminho' || entrega)
}

/** A etapa em que o pedido está agora ('cancelado' se foi cancelado). */
export function etapaAtual(pedido) {
  if (!pedido) return 'recebido'
  if (pedido.status === 'cancelado') return 'cancelado'
  if (pedido.etapa && TODAS_ETAPAS.includes(pedido.etapa)) return pedido.etapa
  if (pedido.status === 'entregue') return 'entregue'
  if (pedido.status === 'pago') return 'confirmado'
  return 'recebido'
}

/** Nome curto da etapa (para botões e linha do tempo). */
export function rotuloEtapa(etapa, tipo) {
  switch (etapa) {
    case 'recebido': return 'Recebido'
    case 'confirmado': return 'Confirmado'
    case 'preparando': return 'A preparar'
    case 'pronto': return tipo === 'levantar' ? 'Pronto a levantar' : 'Pronto'
    case 'a_caminho': return 'A caminho'
    case 'entregue': return tipo === 'levantar' ? 'Levantado' : 'Entregue'
    case 'cancelado': return 'Cancelado'
    default: return etapa
  }
}

/** O que o cliente lê em grande na página do pedido, por etapa. */
export function textoParaCliente(etapa, { tipo, pagamento, local } = {}) {
  const levantar = tipo === 'levantar'
  switch (etapa) {
    case 'recebido':
      return {
        titulo: 'Recebemos o teu pedido',
        detalhe: pagamento === 'MB WAY'
          ? 'Vamos confirmar contigo e enviar o pedido de pagamento MB WAY.'
          : 'Vamos confirmar contigo por mensagem.',
      }
    case 'confirmado':
      return { titulo: 'Pedido confirmado', detalhe: 'Já está na nossa lista. Avisamos quando começarmos a preparar.' }
    case 'preparando':
      return { titulo: 'Estamos a preparar os teus cookies', detalhe: 'Saem do forno em breve.' }
    case 'pronto':
      return levantar
        ? { titulo: 'Está pronto! Podes vir buscar', detalhe: local ? `Levantamento em ${local}.` : 'Combinamos contigo o sítio e a hora.' }
        : { titulo: 'Está pronto', detalhe: 'Sai em breve para entrega.' }
    case 'a_caminho':
      return { titulo: 'O teu pedido está a caminho', detalhe: 'Prepara o leite. 🥛' }
    case 'entregue':
      return {
        titulo: levantar ? 'Pedido levantado' : 'Pedido entregue',
        detalhe: 'Obrigada! Esperamos que gostes. Até à próxima fornada.',
      }
    case 'cancelado':
      return { titulo: 'Este pedido foi cancelado', detalhe: 'Se tiveres dúvidas, fala connosco.' }
    default:
      return { titulo: 'O teu pedido', detalhe: '' }
  }
}

/** Mensagem para a dona mandar ao cliente pelo WhatsApp quando muda a etapa. */
export function mensagemParaCliente(etapa, { nome, referencia, tipo, local, link } = {}) {
  const ola = nome ? `Olá ${String(nome).trim().split(/\s+/)[0]}!` : 'Olá!'
  const ref = referencia ? ` #${referencia}` : ''
  const acompanhar = link ? `\nPodes acompanhar aqui: ${link}` : ''
  switch (etapa) {
    case 'recebido': return `${ola} Recebemos o teu pedido${ref} 🍪${acompanhar}`
    case 'confirmado': return `${ola} O teu pedido${ref} está confirmado 🍪${acompanhar}`
    case 'preparando': return `${ola} Já estamos a preparar os teus cookies (pedido${ref}) 🍪${acompanhar}`
    case 'pronto':
      return tipo === 'levantar'
        ? `${ola} O teu pedido${ref} está pronto para levantar${local ? ` em ${local}` : ''} 🍪${acompanhar}`
        : `${ola} O teu pedido${ref} está pronto e sai em breve para entrega 🍪${acompanhar}`
    case 'a_caminho': return `${ola} O teu pedido${ref} saiu para entrega e está a caminho 🛵${acompanhar}`
    case 'entregue': return `Obrigada${nome ? `, ${String(nome).trim().split(/\s+/)[0]}` : ''}! Esperamos que gostes dos cookies 🍪`
    default: return `${ola}`
  }
}

/** Link wa.me para um telemóvel português (ou internacional com indicativo). */
export function linkWhatsAppPara(telefone, texto) {
  let d = String(telefone ?? '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.length === 9 && d.startsWith('9')) d = `351${d}`
  if (!d) return null
  return `https://wa.me/${d}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
}
