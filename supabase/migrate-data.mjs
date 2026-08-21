// ============================================================================
// Box for You — migra o backup (crumb-json.txt) para as tabelas novas.
//
// Uso (dentro do WSL, com Node 22):
//   node --env-file=supabase/.env supabase/migrate-data.mjs "/mnt/c/Users/melis/OneDrive/Documentos/crumb-json.txt"
//
// supabase/.env precisa conter:
//   SUPABASE_URL=https://xxxx.supabase.co        (ou VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...             (chave service_role — NÃO a anon!)
//
// • Rode o supabase/schema.sql ANTES (as tabelas precisam existir).
// • Idempotente: usa upsert por id — pode rodar de novo sem duplicar.
// • Não apaga nada: só insere/atualiza.
// ============================================================================

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const backupPath = process.argv[2] || './crumb-json.txt'

if (!url || !key) {
  console.error('❌ Falta SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no supabase/.env')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

// ── ler o backup ───────────────────────────────────────────────────────────
let raw
try {
  raw = JSON.parse(readFileSync(backupPath, 'utf8'))
} catch (e) {
  console.error(`❌ Não consegui ler/parsear "${backupPath}": ${e.message}`)
  process.exit(1)
}
// aceita [{data:{…}}] (SQL), {…,data:{…}} (export do app) ou o snapshot cru
const container = Array.isArray(raw) ? raw[0] : raw
const D = container?.data && typeof container.data === 'object' ? container.data : container

const arr = (k) => (Array.isArray(D[k]) ? D[k] : [])
const obj = (k) => (D[k] && typeof D[k] === 'object' && !Array.isArray(D[k]) ? D[k] : {})

// ── helpers ─────────────────────────────────────────────────────────────────
const num = (v) => (v == null || v === '' ? 0 : Number(v))
const numOrNull = (v) => (v == null || v === '' ? null : Number(v))
const str = (v) => (v == null ? '' : String(v))

function dedupe(rows, keyFn) {
  const m = new Map()
  for (const r of rows) m.set(keyFn(r), r)
  return [...m.values()]
}

let hadError = false
const counts = {}

// tenta o upsert com backoff — resiste a soluços de rede ("fetch failed" etc.)
async function upsertChunk(table, chunk, onConflict, attempt = 1) {
  try {
    const { error } = await supabase.from(table).upsert(chunk, { onConflict })
    const transient = error && /fetch failed|timeout|network|socket|ECONN|EAI_AGAIN/i.test(error.message)
    if (transient && attempt < 5) {
      await new Promise((r) => setTimeout(r, 700 * attempt))
      return upsertChunk(table, chunk, onConflict, attempt + 1)
    }
    return error
  } catch (e) {
    if (attempt < 5) {
      await new Promise((r) => setTimeout(r, 700 * attempt))
      return upsertChunk(table, chunk, onConflict, attempt + 1)
    }
    return e
  }
}

async function upsert(table, rows, { onConflict = 'id', keyFn = (r) => r.id } = {}) {
  const deduped = dedupe(rows, keyFn)
  counts[table] = deduped.length
  const dups = rows.length - deduped.length
  if (!deduped.length) { console.log(`• ${table}: 0 registros`); return }

  for (let i = 0; i < deduped.length; i += 500) {
    const chunk = deduped.slice(i, i + 500)
    const error = await upsertChunk(table, chunk, onConflict)
    if (error) {
      hadError = true
      console.error(`❌ ${table}: ${error.message}`)
      return
    }
  }
  console.log(`✓ ${table}: ${deduped.length} enviados${dups ? ` (${dups} id(s) duplicado(s) fundido(s))` : ''}`)
}

// ── PAIS primeiro (por causa das foreign keys) ──────────────────────────────

const ingredientes = arr('bfy:ingredientes').map((i) => ({
  id: i.id, nome: str(i.nome), unidade: str(i.unidade) || 'g',
  estoque_atual: num(i.estoqueAtual), estoque_minimo: num(i.estoqueMinimo),
  custo_por_unidade: num(i.custoPorUnidade),
}))
const ingIds = new Set(ingredientes.map((i) => i.id))
await upsert('ingredientes', ingredientes)

const clientes = arr('bfy:clientes').map((c) => ({
  id: c.id, nome: str(c.nome), telefone: str(c.telefone), instagram: str(c.instagram),
  email: str(c.email), notas: str(c.notas), criado_em: c.criadoEm ?? new Date().toISOString(),
}))
const cliIds = new Set(clientes.map((c) => c.id))
await upsert('clientes', clientes)

const eventos = arr('bfy:eventos').map((e) => ({
  id: e.id, nome: str(e.nome), local: str(e.local), data: e.data || null,
  status: str(e.status) || 'planejada', taxa_inscricao: num(e.taxaInscricao),
}))
const evIds = new Set(eventos.map((e) => e.id))
await upsert('eventos', eventos)

const custos = arr('bfy:custos-fixos').map((c) => ({
  id: c.id, nome: str(c.nome), valor_padrao: num(c.valorPadrao),
}))
const cfIds = new Set(custos.map((c) => c.id))
await upsert('custos_fixos', custos)

// ── INDEPENDENTES ────────────────────────────────────────────────────────────

const catalogo = arr('bfy:feiras-cookies').map((c) => ({
  id: c.id, nome: str(c.nome), short: str(c.short), emoji: str(c.emoji),
  price: num(c.price), image: str(c.image), ativo_no_cardapio: c.ativoNoCardapio !== false,
}))
await upsert('cookies_catalogo', catalogo)

const receitas = arr('bfy:receitas').map((r) => ({
  id: r.id, nome: str(r.nome), emoji: str(r.emoji), categoria: str(r.categoria) || 'classico',
  descricao: str(r.descricao), observacoes: str(r.observacoes), rendimento: num(r.rendimento),
  tempo_forno: numOrNull(r.tempoForno), tempo_preparo: numOrNull(r.tempoPreparo),
  cookie_do_mes: !!r.cookieDoMes, eh_receita_base: !!r.ehReceitaBase,
  ingredientes: Array.isArray(r.ingredientes) ? r.ingredientes : [],
  criada_em: r.criadaEm ?? new Date().toISOString(),
}))
await upsert('receitas', receitas)

// ── FILHOS (referências órfãs viram null, registro é mantido) ───────────────
let orphanMov = 0, orphanVendaEv = 0, orphanPedCli = 0, orphanDespEv = 0, orphanDespCf = 0

const movs = arr('bfy:movimentacoes').map((m) => {
  let ing = m.ingredienteId ?? null
  if (ing && !ingIds.has(ing)) { ing = null; orphanMov++ }
  return {
    id: m.id, ingrediente_id: ing, tipo: str(m.tipo) || 'entrada',
    quantidade: num(m.quantidade), motivo: str(m.motivo), data: m.data ?? new Date().toISOString(),
  }
})
await upsert('movimentacoes', movs)

const vendas = arr('cookies-sales:v1').map((v) => {
  let ev = v.eventId ?? null
  if (ev && !evIds.has(ev)) { ev = null; orphanVendaEv++ }
  return {
    id: v.id, kind: str(v.kind) || 'single',
    lines: Array.isArray(v.lines) ? v.lines : [],
    flavor_id: v.flavorId ?? null,
    demo_flavor_id: v.demoFlavorId ?? null,
    box_flavors: Array.isArray(v.boxFlavors) ? v.boxFlavors : [],
    payment_id: v.paymentId ?? null,
    total_eur: num(v.totalEur),
    desconto: num(v.desconto ?? v.discountEur),
    event_id: ev,
    created_at: v.createdAt ?? new Date().toISOString(),
  }
})
await upsert('vendas', vendas)

const pedidos = arr('bfy:pedidos-vendas').map((p) => {
  let cli = p.clienteId ?? null
  if (cli && !cliIds.has(cli)) { cli = null; orphanPedCli++ }
  return {
    id: p.id, cliente_id: cli,
    linhas: Array.isArray(p.linhas) ? p.linhas : [],
    box: p.box ?? null,
    total_eur: num(p.totalEur), desconto: num(p.desconto),
    data_pedido: p.dataPedido || (p.criadoEm ? String(p.criadoEm).slice(0, 10) : null),
    forma_pagamento: str(p.formaPagamento), status: str(p.status) || 'pendente',
    notas: str(p.notas), criado_em: p.criadoEm ?? new Date().toISOString(),
  }
})
await upsert('pedidos', pedidos)

const despesas = arr('bfy:despesas').map((d) => {
  let ev = d.eventId ?? null
  if (ev && !evIds.has(ev)) { ev = null; orphanDespEv++ }
  let cf = d.custoFixoId ?? null
  if (cf && !cfIds.has(cf)) { cf = null; orphanDespCf++ }
  return {
    id: d.id, data: d.data || null, categoria: str(d.categoria) || 'outro',
    valor_eur: num(d.valorEur), descricao: str(d.descricao), pago: d.pago !== false,
    origem: str(d.origem) || 'manual', event_id: ev, custo_fixo_id: cf, mes_ref: d.mesRef ?? null,
  }
})
await upsert('despesas', despesas)

// ── estoque (cookie + massa) ────────────────────────────────────────────────
const estoque = [
  ...Object.entries(obj('bfy:estoque-cookies')).map(([cookie_id, qty]) => ({ tipo: 'cookie', cookie_id, qty: num(qty) })),
  ...Object.entries(obj('bfy:estoque-massa')).map(([cookie_id, qty]) => ({ tipo: 'massa', cookie_id, qty: num(qty) })),
]
await upsert('estoque', estoque, { onConflict: 'tipo,cookie_id', keyFn: (r) => `${r.tipo}:${r.cookie_id}` })

// ── configuracao (singleton: config + box + minibox) ────────────────────────
const cfg = obj('bfy:configuracoes')
const box = obj('bfy:feiras-box')
const mini = obj('bfy:feiras-minibox')
await upsert('configuracao', [{
  id: 'main',
  nome_negocio: str(cfg.nomeNegocio) || 'Box for You',
  nome_proprietaria: str(cfg.nomeProprietaria),
  moeda: str(cfg.moeda) || '€',
  meta_lucro_mensal: num(cfg.metaLucroMensal),
  formas_pagamento: Array.isArray(cfg.formasPagamento) ? cfg.formasPagamento : [],
  box_config: Object.keys(box).length ? box : { size: 4, price: 12 },
  mini_box_config: Object.keys(mini).length ? mini : { price: 7 },
}])

// ── relatório de órfãos ─────────────────────────────────────────────────────
if (orphanMov || orphanVendaEv || orphanPedCli || orphanDespEv || orphanDespCf) {
  console.log('\n⚠️  Referências órfãs saneadas (registro mantido, referência → null):')
  if (orphanMov)     console.log(`   movimentacoes sem ingrediente: ${orphanMov}`)
  if (orphanVendaEv) console.log(`   vendas sem evento: ${orphanVendaEv}`)
  if (orphanPedCli)  console.log(`   pedidos sem cliente: ${orphanPedCli}`)
  if (orphanDespEv)  console.log(`   despesas sem evento: ${orphanDespEv}`)
  if (orphanDespCf)  console.log(`   despesas sem custo fixo: ${orphanDespCf}`)
}

// ── conferência: contagem no banco vs no backup ─────────────────────────────
console.log('\n── Conferência (banco vs backup) ──')
for (const table of Object.keys(counts)) {
  const expected = counts[table]
  const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
  if (error) { console.log(`   ${table}: erro ao contar (${error.message})`); continue }
  console.log(`   ${count === expected ? '✓' : '≠'} ${table}: banco=${count} backup=${expected}`)
}

console.log(hadError ? '\n❌ Terminou COM erros — revê acima.' : '\n✅ Migração concluída sem erros.')
process.exit(hadError ? 1 : 0)
