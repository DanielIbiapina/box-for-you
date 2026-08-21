import { useData } from './DataProvider'

export const CATEGORIAS = [
  { id: 'classico', label: 'Clássico',         gradient: 'linear-gradient(135deg,#C24B29 0%,#E07B5A 100%)' },
  { id: 'sazonal',  label: 'Sazonal & Especial', gradient: 'linear-gradient(135deg,#1D1008 0%,#4A2812 100%)' },
]

export function useReceitas() {
  const { receitas, createRow, updateRow, removeRow } = useData()

  return {
    receitas,
    adicionar: (dados) => createRow('receitas', { ...dados, criadaEm: new Date().toISOString() }),
    atualizar: (id, changes) => updateRow('receitas', id, changes),
    remover: (id) => removeRow('receitas', id),
  }
}
