import { useStorage } from './useStorage'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const CATEGORIAS = [
  { id: 'classico', label: 'Clássico',         gradient: 'linear-gradient(135deg,#C24B29 0%,#E07B5A 100%)' },
  { id: 'sazonal',  label: 'Sazonal & Especial', gradient: 'linear-gradient(135deg,#1D1008 0%,#4A2812 100%)' },
]

export function useReceitas() {
  const [receitas, setReceitas] = useStorage('bfy:receitas', [])

  function adicionar(dados) {
    const nova = {
      ...dados,
      id: uid(),
      criadaEm: new Date().toISOString(),
    }
    setReceitas(prev => [nova, ...prev])
    return nova
  }

  function atualizar(id, changes) {
    setReceitas(prev => prev.map(r => (r.id === id ? { ...r, ...changes } : r)))
  }

  function remover(id) {
    setReceitas(prev => prev.filter(r => r.id !== id))
  }

  return { receitas, adicionar, atualizar, remover }
}
