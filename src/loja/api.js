/**
 * A loja fala com o Supabase por HTTP direto, sem o supabase-js: só RPCs
 * públicos, sem sessão nem realtime. Poupa ~110 kB gzip à página que
 * o cliente abre no telemóvel — que é exatamente onde isso pesa.
 */
const URL_BASE = import.meta.env.VITE_SUPABASE_URL
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(URL_BASE && ANON_KEY)

async function rpc(nome, params) {
  const resposta = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify(params ?? {}),
  })
  if (!resposta.ok) {
    throw new Error(`${nome}: ${resposta.status} ${await resposta.text()}`)
  }
  return resposta.json()
}

/** Cardápio público — sabores ativos, preços das caixas e stock. */
export const fetchCardapio = () => rpc('loja_cardapio')

/**
 * Cria o pedido. O servidor revalida sabores, stock e RECALCULA o total —
 * o que vai daqui é intenção, não preço.
 * Devolve { ok:true, pedidoId, referencia, total } ou { ok:false, motivo, campo }.
 */
export const criarPedido = (pedido) => rpc('loja_criar_pedido', { p: pedido })

/** Consulta pública: referência + telemóvel. Sem os dois, o servidor recusa. */
export const verPedido = (referencia, telefone) =>
  rpc('loja_ver_pedido', { p_ref: referencia, p_tel: telefone })
