import { useData } from './DataProvider'
import { todayKey } from '../lib/salesAnalytics'

export const STATUS_EVENTO = [
  { id: 'planejada', label: 'Planejada' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluida', label: 'Concluída' },
]

export function useEventos() {
  const { eventos, createRow, updateRow, removeRow } = useData()

  function adicionar(dados) {
    return createRow('eventos', { ...dados, status: dados.status ?? 'planejada' })
  }

  function proximaFeira() {
    const now = todayKey()
    return eventos
      .filter((e) => e.status !== 'concluida' && e.data >= now)
      .sort((a, b) => (a.data < b.data ? -1 : 1))[0] ?? null
  }

  return {
    eventos,
    adicionar,
    atualizar: (id, changes) => updateRow('eventos', id, changes),
    remover: (id) => removeRow('eventos', id),
    proximaFeira,
  }
}
