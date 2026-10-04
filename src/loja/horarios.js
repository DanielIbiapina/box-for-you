/**
 * Faixas de horário (1 hora) para levantar/receber o pedido, ex.: 14h–15h.
 * A primeira faixa possível começa pelo menos `antecedenciaHoras` depois de
 * agora — sem isso não dá tempo de preparar. O servidor confirma a mesma regra.
 *
 * `horarios` vem do cardápio: { abre, fecha, antecedenciaHoras, agora }.
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

/** As faixas que ainda dá para escolher num dia (YYYY-MM-DD). */
export function faixasDoDia(dia, horarios, desvio = 0) {
  if (!dia) return []
  const abre = Number.isFinite(horarios?.abre) ? horarios.abre : 10
  const fecha = Number.isFinite(horarios?.fecha) ? horarios.fecha : 20
  const antecedencia = Number(horarios?.antecedenciaHoras ?? 2)
  const limite = Date.now() + desvio + antecedencia * 3600000
  const faixas = []
  for (let h = abre; h < fecha; h++) {
    const inicio = new Date(`${dia}T${pad(h)}:00:00`).getTime()
    if (inicio >= limite) faixas.push({ hora: `${pad(h)}:00`, rotulo: rotuloHora(`${pad(h)}:00`) })
  }
  return faixas
}
