import { useData } from './DataProvider'

export const UNIDADES = ['g', 'kg', 'ml', 'L', 'unidade', 'colher (sopa)', 'colher (chá)', 'xícara']

export function useEstoque() {
  const { ingredientes, movimentacoes, createRow, updateRow, removeRow } = useData()

  function adicionarIngrediente(dados) {
    return createRow('ingredientes', { ...dados, estoqueAtual: dados.estoqueAtual ?? 0 })
  }

  function atualizarIngrediente(id, changes) {
    updateRow('ingredientes', id, changes)
  }

  function removerIngrediente(id) {
    // a FK no banco já apaga as movimentações em cascata; removemos localmente também
    movimentacoes.filter((m) => m.ingredienteId === id).forEach((m) => removeRow('movimentacoes', m.id))
    removeRow('ingredientes', id)
  }

  function registrarMovimentacao(mov) {
    createRow('movimentacoes', { ...mov, data: new Date().toISOString() })
    const ing = ingredientes.find((i) => i.id === mov.ingredienteId)
    if (ing) {
      const delta = mov.tipo === 'entrada' ? mov.quantidade : -mov.quantidade
      updateRow('ingredientes', ing.id, { estoqueAtual: Math.max(0, (ing.estoqueAtual ?? 0) + delta) })
    }
  }

  function baixarEstoqueProducao(itens, motivo = 'Produção') {
    const timestamp = new Date().toISOString()
    const validos = itens.filter((item) => item.ingredienteId)
    if (validos.length === 0) return
    for (const item of validos) {
      createRow('movimentacoes', {
        ingredienteId: item.ingredienteId,
        tipo: 'saida',
        quantidade: item.quantidade,
        motivo,
        data: timestamp,
      })
      const ing = ingredientes.find((i) => i.id === item.ingredienteId)
      if (ing) {
        updateRow('ingredientes', ing.id, {
          estoqueAtual: Math.max(0, parseFloat(((ing.estoqueAtual ?? 0) - item.quantidade).toFixed(4))),
        })
      }
    }
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
