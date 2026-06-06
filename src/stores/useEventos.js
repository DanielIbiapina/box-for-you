import { useStorage } from './useStorage'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const STATUS_EVENTO = [
  { id: 'planejada', label: 'Planejada' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'concluida', label: 'Concluída' },
]

export function useEventos() {
  const [eventos, setEventos] = useStorage('bfy:eventos', [])

  function adicionar(dados) {
    const novo = { ...dados, id: uid(), status: dados.status ?? 'planejada' }
    setEventos(prev => [...prev, novo].sort((a, b) => (a.data || '') < (b.data || '') ? -1 : 1))
    return novo
  }

  function atualizar(id, changes) {
    setEventos(prev => prev.map(e => (e.id === id ? { ...e, ...changes } : e)))
  }

  function remover(id) {
    setEventos(prev => prev.filter(e => e.id !== id))
  }

  function proximaFeira() {
    const now = new Date().toISOString().slice(0, 10)
    return eventos
      .filter(e => e.status !== 'concluida' && e.data >= now)
      .sort((a, b) => a.data < b.data ? -1 : 1)[0] ?? null
  }

  return { eventos, adicionar, atualizar, remover, proximaFeira }
}
