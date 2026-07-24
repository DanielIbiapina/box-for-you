import { useStorage } from './useStorage'
import { CUSTOS_FIXOS_SEED } from '../lib/financeiroCategorias'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * despesa: {
 *   id, data (YYYY-MM-DD), categoria, valorEur, descricao,
 *   pago (bool), origem ('manual'|'inscricao-evento'|'custo-fixo'),
 *   eventId?, custoFixoId?, mesRef? (YYYY-MM)
 * }
 *
 * custoFixo template: { id, nome, valorPadrao }
 */

export function useFinanceiro() {
  const [despesas, setDespesas] = useStorage('bfy:despesas', [])
  const [custosFixos, setCustosFixos] = useStorage('bfy:custos-fixos', CUSTOS_FIXOS_SEED)

  function adicionarDespesa(dados) {
    const nova = {
      id: uid(),
      data: dados.data ?? new Date().toISOString().slice(0, 10),
      categoria: dados.categoria ?? 'outro',
      valorEur: Number(dados.valorEur) || 0,
      descricao: (dados.descricao ?? '').trim(),
      pago: dados.pago !== false,
      origem: dados.origem ?? 'manual',
      eventId: dados.eventId ?? null,
      custoFixoId: dados.custoFixoId ?? null,
      mesRef: dados.mesRef ?? null,
    }
    setDespesas((prev) => [nova, ...prev])
    return nova
  }

  function atualizarDespesa(id, changes) {
    setDespesas((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)))
  }

  function removerDespesa(id) {
    setDespesas((prev) => prev.filter((d) => d.id !== id))
  }

  function removerDespesasPorEvento(eventId) {
    setDespesas((prev) => prev.filter((d) => d.eventId !== eventId || d.origem !== 'inscricao-evento'))
  }

  /** Cria ou atualiza a despesa espelhada da inscrição do evento */
  function syncInscricaoEvento(evento) {
    if (!evento?.id) return
    const taxa = Number(evento.taxaInscricao) || 0
    setDespesas((prev) => {
      const existing = prev.find(
        (d) => d.origem === 'inscricao-evento' && d.eventId === evento.id,
      )
      if (taxa <= 0) {
        return existing ? prev.filter((d) => d.id !== existing.id) : prev
      }
      const data = evento.data || new Date().toISOString().slice(0, 10)
      const descricao = `Inscrição — ${evento.nome || 'Feira'}`
      if (existing) {
        return prev.map((d) =>
          d.id === existing.id
            ? {
                ...d,
                valorEur: taxa,
                data,
                descricao,
                categoria: 'inscricao',
                pago: true,
                mesRef: data.slice(0, 7),
              }
            : d,
        )
      }
      return [
        {
          id: uid(),
          data,
          categoria: 'inscricao',
          valorEur: taxa,
          descricao,
          pago: true,
          origem: 'inscricao-evento',
          eventId: evento.id,
          custoFixoId: null,
          mesRef: data.slice(0, 7),
        },
        ...prev,
      ]
    })
  }

  function atualizarCustoFixo(id, changes) {
    setCustosFixos((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }

  function adicionarCustoFixo(dados) {
    const novo = {
      id: uid(),
      nome: (dados.nome ?? '').trim() || 'Novo custo',
      valorPadrao: Number(dados.valorPadrao) || 0,
    }
    setCustosFixos((prev) => [...prev, novo])
    return novo
  }

  function removerCustoFixo(id) {
    setCustosFixos((prev) => prev.filter((c) => c.id !== id))
    setDespesas((prev) =>
      prev.filter((d) => !(d.origem === 'custo-fixo' && d.custoFixoId === id)),
    )
  }

  /** Despesa de custo fixo para um mês (YYYY-MM), se existir */
  function despesaCustoFixoMes(custoFixoId, mesRef) {
    return despesas.find(
      (d) =>
        d.origem === 'custo-fixo' &&
        d.custoFixoId === custoFixoId &&
        d.mesRef === mesRef,
    ) ?? null
  }

  function setCustoFixoPago(custoFixo, mesRef, pago, valorOverride) {
    const valor = valorOverride != null
      ? Number(valorOverride) || 0
      : Number(custoFixo.valorPadrao) || 0
    const data = `${mesRef}-01`

    setDespesas((prev) => {
      const existing = prev.find(
        (d) =>
          d.origem === 'custo-fixo' &&
          d.custoFixoId === custoFixo.id &&
          d.mesRef === mesRef,
      )
      if (!pago) {
        return existing ? prev.filter((d) => d.id !== existing.id) : prev
      }
      if (existing) {
        return prev.map((d) =>
          d.id === existing.id
            ? {
                ...d,
                pago: true,
                valorEur: valor,
                data,
                descricao: custoFixo.nome,
                categoria: 'custo-fixo',
              }
            : d,
        )
      }
      return [
        {
          id: uid(),
          data,
          categoria: 'custo-fixo',
          valorEur: valor,
          descricao: custoFixo.nome,
          pago: true,
          origem: 'custo-fixo',
          eventId: null,
          custoFixoId: custoFixo.id,
          mesRef,
        },
        ...prev,
      ]
    })
  }

  function atualizarValorCustoFixoMes(custoFixo, mesRef, valorEur) {
    const valor = Number(valorEur) || 0
    setDespesas((prev) => {
      const existing = prev.find(
        (d) =>
          d.origem === 'custo-fixo' &&
          d.custoFixoId === custoFixo.id &&
          d.mesRef === mesRef,
      )
      if (!existing) return prev
      return prev.map((d) =>
        d.id === existing.id ? { ...d, valorEur: valor } : d,
      )
    })
    atualizarCustoFixo(custoFixo.id, { valorPadrao: valor })
  }

  return {
    despesas,
    custosFixos,
    adicionarDespesa,
    atualizarDespesa,
    removerDespesa,
    removerDespesasPorEvento,
    syncInscricaoEvento,
    atualizarCustoFixo,
    adicionarCustoFixo,
    removerCustoFixo,
    despesaCustoFixoMes,
    setCustoFixoPago,
    atualizarValorCustoFixoMes,
  }
}
