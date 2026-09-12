// Mapeadores DB (snake_case) ↔ App (camelCase).
// Importante: colunas `numeric` chegam do PostgREST como STRING — por isso
// coagimos os campos numéricos para Number no caminho de volta (toApp).

function makeMapper(map, nums = []) {
  const numSet = new Set(nums)
  return {
    toApp(row) {
      if (!row) return row
      const o = {}
      for (const [appKey, dbKey] of Object.entries(map)) {
        let v = row[dbKey]
        if (numSet.has(appKey) && v != null && v !== '') v = Number(v)
        o[appKey] = v
      }
      return o
    },
    toRow(obj) {
      const r = {}
      for (const [appKey, dbKey] of Object.entries(map)) {
        if (obj[appKey] !== undefined) r[dbKey] = obj[appKey]
      }
      return r
    },
  }
}

export const MAPPERS = {
  receitas: makeMapper(
    {
      id: 'id', nome: 'nome', emoji: 'emoji', categoria: 'categoria',
      descricao: 'descricao', observacoes: 'observacoes', rendimento: 'rendimento',
      tempoForno: 'tempo_forno', tempoPreparo: 'tempo_preparo',
      cookieDoMes: 'cookie_do_mes', ehReceitaBase: 'eh_receita_base',
      ingredientes: 'ingredientes', criadaEm: 'criada_em',
    },
    ['rendimento', 'tempoForno', 'tempoPreparo'],
  ),
  ingredientes: makeMapper(
    {
      id: 'id', nome: 'nome', unidade: 'unidade',
      estoqueAtual: 'estoque_atual', estoqueMinimo: 'estoque_minimo',
      custoPorUnidade: 'custo_por_unidade',
    },
    ['estoqueAtual', 'estoqueMinimo', 'custoPorUnidade'],
  ),
  movimentacoes: makeMapper(
    {
      id: 'id', ingredienteId: 'ingrediente_id', tipo: 'tipo',
      quantidade: 'quantidade', motivo: 'motivo', data: 'data',
    },
    ['quantidade'],
  ),
  eventos: makeMapper(
    { id: 'id', nome: 'nome', local: 'local', data: 'data', status: 'status', taxaInscricao: 'taxa_inscricao' },
    ['taxaInscricao'],
  ),
  clientes: makeMapper(
    { id: 'id', nome: 'nome', telefone: 'telefone', instagram: 'instagram', email: 'email', notas: 'notas', criadoEm: 'criado_em' },
  ),
  vendas: makeMapper(
    {
      id: 'id', kind: 'kind', lines: 'lines', flavorId: 'flavor_id', demoFlavorId: 'demo_flavor_id',
      boxFlavors: 'box_flavors', paymentId: 'payment_id',
      totalEur: 'total_eur', desconto: 'desconto', eventId: 'event_id', createdAt: 'created_at',
    },
    ['totalEur', 'desconto'],
  ),
      pedidos: makeMapper(
        {
          id: 'id', clienteId: 'cliente_id', linhas: 'linhas', box: 'box',
          totalEur: 'total_eur', desconto: 'desconto', dataPedido: 'data_pedido',
          formaPagamento: 'forma_pagamento', status: 'status', notas: 'notas', criadoEm: 'criado_em',
          origem: 'origem', referencia: 'referencia', entrega: 'entrega',
        },
        ['totalEur', 'desconto'],
      ),
  custos_fixos: makeMapper(
    { id: 'id', nome: 'nome', valorPadrao: 'valor_padrao' },
    ['valorPadrao'],
  ),
  despesas: makeMapper(
    {
      id: 'id', data: 'data', categoria: 'categoria', valorEur: 'valor_eur',
      descricao: 'descricao', pago: 'pago', origem: 'origem',
      eventId: 'event_id', custoFixoId: 'custo_fixo_id', mesRef: 'mes_ref',
    },
    ['valorEur'],
  ),
  cookies_catalogo: makeMapper(
    { id: 'id', nome: 'nome', short: 'short', emoji: 'emoji', price: 'price', image: 'image', ativoNoCardapio: 'ativo_no_cardapio' },
    ['price'],
  ),
}

// ── Config (singleton) ──────────────────────────────────────────────────────
export function configToApp(row) {
  return {
    nomeNegocio: row?.nome_negocio ?? 'Box for You',
    nomeProprietaria: row?.nome_proprietaria ?? '',
    moeda: row?.moeda ?? '€',
    metaLucroMensal: Number(row?.meta_lucro_mensal ?? 0),
    formasPagamento: row?.formas_pagamento ?? [],
    instrucoesLevantamento: row?.loja_instrucoes_levantamento ?? '',
    instrucoesEntrega: row?.loja_instrucoes_entrega ?? '',
  }
}
export function configToRow(patch) {
  const r = {}
  if (patch.nomeNegocio !== undefined) r.nome_negocio = patch.nomeNegocio
  if (patch.nomeProprietaria !== undefined) r.nome_proprietaria = patch.nomeProprietaria
  if (patch.moeda !== undefined) r.moeda = patch.moeda
  if (patch.metaLucroMensal !== undefined) r.meta_lucro_mensal = patch.metaLucroMensal
  if (patch.formasPagamento !== undefined) r.formas_pagamento = patch.formasPagamento
  if (patch.instrucoesLevantamento !== undefined) r.loja_instrucoes_levantamento = patch.instrucoesLevantamento
  if (patch.instrucoesEntrega !== undefined) r.loja_instrucoes_entrega = patch.instrucoesEntrega
  return r
}
