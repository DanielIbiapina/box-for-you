import { todayKey } from './salesAnalytics'

/**
 * As regras das contas do mês, num sítio só. Início, Entradas e Saídas e
 * Relatórios usam todos estas funções — antes cada página fazia a sua conta
 * (uma somava saídas por pagar, outra não descontava a taxa Multibanco, outra
 * punha as encomendas no mês em que foram registadas) e os números não batiam.
 *
 * - Venda do POS: conta no mês LOCAL em que foi feita (a das 00:30 do dia 1
 *   é do mês novo, não do anterior por causa do fuso).
 * - Encomenda: conta no mês da data do pedido; sem data, no da criação.
 *   Canceladas não contam.
 * - Saída: conta no mês a que se refere, e só se já estiver paga.
 * - Multibanco: a entrada líquida desconta ~1,5% de taxa.
 */

export const TAXA_MULTIBANCO = 0.015

/** Mês local (YYYY-MM) de um instante ISO. */
export function mesLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? String(iso).slice(0, 7) : todayKey(d).slice(0, 7)
}

export const mesDaVenda = (s) => mesLocal(s?.createdAt)
export const mesDoPedido = (p) => (p?.dataPedido ? String(p.dataPedido).slice(0, 7) : mesLocal(p?.criadoEm))
export const mesDaDespesa = (d) => d?.mesRef || String(d?.data ?? '').slice(0, 7)

const soma = (lista, campo) => lista.reduce((s, x) => s + (Number(x[campo]) || 0), 0)

export function contasDoMes({ sales = [], pedidos = [], despesas = [] }, mes) {
  const pos = sales.filter((s) => mesDaVenda(s) === mes && (s.totalEur ?? 0) > 0)
  const diretas = pedidos.filter(
    (p) => p.status !== 'cancelado' && mesDoPedido(p) === mes && (p.totalEur ?? 0) > 0,
  )
  const saidas = despesas.filter((d) => mesDaDespesa(d) === mes && d.pago !== false)
  const porPagar = despesas.filter((d) => mesDaDespesa(d) === mes && d.pago === false)

  const totalPos = soma(pos, 'totalEur')
  const totalDiretas = soma(diretas, 'totalEur')
  const multibanco =
    soma(pos.filter((s) => s.paymentId === 'multibanco'), 'totalEur') +
    soma(diretas.filter((p) => p.formaPagamento === 'Multibanco'), 'totalEur')
  const taxaMultibanco = Math.round(multibanco * TAXA_MULTIBANCO * 100) / 100
  const bruto = totalPos + totalDiretas
  const entradas = bruto - taxaMultibanco
  const totalSaidas = soma(saidas, 'valorEur')

  return {
    pos, diretas, saidas, porPagar,
    totalPos, totalDiretas, bruto,
    multibanco, taxaMultibanco,
    entradas,
    totalSaidas,
    totalPorPagar: soma(porPagar, 'valorEur'),
    balanco: entradas - totalSaidas,
  }
}

/**
 * Feiras com taxa de inscrição que não têm a saída correspondente.
 * Conta como "tem" a saída automática da feira ou uma saída de inscrição
 * lançada à mão no mesmo dia e com o mesmo valor (para não duplicar).
 */
export function inscricoesEmFalta(eventos = [], despesas = []) {
  return eventos
    .filter((ev) => (Number(ev.taxaInscricao) || 0) > 0 && ev.data)
    .filter((ev) => !despesas.some((d) =>
      (d.origem === 'inscricao-evento' && d.eventId === ev.id) ||
      (d.categoria === 'inscricao' && d.data === ev.data &&
        Math.abs((Number(d.valorEur) || 0) - Number(ev.taxaInscricao)) < 0.005),
    ))
    .sort((a, b) => a.data.localeCompare(b.data))
}
