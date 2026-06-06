import { useStorage } from './useStorage'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export function useClientes() {
  const [clientes, setClientes] = useStorage('bfy:clientes', [])

  function adicionar(dados) {
    const novo = {
      id: uid(),
      criadoEm: new Date().toISOString(),
      nome: dados.nome?.trim() ?? '',
      telefone: dados.telefone?.trim() ?? '',
      instagram: dados.instagram?.trim() ?? '',
      email: dados.email?.trim() ?? '',
      notas: dados.notas?.trim() ?? '',
    }
    setClientes((prev) => [novo, ...prev])
    return novo
  }

  function atualizar(id, changes) {
    setClientes((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...changes } : c)),
    )
  }

  function remover(id) {
    setClientes((prev) => prev.filter((c) => c.id !== id))
  }

  return { clientes, adicionar, atualizar, remover }
}
