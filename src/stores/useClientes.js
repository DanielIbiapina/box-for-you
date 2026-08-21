import { useData } from './DataProvider'

export function useClientes() {
  const { clientes, createRow, updateRow, removeRow } = useData()

  function adicionar(dados) {
    return createRow('clientes', {
      criadoEm: new Date().toISOString(),
      nome: dados.nome?.trim() ?? '',
      telefone: dados.telefone?.trim() ?? '',
      instagram: dados.instagram?.trim() ?? '',
      email: dados.email?.trim() ?? '',
      notas: dados.notas?.trim() ?? '',
    })
  }

  return {
    clientes,
    adicionar,
    atualizar: (id, changes) => updateRow('clientes', id, changes),
    remover: (id) => removeRow('clientes', id),
  }
}
