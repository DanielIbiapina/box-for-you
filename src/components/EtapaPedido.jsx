import {
  etapaAtual, etapasDo, linkWhatsAppPara, mensagemParaCliente, rotuloEtapa,
} from '../lib/etapas'

const SITE = 'https://www.crumblabcookies.com'

/**
 * Andamento do pedido em Vendas: o que o cliente vê ao acompanhar o pedido.
 * Um toque numa etapa (ou em "→ próxima") muda-a; "Avisar no WhatsApp" abre
 * a conversa com o cliente já com a mensagem escrita e o link do pedido.
 */
export function EtapaPedido({ pedido, cliente, onMudar }) {
  const atual = etapaAtual(pedido)
  if (atual === 'cancelado') return null

  const tipo = pedido.entrega?.tipo
  const etapas = etapasDo(pedido)
  const idx = etapas.indexOf(atual)
  const proxima = idx >= 0 && idx < etapas.length - 1 ? etapas[idx + 1] : null

  const link = pedido.referencia ? `${SITE}/?p=${pedido.referencia}` : null
  const whatsapp = linkWhatsAppPara(cliente?.telefone, mensagemParaCliente(atual, {
    nome: cliente?.nome,
    referencia: pedido.referencia,
    tipo,
    local: pedido.entrega?.local?.nome,
    link,
  }))

  return (
    <div className="space-y-2 pt-3" style={{ borderTop: '1px solid var(--line-1)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="bfy-eyebrow">{pedido.referencia ? 'O cliente vê' : 'Andamento'}</p>
        {pedido.etapaEm && (
          <p className="text-[11px] ink-4">
            {new Date(pedido.etapaEm).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Etapa do pedido">
        {etapas.map((e, i) => {
          const feita = i < idx
          const agora = i === idx
          return (
            <button
              key={e}
              type="button"
              aria-pressed={agora}
              onClick={() => { if (!agora) onMudar(e) }}
              className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
              style={{
                background: agora ? 'var(--color-accent)' : feita ? 'rgba(90,158,133,0.14)' : 'var(--color-surface-sunk)',
                color: agora ? '#fff' : feita ? 'var(--color-success)' : 'rgba(29,16,8,0.5)',
                border: `1px solid ${agora ? 'var(--color-accent)' : 'var(--line-1)'}`,
              }}
            >
              {feita ? '✓ ' : ''}{rotuloEtapa(e, tipo)}
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {proxima && (
          <button type="button" className="btn-accent btn-sm" onClick={() => onMudar(proxima)}>
            Marcar: {rotuloEtapa(proxima, tipo)}
          </button>
        )}
        {whatsapp && (
          <a
            className="btn-ghost btn-sm"
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#128C4B', borderColor: 'rgba(18,140,75,0.35)' }}
          >
            Avisar no WhatsApp
          </a>
        )}
      </div>
    </div>
  )
}
