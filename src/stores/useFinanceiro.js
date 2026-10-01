import { useData } from './DataProvider'
import { todayKey } from '../lib/salesAnalytics'

/**
 * A saída da inscrição de uma feira tem um id fixo, tirado do id da feira:
 * se dois aparelhos (ou duas tentativas) a criarem, é a mesma linha — o banco
 * recusa a repetida e a fila trata isso como "já gravado". Nunca duplica.
 */
export const idInscricao = (eventId) => `inscricao-${eventId}`

export function linhaInscricao(evento) {
  const data = evento.data || todayKey()
  return {
    data,
    categoria: 'inscricao',
    valorEur: Number(evento.taxaInscricao) || 0,
    descricao: `Inscrição — ${evento.nome || 'Feira'}`,
    pago: true,
    origem: 'inscricao-evento',
    eventId: evento.id,
    custoFixoId: null,
    mesRef: data.slice(0, 7),
  }
}

/**
 * despesa: {
 *   id, data (YYYY-MM-DD), categoria, valorEur, descricao,
 *   pago (bool), origem ('manual'|'inscricao-evento'|'custo-fixo'),
 *   eventId?, custoFixoId?, mesRef? (YYYY-MM)
 * }
 * custoFixo template: { id, nome, valorPadrao }
 */

export function useFinanceiro() {
  const { despesas, custosFixos, createRow, updateRow, removeRow } = useData()

  function adicionarDespesa(dados) {
    return createRow('despesas', {
      data: dados.data ?? todayKey(),
      categoria: dados.categoria ?? 'outro',
      valorEur: Number(dados.valorEur) || 0,
      descricao: (dados.descricao ?? '').trim(),
      pago: dados.pago !== false,
      origem: dados.origem ?? 'manual',
      eventId: dados.eventId ?? null,
      custoFixoId: dados.custoFixoId ?? null,
      mesRef: dados.mesRef ?? null,
    })
  }

  function atualizarDespesa(id, changes) {
    updateRow('despesas', id, changes)
  }

  function removerDespesa(id) {
    removeRow('despesas', id)
  }

  function removerDespesasPorEvento(eventId) {
    despesas
      .filter((d) => d.eventId === eventId && d.origem === 'inscricao-evento')
      .forEach((d) => removeRow('despesas', d.id))
  }

  /** Cria ou atualiza a despesa espelhada da inscrição do evento */
  function syncInscricaoEvento(evento) {
    if (!evento?.id) return
    const taxa = Number(evento.taxaInscricao) || 0
    const existing = despesas.find((d) => d.origem === 'inscricao-evento' && d.eventId === evento.id)

    if (taxa <= 0) {
      if (existing) removeRow('despesas', existing.id)
      return
    }
    const { valorEur, data, descricao, categoria, pago, mesRef } = linhaInscricao(evento)
    if (existing) {
      updateRow('despesas', existing.id, { valorEur, data, descricao, categoria, pago, mesRef })
    } else {
      createRow('despesas', { id: idInscricao(evento.id), ...linhaInscricao(evento) })
    }
  }

  function atualizarCustoFixo(id, changes) {
    updateRow('custos_fixos', id, changes)
  }

  function adicionarCustoFixo(dados) {
    return createRow('custos_fixos', {
      nome: (dados.nome ?? '').trim() || 'Novo custo',
      valorPadrao: Number(dados.valorPadrao) || 0,
    })
  }

  function removerCustoFixo(id) {
    removeRow('custos_fixos', id)
    despesas
      .filter((d) => d.origem === 'custo-fixo' && d.custoFixoId === id)
      .forEach((d) => removeRow('despesas', d.id))
  }

  /** Despesa de custo fixo para um mês (YYYY-MM), se existir */
  function despesaCustoFixoMes(custoFixoId, mesRef) {
    return despesas.find(
      (d) => d.origem === 'custo-fixo' && d.custoFixoId === custoFixoId && d.mesRef === mesRef,
    ) ?? null
  }

  function setCustoFixoPago(custoFixo, mesRef, pago, valorOverride) {
    const valor = valorOverride != null ? Number(valorOverride) || 0 : Number(custoFixo.valorPadrao) || 0
    const data = `${mesRef}-01`
    const existing = despesas.find(
      (d) => d.origem === 'custo-fixo' && d.custoFixoId === custoFixo.id && d.mesRef === mesRef,
    )
    if (!pago) {
      if (existing) removeRow('despesas', existing.id)
      return
    }
    if (existing) {
      updateRow('despesas', existing.id, {
        pago: true, valorEur: valor, data, descricao: custoFixo.nome, categoria: 'custo-fixo',
      })
    } else {
      createRow('despesas', {
        data, categoria: 'custo-fixo', valorEur: valor, descricao: custoFixo.nome, pago: true,
        origem: 'custo-fixo', eventId: null, custoFixoId: custoFixo.id, mesRef,
      })
    }
  }

  function atualizarValorCustoFixoMes(custoFixo, mesRef, valorEur) {
    const valor = Number(valorEur) || 0
    const existing = despesas.find(
      (d) => d.origem === 'custo-fixo' && d.custoFixoId === custoFixo.id && d.mesRef === mesRef,
    )
    if (existing) updateRow('despesas', existing.id, { valorEur: valor })
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
