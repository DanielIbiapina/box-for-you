import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'

/**
 * Horários do levantamento/entrega na loja: faixas de 1 hora (ex.: 14h–15h)
 * entre a hora de abrir e a de fechar. A primeira faixa que o cliente vê
 * começa pelo menos `antecedenciaHoras` depois do pedido.
 * O servidor confirma a mesma regra (supabase/loja.sql).
 */
const HORAS = Array.from({ length: 25 }, (_, h) => h)

export function Horarios() {
  const { config, update } = useConfiguracoes()
  const disponivel = config.horariosDisponivel !== false
  const h = config.horarios ?? {}
  const [abre, setAbre] = useState(Number.isFinite(h.abre) ? h.abre : 10)
  const [fecha, setFecha] = useState(Number.isFinite(h.fecha) ? h.fecha : 20)
  const [antecedencia, setAntecedencia] = useState(String(h.antecedenciaHoras ?? 2))
  const [msg, setMsg] = useState(null)

  const antec = parseFloat(String(antecedencia).replace(',', '.'))
  const faixas = fecha > abre ? fecha - abre : 0

  function guardar() {
    if (fecha <= abre) return setMsg({ tipo: 'erro', texto: 'A hora de fechar tem de ser depois da de abrir.' })
    if (!(antec >= 0 && antec <= 72)) return setMsg({ tipo: 'erro', texto: 'A antecedência tem de ser entre 0 e 72 horas.' })
    update({ horarios: { abre, fecha, antecedenciaHoras: antec } })
    setMsg({ tipo: 'ok', texto: 'Guardado. A loja já mostra estes horários.' })
  }

  return (
    <div className="bfy-card p-6 mb-5 space-y-4">
      <div>
        <h2 className="text-base font-bold bfy-card-title">Horários de levantamento e entrega</h2>
        <p className="text-xs ink-3 mt-1">
          O cliente escolhe uma faixa de 1 hora. A primeira que aparece começa pelo menos{' '}
          {Number.isFinite(antec) ? String(antec).replace('.', ',') : '…'} h depois do pedido.
        </p>
      </div>

      {!disponivel ? (
        <p className="bfy-sunk p-3 text-sm ink-2">
          Para mudar os horários, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="bfy-label">Abre</span>
              <select className="bfy-input" value={abre} onChange={(e) => setAbre(Number(e.target.value))}>
                {HORAS.slice(0, 24).map((x) => <option key={x} value={x}>{x}h</option>)}
              </select>
            </label>
            <label className="block">
              <span className="bfy-label">Fecha</span>
              <select className="bfy-input" value={fecha} onChange={(e) => setFecha(Number(e.target.value))}>
                {HORAS.slice(1).map((x) => <option key={x} value={x}>{x}h</option>)}
              </select>
            </label>
            <label className="block">
              <span className="bfy-label">Antecedência (h)</span>
              <input
                className="bfy-input bfy-num"
                inputMode="decimal"
                value={antecedencia}
                onChange={(e) => setAntecedencia(e.target.value)}
              />
            </label>
          </div>
          <p className="text-xs ink-3">
            {faixas > 0
              ? `${faixas} faixa${faixas !== 1 ? 's' : ''} por dia: ${abre}h–${abre + 1}h … ${fecha - 1}h–${fecha}h.`
              : 'Sem faixas — ajusta as horas.'}
          </p>
          {msg && (
            <p className="text-sm font-semibold" style={{ color: msg.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {msg.texto}
            </p>
          )}
          <button type="button" className="btn-primary w-full py-2.5" onClick={guardar}>
            Guardar horários
          </button>
        </>
      )}
    </div>
  )
}
