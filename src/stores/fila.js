import { supabase } from '../lib/supabase'

/**
 * Fila de gravações.
 *
 * Tudo o que a app escreve passa por aqui: entra na fila, fica guardada no
 * próprio aparelho e só sai quando o servidor confirmar. Se a rede falhar
 * (feira com sinal fraco, wi-fi que não navega), repete sozinha — e sobrevive
 * a fechar e reabrir a app.
 *
 * Se o servidor RECUSAR (uma regra, uma permissão), aí não vale insistir:
 * o trabalho é largado, avisamos quem está a usar e recarregamos os dados,
 * porque quem manda é o servidor.
 */

const CHAVE = 'bfy:fila-v1'
const ESPERAS = [1500, 4000, 10000, 30000, 60000]
const MAX_FILA = 500

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

function ler() {
  try {
    const bruto = JSON.parse(localStorage.getItem(CHAVE) || '[]')
    return Array.isArray(bruto) ? bruto : []
  } catch {
    return []
  }
}

let fila = ler()
let aCorrer = false
let timer = null
let recusa = () => {}
const ouvintes = new Set()

function guardar() {
  try { localStorage.setItem(CHAVE, JSON.stringify(fila)) } catch { /* modo privado */ }
  for (const fn of ouvintes) fn(fila.length)
}

/** O DataProvider diz aqui o que fazer quando o servidor recusa um trabalho. */
export function aoRecusar(fn) { recusa = fn }

/** Avisa a cada mudança da fila. O valor inicial vem de porGuardar(). */
export function subscrever(fn) {
  ouvintes.add(fn)
  return () => ouvintes.delete(fn)
}

export const porGuardar = () => fila.length

/** Um erro que vale a pena repetir: rede, timeout, servidor em baixo. */
function temporario(erro) {
  const codigo = String(erro?.code ?? '')
  const msg = String(erro?.message ?? '')
  if (!codigo) return true
  if (/fetch|network|load failed|timeout|abort|econn/i.test(msg)) return true
  return ['08000', '08003', '08006', '40001', '53300', '57014'].includes(codigo)
}

/**
 * Ajuste de stock: manda "tira 1", não "o total é 8". A conta é feita no
 * Postgres (supabase/estoque-atomico.sql), por isso dois aparelhos ao mesmo
 * tempo — ou um a sincronizar horas depois — nunca se apagam um ao outro.
 *
 * Enquanto esse SQL não estiver corrido, o servidor responde que a função não
 * existe (PGRST202) e usamos o caminho antigo: ler, somar, gravar. Serve para
 * não parar as vendas, mas só é seguro com rede e sem duas pessoas à vez.
 */
async function ajustarEstoque(movimentos) {
  const { error } = await supabase.rpc('estoque_ajustar', { p: movimentos })
  if (!error || error.code !== 'PGRST202') return { error }

  console.warn('[fila] estoque_ajustar em falta — a usar o caminho antigo. Corre supabase/estoque-atomico.sql.')
  for (const m of movimentos) {
    const { data, error: eLer } = await supabase
      .from('estoque').select('qty').eq('tipo', m.tipo).eq('cookie_id', m.cookie_id).maybeSingle()
    if (eLer) return { error: eLer }
    const novo = Math.max(0, Number(data?.qty ?? 0) + Number(m.delta ?? 0))
    const { error: eGravar } = await supabase
      .from('estoque').upsert({ tipo: m.tipo, cookie_id: m.cookie_id, qty: novo }, { onConflict: 'tipo,cookie_id' })
    if (eGravar) return { error: eGravar }
  }
  return { error: null }
}

async function executar(t) {
  if (t.tipo === 'insert') return supabase.from(t.tabela).insert(t.linha)
  if (t.tipo === 'update') return supabase.from(t.tabela).update(t.patch).eq('id', t.id)
  if (t.tipo === 'delete') return supabase.from(t.tabela).delete().eq('id', t.id)
  if (t.tipo === 'upsert') return supabase.from(t.tabela).upsert(t.linhas, { onConflict: t.conflito })
  if (t.tipo === 'ajuste') return ajustarEstoque(t.movimentos)
  return { error: { code: 'BFY', message: `Trabalho desconhecido: ${t.tipo}` } }
}

function agendar(tentativas) {
  clearTimeout(timer)
  timer = setTimeout(correr, ESPERAS[Math.min(tentativas, ESPERAS.length - 1)])
}

async function correr() {
  if (aCorrer || fila.length === 0) return
  aCorrer = true
  try {
    while (fila.length > 0) {
      const t = fila[0]
      let erro = null
      try {
        ({ error: erro } = await executar(t))
      } catch (e) {
        erro = e
      }

      // Já lá estava: o pedido anterior chegou, só não chegou a resposta.
      const jaGravado = erro && t.tipo === 'insert' && String(erro.code) === '23505'

      if (erro && !jaGravado) {
        if (temporario(erro)) {
          t.tentativas = (t.tentativas ?? 0) + 1
          guardar()
          agendar(t.tentativas)
          return
        }
        fila.shift()
        guardar()
        recusa(t, erro)
        continue
      }

      fila.shift()
      guardar()
    }
  } finally {
    aCorrer = false
  }
}

/** Mete um trabalho na fila e tenta logo. */
export function juntar(trabalho) {
  if (fila.length >= MAX_FILA) {
    recusa(trabalho, { code: 'BFY', message: 'Demasiadas alterações por guardar.' })
    return
  }
  fila.push({ ...trabalho, ref: uid(), tentativas: 0 })
  guardar()
  correr()
}

/** Tentar já (ao voltar a rede, ao abrir a app, ao voltar ao separador). */
export function tentarAgora() {
  clearTimeout(timer)
  correr()
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', tentarAgora)
  window.addEventListener('focus', tentarAgora)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tentarAgora()
  })
}
