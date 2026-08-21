import { useData } from './DataProvider'

// linhas: [{ cookieId, qty, preco }]
// box: opcional { counts: { cookieId: qty }, priceEur }
// status: 'pendente' | 'pago' | 'entregue' | 'cancelado'

export const STATUS_PEDIDO = [
  { id: 'pendente',  label: 'Pendente',  color: '#E8A040' },
  { id: 'pago',      label: 'Pago',      color: 'var(--color-success)' },
  { id: 'entregue',  label: 'Entregue',  color: 'var(--color-accent-dark)' },
  { id: 'cancelado', label: 'Cancelado', color: '#e57373' },
]

export function usePedidosVendas() {
  const { pedidos, createRow, updateRow, removeRow } = useData()

  function adicionar(dados) {
    return createRow('pedidos', {
      criadoEm: new Date().toISOString(),
      clienteId: dados.clienteId ?? null,
      linhas: dados.linhas ?? [],
      box: dados.box ?? null,
      totalEur: dados.totalEur ?? 0,
      desconto: dados.desconto ?? 0,
      dataPedido: dados.dataPedido ?? null,
      formaPagamento: dados.formaPagamento ?? '',
      status: dados.status ?? 'pendente',
      notas: dados.notas?.trim() ?? '',
    })
  }

  return {
    pedidos,
    adicionar,
    atualizar: (id, changes) => updateRow('pedidos', id, changes),
    remover: (id) => removeRow('pedidos', id),
  }
}
