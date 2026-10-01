import { useEffect, useRef } from 'react'
import { useData } from '../stores/DataProvider'
import { idInscricao, linhaInscricao } from '../stores/useFinanceiro'
import { inscricoesEmFalta } from '../lib/contas'

/**
 * Garante que toda a feira com taxa de inscrição tem a sua saída.
 *
 * A saída nasce quando a feira é guardada em Definições. Até 24/09/2026 essa
 * gravação podia perder-se (ia ao banco ao mesmo tempo que a feira e, se
 * chegasse primeiro, era recusada) — e oito dias de setembro ficaram sem
 * saída sem ninguém dar por isso. A fila já grava tudo por ordem; isto é a
 * segunda proteção: se alguma vez faltar uma, é criada aqui.
 *
 * - Só corre na conta da dona (a conta "feira" nem vê as despesas).
 * - Espera uns segundos depois de os dados mudarem, para dar tempo a que a
 *   feira e a saída criadas noutro aparelho cheguem as duas.
 * - Tenta cada feira uma vez por sessão; o id fixo impede duplicados.
 * - Só feiras a partir de agosto/2026: antes disso as inscrições podem ter
 *   sido lançadas à mão, noutra data, e não queremos duplicar.
 */
const DESDE = '2026-08-01'
const ESPERA_MS = 5000

export function GuardaInscricoes() {
  const { eventos, despesas, createRow } = useData()
  const tentadas = useRef(new Set())

  useEffect(() => {
    const t = setTimeout(() => {
      const faltam = inscricoesEmFalta(eventos.filter((ev) => ev.data >= DESDE), despesas)
        .filter((ev) => !tentadas.current.has(ev.id))
      for (const ev of faltam) {
        tentadas.current.add(ev.id)
        createRow('despesas', { id: idInscricao(ev.id), ...linhaInscricao(ev) })
      }
      if (faltam.length) {
        console.warn('[inscrições] saídas em falta criadas:', faltam.map((ev) => `${ev.data} ${ev.nome}`))
      }
    }, ESPERA_MS)
    return () => clearTimeout(t)
  }, [eventos, despesas, createRow])

  return null
}
