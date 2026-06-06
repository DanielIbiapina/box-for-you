import { useStorage } from './useStorage'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export function useVendasAvulsas() {
  const [vendas, setVendas] = useStorage('bfy:vendas-avulsas', [])

  function adicionar(dados) {
    const venda = {
      id: uid(),
      criadaEm: new Date().toISOString(),
      cliente: dados.cliente?.trim() ?? '',
      descricao: dados.descricao?.trim() ?? '',
      valor: parseFloat(dados.valor) || 0,
      formaPagamento: dados.formaPagamento ?? '',
      notas: dados.notas?.trim() ?? '',
    }
    setVendas((prev) => [venda, ...prev])
    return venda
  }

  function remover(id) {
    setVendas((prev) => prev.filter((v) => v.id !== id))
  }

  return { vendas, adicionar, remover }
}
