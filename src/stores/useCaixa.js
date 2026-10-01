import { useEffect, useMemo, useState } from 'react'
import { useData } from './DataProvider'
import { supabase } from '../lib/supabase'

/**
 * caixa: {
 *   id, dia (YYYY-MM-DD), eventId?,
 *   abertoEm, abertoPor, fundoInicial, contagemInicial: [{ nome, qty }],
 *   fechadoEm?, fechadoPor, dinheiroContado?, contagemFinal: [{ nome, qty }],
 *   notas
 * }
 *
 * O dinheiro esperado não se grava: sai das vendas em dinheiro entre a
 * abertura e o fecho (resumoCaixa), por isso bate sempre com o POS.
 */

/** O que se conta ao abrir, enquanto não houver um caixa anterior para copiar. */
export const ITENS_PADRAO = ['Mini cookies', 'Embalagens']

const hoje = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const fmtHora = (iso) =>
  iso ? new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : '—'

export const fmtDia = (dia) =>
  dia
    ? new Date(dia + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short', day: '2-digit', month: '2-digit' })
    : '—'

// Datas comparadas como números: as que vêm do banco ('+00:00') e as criadas
// no aparelho ('Z') não se ordenam bem como texto.
const ms = (iso) => (iso ? Date.parse(iso) : NaN)

export function vendasDoCaixa(caixa, sales) {
  if (!caixa) return []
  const ini = ms(caixa.abertoEm)
  const fim = caixa.fechadoEm ? ms(caixa.fechadoEm) : Infinity
  return sales.filter((s) => {
    const t = ms(s.createdAt)
    return t >= ini && t <= fim
  })
}

export function resumoCaixa(caixa, sales) {
  const vendas = vendasDoCaixa(caixa, sales).filter((s) => (s.totalEur ?? 0) > 0)
  const porPagamento = {}
  for (const s of vendas) {
    const p = s.paymentId ?? 'outro'
    porPagamento[p] = porPagamento[p] ?? { count: 0, eur: 0 }
    porPagamento[p].count += 1
    porPagamento[p].eur += s.totalEur ?? 0
  }
  const dinheiro = porPagamento.dinheiro?.eur ?? 0
  const fundo = Number(caixa?.fundoInicial) || 0
  const esperado = fundo + dinheiro
  const contado = caixa?.dinheiroContado
  return {
    vendas: vendas.length,
    total: vendas.reduce((s, v) => s + (v.totalEur ?? 0), 0),
    porPagamento,
    dinheiro,
    esperado,
    diferenca: contado == null ? null : Math.round((contado - esperado) * 100) / 100,
  }
}

/** Junta a contagem de abertura com a de fecho, item a item. */
export function contagemComparada(caixa) {
  const finais = new Map((caixa?.contagemFinal ?? []).map((x) => [x.nome, x.qty]))
  return (caixa?.contagemInicial ?? []).map((x) => {
    const sobrou = finais.has(x.nome) ? finais.get(x.nome) : null
    return {
      nome: x.nome,
      levou: x.qty,
      sobrou,
      usou: sobrou == null || x.qty == null ? null : x.qty - sobrou,
    }
  })
}

export function useCaixa() {
  const { caixas, caixasDisponivel, createRow, updateRow, removeRow } = useData()
  const [email, setEmail] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? ''))
  }, [])

  /** O caixa aberto mais recente — de hoje ou esquecido de outro dia. */
  const caixaAberto = useMemo(
    () => caixas.find((c) => !c.fechadoEm) ?? null,
    [caixas],
  )

  /** Ponto de partida para abrir: nomes, sobras e troco do último caixa. */
  const sugestaoAbertura = useMemo(() => {
    const ultimo = caixas[0]
    if (!ultimo) {
      return { fundoInicial: '', itens: ITENS_PADRAO.map((nome) => ({ nome, qty: '' })) }
    }
    const sobras = new Map((ultimo.contagemFinal ?? []).map((x) => [x.nome, x.qty]))
    const nomes = (ultimo.contagemInicial ?? []).map((x) => x.nome)
    return {
      fundoInicial: ultimo.fundoInicial ? String(ultimo.fundoInicial) : '',
      itens: (nomes.length ? nomes : ITENS_PADRAO).map((nome) => ({
        nome,
        qty: sobras.get(nome) != null ? String(sobras.get(nome)) : '',
      })),
    }
  }, [caixas])

  function abrir({ fundoInicial, itens, eventId }) {
    return createRow('caixas', {
      dia: hoje(),
      eventId: eventId ?? null,
      abertoEm: new Date().toISOString(),
      abertoPor: email,
      fundoInicial: Number(fundoInicial) || 0,
      contagemInicial: limparItens(itens),
      fechadoEm: null,
      fechadoPor: '',
      dinheiroContado: null,
      contagemFinal: [],
      notas: '',
    })
  }

  function fechar(id, { dinheiroContado, itens, notas }) {
    updateRow('caixas', id, {
      fechadoEm: new Date().toISOString(),
      fechadoPor: email,
      dinheiroContado: Number(dinheiroContado) || 0,
      contagemFinal: limparItens(itens),
      notas: (notas ?? '').trim(),
    })
  }

  return {
    caixas,
    caixasDisponivel,
    caixaAberto,
    sugestaoAbertura,
    abrir,
    fechar,
    reabrir: (id) => updateRow('caixas', id, { fechadoEm: null, fechadoPor: '', dinheiroContado: null }),
    remover: (id) => removeRow('caixas', id),
  }
}

function limparItens(itens) {
  return (itens ?? [])
    .map((x) => ({ nome: String(x.nome ?? '').trim(), qty: x.qty === '' || x.qty == null ? null : Number(x.qty) }))
    .filter((x) => x.nome)
}
