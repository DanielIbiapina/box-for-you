/**
 * Faixas de horário (1 hora) para levantar/receber o pedido, ex.: 14h–15h.
 * A primeira faixa possível começa pelo menos `antecedenciaHoras` depois de
 * agora — sem isso não dá tempo de preparar. O servidor confirma a mesma regra.
 *
 * `horarios` vem do cardápio: { abre, fecha, antecedenciaHoras, agora, semana }.
 * `semana` (opcional) dá o horário de cada dia: { "0": { abre, fecha } | null, … }
 * com 0 = domingo … 6 = sábado; null = fechado. Sem ela, vale abre/fecha.
 * `agora` é a hora de Lisboa do servidor; usamo-la para o relógio do
 * telemóvel não baralhar as contas (só corrigimos a diferença entre os dois).
 */

const pad = (n) => String(n).padStart(2, '0')

/** Diferença (ms) entre o relógio do servidor e o do telemóvel, medida ao abrir a loja. */
export function desvioRelogio(horarios) {
  if (!horarios?.agora) return 0
  const servidor = new Date(horarios.agora) // hora de Lisboa, lida como hora local
  return Number.isNaN(servidor.getTime()) ? 0 : servidor.getTime() - Date.now()
}

export function rotuloHora(hora) {
  if (!hora) return ''
  const h = Number(String(hora).slice(0, 2))
  return `${h}h–${h + 1}h`
}

/** { abre, fecha } de um dia (YYYY-MM-DD), ou null se estiver fechado. Mesma regra de loja_horario_dia. */
export function horarioDoDia(dia, horarios) {
  if (horarios?.semana && typeof horarios.semana === 'object') {
    const d = horarios.semana[String(new Date(`${dia}T12:00:00`).getDay())]
    if (!d || !Number.isFinite(d.abre) || !Number.isFinite(d.fecha) || d.fecha <= d.abre) return null
    return { abre: d.abre, fecha: d.fecha }
  }
  const abre = Number.isFinite(horarios?.abre) ? horarios.abre : 10
  const fecha = Number.isFinite(horarios?.fecha) ? horarios.fecha : 20
  return fecha > abre ? { abre, fecha } : null
}

/** As faixas que ainda dá para escolher num dia (YYYY-MM-DD). */
export function faixasDoDia(dia, horarios, desvio = 0) {
  if (!dia) return []
  const h = horarioDoDia(dia, horarios)
  if (!h) return []
  const antecedencia = Number(horarios?.antecedenciaHoras ?? 2)
  const limite = Date.now() + desvio + antecedencia * 3600000
  const faixas = []
  for (let hora = h.abre; hora < h.fecha; hora++) {
    const inicio = new Date(`${dia}T${pad(hora)}:00:00`).getTime()
    if (inicio >= limite) faixas.push({ hora: `${pad(hora)}:00`, rotulo: rotuloHora(`${pad(hora)}:00`) })
  }
  return faixas
}
