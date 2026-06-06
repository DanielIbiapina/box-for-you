import { useStorage } from './useStorage'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const UNIDADES = ['g', 'kg', 'ml', 'L', 'unidade', 'colher (sopa)', 'colher (chá)', 'xícara']

export function useEstoque() {
  const [ingredientes, setIngredientes] = useStorage('bfy:ingredientes', [])
  const [movimentacoes, setMovimentacoes] = useStorage('bfy:movimentacoes', [])

  function adicionarIngrediente(dados) {
    const novo = { ...dados, id: uid(), estoqueAtual: dados.estoqueAtual ?? 0 }
    setIngredientes(prev => [novo, ...prev])
    return novo
  }

  function atualizarIngrediente(id, changes) {
    setIngredientes(prev => prev.map(i => (i.id === id ? { ...i, ...changes } : i)))
  }

  function removerIngrediente(id) {
    setIngredientes(prev => prev.filter(i => i.id !== id))
    setMovimentacoes(prev => prev.filter(m => m.ingredienteId !== id))
  }

  function registrarMovimentacao(mov) {
    const nova = { ...mov, id: uid(), data: new Date().toISOString() }
    setMovimentacoes(prev => [nova, ...prev])
    setIngredientes(prev =>
      prev.map(i => {
        if (i.id !== mov.ingredienteId) return i
        const delta = mov.tipo === 'entrada' ? mov.quantidade : -mov.quantidade
        return { ...i, estoqueAtual: Math.max(0, (i.estoqueAtual ?? 0) + delta) }
      }),
    )
  }

  function baixarEstoqueProducao(itens, motivo = 'Produção') {
    const timestamp = new Date().toISOString()
    const novasMovs = itens
      .filter((item) => item.ingredienteId)
      .map((item) => ({
        id: uid(),
        ingredienteId: item.ingredienteId,
        tipo: 'saida',
        quantidade: item.quantidade,
        motivo,
        data: timestamp,
      }))
    if (novasMovs.length === 0) return
    setMovimentacoes((prev) => [...novasMovs, ...prev])
    setIngredientes((prev) =>
      prev.map((ing) => {
        const mov = novasMovs.find((m) => m.ingredienteId === ing.id)
        if (!mov) return ing
        return { ...ing, estoqueAtual: Math.max(0, parseFloat(((ing.estoqueAtual ?? 0) - mov.quantidade).toFixed(4))) }
      }),
    )
  }

  function statusIngrediente(ing) {
    if ((ing.estoqueAtual ?? 0) <= 0) return 'critico'
    if (ing.estoqueMinimo && ing.estoqueAtual < ing.estoqueMinimo) return 'baixo'
    return 'ok'
  }

  return {
    ingredientes,
    movimentacoes,
    adicionarIngrediente,
    atualizarIngrediente,
    removerIngrediente,
    registrarMovimentacao,
    baixarEstoqueProducao,
    statusIngrediente,
  }
}
