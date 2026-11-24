/**
 * Black Crumb (Black Friday, nov/2026): combos de N cookies a preço fechado,
 * sabores sempre disponíveis (o stock pode ficar negativo — é o que falta
 * fazer), 1 mini cookie de 50 g de oferta por combo e pagamento só por MB WAY.
 *
 * As regras vêm do cardápio (`cardapio.black`, ver loja_black_estado em
 * supabase/loja.sql) e o servidor recalcula tudo em loja_criar_pedido_black:
 * daqui só sai a escolha (que combo, que sabores, quando e onde).
 */
import { contar, findCookie, fmtEuro, resumoCaixa } from './util'

const SACO_KEY = 'bfy:loja-black-v1'

/** A campanha está a decorrer (mesmo na pausa de sexta à noite). */
export const blackAtiva = (cardapio) => Boolean(cardapio?.black?.ativo)

/** Dá para encomendar agora (não está na pausa e ainda há dias). */
export const blackAberta = (cardapio) => Boolean(cardapio?.black?.ativo && cardapio.black.aberta)

/** Enquanto a campanha dura, a loja normal fica fechada: só há a aba da Black. */
export const lojaFechadaPelaBlack = (cardapio) => Boolean(cardapio?.black?.ativo && cardapio.black.fechaLoja)

/** "sábado, 28/11" a partir de "2026-11-28" ou "2026-11-28T00:00". */
export function fmtDiaSemana(iso) {
  if (!iso) return ''
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const semana = d.toLocaleDateString('pt-PT', { weekday: 'long' })
  return `${semana}, ${d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })}`
}

export const comboDef = (black, id) => black?.combos?.find((c) => c.id === id) ?? null

/** O saco da Black Crumb: [{ combo: 'duo', ids: ['nutella', 'pistache'], minis: ['all-black'] }]. */
export function lerSacoBlack() {
  try {
    const d = JSON.parse(localStorage.getItem(SACO_KEY) ?? 'null')
    if (!d || !Array.isArray(d.combos) || Date.now() - (d.savedAt ?? 0) > 7 * 864e5) return []
    return d.combos
      .filter((c) => typeof c?.combo === 'string' && Array.isArray(c.ids))
      .map((c) => ({ ...c, minis: Array.isArray(c.minis) ? c.minis.filter((x) => typeof x === 'string') : [] }))
  } catch {
    return []
  }
}

export function gravarSacoBlack(combos) {
  try {
    if (combos.length) localStorage.setItem(SACO_KEY, JSON.stringify({ savedAt: Date.now(), combos }))
    else localStorage.removeItem(SACO_KEY)
  } catch { /* quota / modo privado */ }
}

/**
 * Tira do saco os combos que já não existem ou com sabores que saíram do
 * cardápio. Um mini que saiu do cardápio cai; o combo fica (sem mini escolhido
 * o servidor manda um de sabor surpresa).
 */
export function limparSacoBlack(combos, cardapio) {
  return combos
    .filter((c) => {
      const def = comboDef(cardapio?.black, c.combo)
      return def && c.ids.length === def.cookies && c.ids.every((id) => findCookie(cardapio, id))
    })
    .map((c) => ({ ...c, minis: (c.minis ?? []).filter((id) => findCookie(cardapio, id)) }))
}

/** "mini Pistache" (ou "minis Pistache e Nutella") a partir dos ids escolhidos. */
function textoMinis(minis, cardapio) {
  const nomes = (minis ?? []).map((id) => findCookie(cardapio, id)?.nome).filter(Boolean)
  if (!nomes.length) return ''
  return `${nomes.length > 1 ? 'minis' : 'mini'} ${nomes.join(' e ')} de oferta`
}

/** Linhas para o passo "O teu pedido" do checkout (mesma forma que util.resumoPedido). */
export function resumoBlack(combos, cardapio) {
  const black = cardapio?.black
  const linhas = combos.map((c, i) => {
    const def = comboDef(black, c.combo)
    return {
      key: `combo-${i}`, tipo: 'combo', inicio: i, ids: c.ids,
      nome: def?.nome ?? c.combo,
      detalhe: [resumoCaixa(contar(c.ids), cardapio), textoMinis(c.minis, cardapio)].filter(Boolean).join(' + '),
      qty: 1, subtotal: Number(def?.preco) || 0,
    }
  })
  return {
    linhas,
    total: linhas.reduce((s, l) => s + l.subtotal, 0),
    brinde: combos.length * (Number(black?.brindePorCombo) || 0),
    nItens: combos.length,
    caixas: [], resto: [], poupanca: 0,
  }
}

/**
 * O que vai para o servidor: só a escolha. Os minis só vão quando estão
 * todos escolhidos; sem eles o servidor manda o mini de sabor surpresa.
 */
export const payloadBlack = (combos, brindePorCombo = 0) => combos.map((c) => ({
  combo: c.combo,
  sabores: contar(c.ids),
  ...((c.minis ?? []).length === brindePorCombo && brindePorCombo > 0 ? { minis: c.minis } : {}),
}))

/**
 * Taxa de entrega com as regras da campanha (o servidor faz a mesma conta):
 * grátis a partir de X €; abaixo disso, a encomenda antecipada não paga até
 * Y km e tem Z € de desconto mais longe. Devolve null quando fica "a confirmar".
 */
export function taxaBlack(black, { total, km, taxa, semMapa }) {
  const gratis = Number(black?.freteGratisAPartirDe)
  if (Number.isFinite(gratis) && gratis > 0 && total >= gratis) return 0
  if (semMapa) return null
  if (black?.antecipado) {
    const ateKm = Number(black.antecipadoFreteGratisAteKm)
    if (Number.isFinite(ateKm) && km <= ateKm) return 0
    const desc = Number(black.antecipadoDescontoFrete)
    if (Number.isFinite(desc)) return Math.max(0, taxa - desc)
  }
  return taxa
}

/** A vantagem de entrega de quem encomenda antecipado ("Entrega grátis até 7 km…"), ou ''. */
export function vantagemAntecipada(black) {
  if (!black?.antecipado) return ''
  const ateKm = Number(black.antecipadoFreteGratisAteKm)
  const desc = Number(black.antecipadoDescontoFrete)
  if (!Number.isFinite(ateKm)) return ''
  return `Entrega grátis até ${String(ateKm).replace('.', ',')} km${Number.isFinite(desc) && desc > 0 ? ` (mais longe, ${euroCurto(desc)} de desconto)` : ''}`
}

/** "20 €" em vez de "20,00 €" quando é redondo (fica mais limpo nos avisos). */
const euroCurto = (v) => (Number.isInteger(Number(v)) ? `${Number(v)} €` : fmtEuro(v))

/**
 * O aviso de entrega da campanha, numa só peça: a regra para todos (grátis a
 * partir de X €) e, enquanto é encomenda antecipada, a vantagem extra.
 * { titulo, texto } — texto vazio quando não há vantagem extra.
 */
export function avisoEntregaBlack(black) {
  const gratis = Number(black?.freteGratisAPartirDe)
  const titulo = Number.isFinite(gratis) && gratis > 0 ? `Entrega grátis a partir de ${euroCurto(gratis)}` : ''
  let texto = ''
  if (black?.antecipado) {
    const ateKm = Number(black.antecipadoFreteGratisAteKm)
    const desc = Number(black.antecipadoDescontoFrete)
    if (Number.isFinite(ateKm)) {
      const prazo = fmtPrazo(black.antecipadoAte).replace(/-feira/, '')
      texto = `Encomendando até ${prazo}, também é grátis até ${String(ateKm).replace('.', ',')} km`
        + (Number.isFinite(desc) && desc > 0 ? `. Mais longe, tens ${euroCurto(desc)} de desconto.` : '.')
    }
  }
  return { titulo, texto }
}

/** "sexta, 27 nov às 19h" a partir de "2026-11-27T19:00" (hora de Lisboa). */
export function fmtPrazo(iso) {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 16)}:00`)
  if (Number.isNaN(d.getTime())) return ''
  const dia = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'short' }).replace('.', '')
  const m = d.getMinutes()
  return `${dia} às ${d.getHours()}h${m ? String(m).padStart(2, '0') : ''}`
}

/** Os dias marcáveis, como chips (sáb, 28 nov…). */
export function diasBlack(black, hoje) {
  return (black?.dias ?? []).map((iso) => {
    const d = new Date(`${iso}T12:00:00`)
    const semana = d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')
    const amanha = new Date(`${hoje}T12:00:00`)
    amanha.setDate(amanha.getDate() + 1)
    const rotulo = iso === hoje ? 'Hoje' : d.toDateString() === amanha.toDateString() ? 'Amanhã' : semana
    return { iso, rotulo, dia: d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' }).replace('.', '') }
  })
}
