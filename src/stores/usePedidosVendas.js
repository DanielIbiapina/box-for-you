import { useStorage } from './useStorage'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

// linhas: [{ cookieId, qty, preco }]
// status: 'pendente' | 'pago' | 'entregue' | 'cancelado'

export const STATUS_PEDIDO = [
  { id: 'pendente',  label: 'Pendente',  color: '#E8A040' },
  { id: 'pago',      label: 'Pago',      color: 'var(--color-success)' },
  { id: 'entregue',  label: 'Entregue',  color: 'var(--color-accent-dark)' },
  { id: 'cancelado', label: 'Cancelado', color: '#e57373' },
]

export function usePedidosVendas() {
  const [pedidos, setPedidos] = useStorage('bfy:pedidos-vendas', [])

  function adicionar(dados) {
    const novo = {
      id: uid(),
      criadoEm: new Date().toISOString(),
      clienteId: dados.clienteId ?? null,
      linhas: dados.linhas ?? [],       // [{ cookieId, qty, preco }]
      totalEur: dados.totalEur ?? 0,
      formaPagamento: dados.formaPagamento ?? '',
      status: dados.status ?? 'pendente',
      notas: dados.notas?.trim() ?? '',
    }
    setPedidos((prev) => [novo, ...prev])
    return novo
  }

  function atualizar(id, changes) {
    setPedidos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    )
  }

  function remover(id) {
    setPedidos((prev) => prev.filter((p) => p.id !== id))
  }

  return { pedidos, adicionar, atualizar, remover }
}
