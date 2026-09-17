import { converterQtd } from '../stores/useEstoque'

export function tipoComponente(r) {
  if (!r?.ehReceitaBase) return 'cookie'
  if (r.categoria === 'recheio') return 'recheio'
  return 'base'
}

export function nestedReceitaId(ing) {
  if (!ing) return null
  if (ing.tipo === 'base' || ing.tipo === 'recheio' || ing.tipo === 'receita') {
    return ing.receitaBaseId || ing.receitaId || null
  }
  return ing.receitaBaseId || null
}

function qtdUsadaNoRendimento(ing, sub) {
  const qtd = parseFloat(ing.quantidade) || 0
  if (tipoComponente(sub) === 'cookie') return qtd
  const convertida = converterQtd(qtd, ing.unidade || 'g', 'g')
  return convertida || qtd
}

/**
 * Abre receitas-dentro-de-receitas (massa base, recheio) nos ingredientes
 * de stock, na proporção quantidade usada ÷ rendimento da sub-receita.
 */
export function expandirIngredientes(ings, fator, receitas, opts = {}) {
  const seen = opts.seen ?? new Set()
  const resultado = []
  for (const ing of ings ?? []) {
    const subId = nestedReceitaId(ing)
    if (subId) {
      if (seen.has(subId)) continue
      const sub = (receitas ?? []).find((r) => r.id === subId)
      const rend = parseFloat(sub?.rendimento) || 0
      if (sub && rend > 0) {
        const proporcao = (qtdUsadaNoRendimento(ing, sub) / rend) * fator
        const nextSeen = new Set(seen)
        nextSeen.add(subId)
        const inner = expandirIngredientes(sub.ingredientes, proporcao, receitas, {
          seen: nextSeen,
          origem: sub.nome,
        })
        for (const item of inner) {
          resultado.push({ ...item, _daBase: item._daBase || sub.nome })
        }
      } else {
        resultado.push({
          nome: ing.nome,
          quantidade: (parseFloat(ing.quantidade) || 0) * fator,
          unidade: ing.unidade,
          ingredienteId: null,
          _daBase: ing.nome,
        })
      }
    } else {
      resultado.push({
        ...ing,
        quantidade: (parseFloat(ing.quantidade) || 0) * fator,
        _daBase: ing._daBase || opts.origem,
      })
    }
  }
  return resultado
}

export function agruparIngredientes(lista) {
  const mapa = {}
  for (const ing of lista ?? []) {
    const key = ing.ingredienteId
      ? `${ing.ingredienteId}|${ing.unidade || ''}`
      : `nome:${ing.nome || ''}|${ing.unidade || ''}`
    if (!mapa[key]) {
      mapa[key] = { ...ing, quantidade: 0, origens: [] }
    }
    mapa[key].quantidade += parseFloat(ing.quantidade) || 0
    if (ing._daBase && !mapa[key].origens.includes(ing._daBase)) {
      mapa[key].origens.push(ing._daBase)
    }
  }
  return Object.values(mapa).map((i) => ({
    ...i,
    _daBase: i.origens.length ? i.origens.join(', ') : i._daBase,
  }))
}

export function custoIngredientesReceita(receita, receitas, estoque) {
  if (!receita) return 0
  const expandidos = expandirIngredientes(receita.ingredientes, 1, receitas)
  let total = 0
  for (const ing of expandidos) {
    const est = ing.ingredienteId
      ? (estoque ?? []).find((i) => i.id === ing.ingredienteId)
      : null
    if (!est?.custoPorUnidade) continue
    const qtd = converterQtd(ing.quantidade, ing.unidade || est.unidade, est.unidade)
      || (parseFloat(ing.quantidade) || 0)
    total += est.custoPorUnidade * qtd
  }
  return total
}
