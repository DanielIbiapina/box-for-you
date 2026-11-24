import { useState } from 'react'
import { useConfiguracoes } from '../stores/useConfiguracoes'

/**
 * Horários do levantamento/entrega na loja, dia a dia: faixas de 1 hora
 * (ex.: 14h–15h) entre a hora de abrir e a de fechar de cada dia da semana.
 * A primeira faixa que o cliente vê começa pelo menos `antecedenciaHoras`
 * depois do pedido. O servidor confirma a mesma regra (supabase/loja.sql).
 *
 * Grava { abre, fecha, antecedenciaHoras, semana }, com semana =
 * { "0": { abre, fecha } | null, … } (0 = domingo; null = fechado). abre/fecha
 * ficam como o horário comum a todos os dias abertos, para a loja antiga.
 */
const HORAS = Array.from({ length: 25 }, (_, h) => h)

/** Segunda primeiro, como se lê a semana em Portugal. */
const DIAS = [
  { k: '1', nome: 'Segunda' },
  { k: '2', nome: 'Terça' },
  { k: '3', nome: 'Quarta' },
  { k: '4', nome: 'Quinta' },
  { k: '5', nome: 'Sexta' },
  { k: '6', nome: 'Sábado' },
  { k: '0', nome: 'Domingo' },
]

function semanaInicial(h) {
  const abre = Number.isFinite(h.abre) ? h.abre : 10
  const fecha = Number.isFinite(h.fecha) ? h.fecha : 20
  const s = {}
  for (const { k } of DIAS) {
    if (h.semana && typeof h.semana === 'object') {
      const d = h.semana[k]
      s[k] = d && Number.isFinite(d.abre) && Number.isFinite(d.fecha)
        ? { aberto: true, abre: d.abre, fecha: d.fecha }
        : { aberto: false, abre, fecha }
    } else {
      s[k] = { aberto: true, abre, fecha }
    }
  }
  return s
}

export function Horarios() {
  const { config, update } = useConfiguracoes()
  const disponivel = config.horariosDisponivel !== false
  const h = config.horarios ?? {}
  const [semana, setSemana] = useState(() => semanaInicial(h))
  const [antecedencia, setAntecedencia] = useState(String(h.antecedenciaHoras ?? 2))
  const [msg, setMsg] = useState(null)

  const antec = parseFloat(String(antecedencia).replace(',', '.'))

  const mudar = (k, campo, valor) => {
    setMsg(null)
    setSemana((s) => ({ ...s, [k]: { ...s[k], [campo]: valor } }))
  }

  function guardar() {
    const abertos = DIAS.filter(({ k }) => semana[k].aberto)
    if (abertos.length === 0) return setMsg({ tipo: 'erro', texto: 'Deixa pelo menos um dia aberto.' })
    const errado = abertos.find(({ k }) => semana[k].fecha <= semana[k].abre)
    if (errado) return setMsg({ tipo: 'erro', texto: `${errado.nome}: a hora de fechar tem de ser depois da de abrir.` })
    if (!(antec >= 0 && antec <= 72)) return setMsg({ tipo: 'erro', texto: 'A antecedência tem de ser entre 0 e 72 horas.' })

    const nova = {}
    for (const { k } of DIAS) {
      nova[k] = semana[k].aberto ? { abre: semana[k].abre, fecha: semana[k].fecha } : null
    }
    // horário comum a todos os dias abertos (quem ainda tem a loja antiga aberta só vê este)
    let abre = Math.max(...abertos.map(({ k }) => semana[k].abre))
    let fecha = Math.min(...abertos.map(({ k }) => semana[k].fecha))
    if (fecha <= abre) ({ abre, fecha } = semana[abertos[0].k])

    update({ horarios: { abre, fecha, antecedenciaHoras: antec, semana: nova } })
    setMsg({ tipo: 'ok', texto: 'Guardado. A loja já mostra estes horários.' })
  }

  return (
    <div className="bfy-card p-6 mb-5 space-y-4">
      <div>
        <h2 className="text-base font-bold bfy-card-title">Horários de levantamento e entrega</h2>
        <p className="text-xs ink-3 mt-1">
          O cliente escolhe uma faixa de 1 hora dentro do horário desse dia. A primeira que aparece começa pelo menos{' '}
          {Number.isFinite(antec) ? String(antec).replace('.', ',') : '…'} h depois do pedido.
        </p>
      </div>

      {!disponivel ? (
        <p className="bfy-sunk p-3 text-sm ink-2">
          Para mudar os horários, corre o <code>supabase/loja.sql</code> atualizado no Supabase.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            {DIAS.map(({ k, nome }) => {
              const d = semana[k]
              const faixas = d.aberto && d.fecha > d.abre ? d.fecha - d.abre : 0
              return (
                <div key={k} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <label className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      checked={d.aberto}
                      onChange={(e) => mudar(k, 'aberto', e.target.checked)}
                    />
                    <span className="text-sm font-semibold ink-1">{nome}</span>
                    <span className="text-xs ink-3 truncate">
                      {d.aberto ? (faixas > 0 ? `${faixas} faixa${faixas !== 1 ? 's' : ''}` : 'sem faixas') : 'fechado'}
                    </span>
                  </label>
                  <select
                    className="bfy-input py-1.5"
                    aria-label={`${nome}: abre`}
                    disabled={!d.aberto}
                    value={d.abre}
                    onChange={(e) => mudar(k, 'abre', Number(e.target.value))}
                  >
                    {HORAS.slice(0, 24).map((x) => <option key={x} value={x}>{x}h</option>)}
                  </select>
                  <select
                    className="bfy-input py-1.5"
                    aria-label={`${nome}: fecha`}
                    disabled={!d.aberto}
                    value={d.fecha}
                    onChange={(e) => mudar(k, 'fecha', Number(e.target.value))}
                  >
                    {HORAS.slice(1).map((x) => <option key={x} value={x}>{x}h</option>)}
                  </select>
                </div>
              )
            })}
          </div>
          <label className="block">
            <span className="bfy-label">Antecedência (h)</span>
            <input
              className="bfy-input bfy-num"
              inputMode="decimal"
              value={antecedencia}
              onChange={(e) => { setMsg(null); setAntecedencia(e.target.value) }}
            />
          </label>
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
