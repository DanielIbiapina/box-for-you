import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { MAPPERS, configToApp, configToRow } from './mappers'
import { PEDIDO_NOVO } from '../lib/avisos'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

// tabela → chave no estado + se ordena por data desc (mais novo primeiro)
const COLLECTIONS = [
  { table: 'receitas',         key: 'receitas',       sort: true },
  { table: 'ingredientes',     key: 'ingredientes',   sort: false },
  { table: 'movimentacoes',    key: 'movimentacoes',  sort: true },
  { table: 'eventos',          key: 'eventos',        sort: false },
  { table: 'clientes',         key: 'clientes',       sort: true },
  { table: 'vendas',           key: 'vendas',         sort: true },
  { table: 'pedidos',          key: 'pedidos',        sort: true },
  { table: 'custos_fixos',     key: 'custosFixos',    sort: false },
  { table: 'despesas',         key: 'despesas',       sort: true },
  { table: 'cookies_catalogo', key: 'cookies',        sort: false },
]
const TABLE_TO_KEY = Object.fromEntries(COLLECTIONS.map((c) => [c.table, c.key]))
const SORT_TABLES = new Set(COLLECTIONS.filter((c) => c.sort).map((c) => c.table))

const getTime = (o) => o.createdAt || o.criadoEm || o.criadaEm || o.data || ''
const sortDesc = (arr) => [...arr].sort((a, b) => String(getTime(b)).localeCompare(String(getTime(a))))

const EMPTY_DB = {
  receitas: [], ingredientes: [], movimentacoes: [], eventos: [], clientes: [],
  vendas: [], pedidos: [], custosFixos: [], despesas: [], cookies: [],
  estoqueCookies: {}, estoqueMassa: {}, estoqueCookies50: {},
  config: configToApp(null),
  boxConfig: { size: 4, price: 12 },
  miniBoxConfig: { price: 7 },
  tastingBoxConfig: { price: 16 },
}

/** tipo de estoque -> chave no estado */
const CHAVE_ESTOQUE = {
  cookie: 'estoqueCookies',
  massa: 'estoqueMassa',
  cookie50: 'estoqueCookies50',
}

/**
 * O Supabase devolve no máximo 1000 linhas por pedido — e sem `order` corta
 * as mais RECENTES, que é exatamente o que interessa. Lemos por páginas, com
 * ordem estável, até vir tudo. (Foi o que fez as vendas do dia desaparecerem
 * assim que a tabela passou das mil linhas.)
 */
const PAGINA = 1000
const MAX_PAGINAS = 50

async function lerTudo(tabela, ordens = ['id']) {
  const linhas = []
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    let q = supabase.from(tabela).select('*')
    for (const coluna of ordens) q = q.order(coluna, { ascending: true })
    const de = pagina * PAGINA
    const { data, error } = await q.range(de, de + PAGINA - 1)
    if (error) return { data: null, error }
    linhas.push(...(data ?? []))
    if ((data?.length ?? 0) < PAGINA) break
  }
  return { data: linhas, error: null }
}

const DataContext = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData deve ser usado dentro de <DataProvider>')
  return ctx
}

export function DataProvider({ children }) {
  const [db, setDb] = useState(EMPTY_DB)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState(null)

  const dbRef = useRef(db)
  useEffect(() => { dbRef.current = db }, [db])
  // fonte síncrona do estoque (para loops de baixa/restauração acumularem certo)
  // tipos: 'cookie' (unidades normais) | 'massa' (gramas) | 'cookie50' (cookies de 50g)
  const stockRef = useRef({ cookie: {}, massa: {}, cookie50: {} })

  // ── carregar tudo ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [colRes, estRes, cfgRes] = await Promise.all([
        Promise.all(COLLECTIONS.map((c) => lerTudo(c.table))),
        lerTudo('estoque', ['tipo', 'cookie_id']),
        supabase.from('configuracao').select('*').eq('id', 'main').maybeSingle(),
      ])

      const next = { ...EMPTY_DB }
      COLLECTIONS.forEach((c, i) => {
        if (colRes[i].error) throw colRes[i].error
        const rows = (colRes[i].data ?? []).map((r) => MAPPERS[c.table].toApp(r))
        next[c.key] = c.sort ? sortDesc(rows) : rows
      })

      if (estRes.error) throw estRes.error
      const cookie = {}, massa = {}, cookie50 = {}
      const balde = { massa, cookie50, cookie }
      for (const row of estRes.data ?? []) {
        (balde[row.tipo] ?? cookie)[row.cookie_id] = Number(row.qty ?? 0)
      }
      next.estoqueCookies = cookie
      next.estoqueMassa = massa
      next.estoqueCookies50 = cookie50
      stockRef.current = { cookie, massa, cookie50 }

      if (cfgRes.error) throw cfgRes.error
      next.config = configToApp(cfgRes.data)
      next.boxConfig = cfgRes.data?.box_config ?? { size: 4, price: 12 }
      next.miniBoxConfig = cfgRes.data?.mini_box_config ?? { price: 7 }
      next.tastingBoxConfig = cfgRes.data?.tasting_box_config ?? { price: 16 }

      setDb(next)
      setInitialized(true)
    } catch (e) {
      console.error('[DataProvider] load', e)
      setError(e.message ?? 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── realtime (handlers definidos aqui dentro p/ deps estáveis) ───────────────
  useEffect(() => {
    function handleColChange(c, payload) {
      if (payload.eventType === 'DELETE') {
        setDb((prev) => ({ ...prev, [c.key]: prev[c.key].filter((x) => x.id !== payload.old?.id) }))
        return
      }
      const obj = MAPPERS[c.table].toApp(payload.new)
      setDb((prev) => {
        const arr = prev[c.key]
        const i = arr.findIndex((x) => x.id === obj.id)
        const nextArr = i >= 0 ? arr.map((x) => (x.id === obj.id ? obj : x)) : [obj, ...arr]
        return { ...prev, [c.key]: c.sort ? sortDesc(nextArr) : nextArr }
      })
      // Pedido novo da loja: quem está com a app aberta é avisado (AvisoPedidos.jsx).
      if (c.table === 'pedidos' && payload.eventType === 'INSERT' && obj.origem === 'loja') {
        window.dispatchEvent(new CustomEvent(PEDIDO_NOVO, { detail: obj }))
      }
    }
    function handleEstoqueChange(payload) {
      const row = payload.eventType === 'DELETE' ? payload.old : payload.new
      const t = CHAVE_ESTOQUE[row.tipo] ? row.tipo : 'cookie'
      const map = { ...stockRef.current[t] }
      if (payload.eventType === 'DELETE') delete map[row.cookie_id]
      else map[row.cookie_id] = Number(row.qty ?? 0)
      stockRef.current = { ...stockRef.current, [t]: map }
      setDb((prev) => ({ ...prev, [CHAVE_ESTOQUE[t]]: map }))
    }
    function handleConfigChange(payload) {
      if (!payload.new) return
      setDb((prev) => ({
        ...prev,
        config: configToApp(payload.new),
        boxConfig: payload.new.box_config ?? prev.boxConfig,
        miniBoxConfig: payload.new.mini_box_config ?? prev.miniBoxConfig,
        tastingBoxConfig: payload.new.tasting_box_config ?? prev.tastingBoxConfig,
      }))
    }

    let ch = supabase.channel('bfy-db')
    for (const c of COLLECTIONS) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: c.table }, (p) => handleColChange(c, p))
    }
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'estoque' }, handleEstoqueChange)
    ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'configuracao' }, handleConfigChange)
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  // ── helpers de estado (otimista) ────────────────────────────────────────────
  const upsertLocal = useCallback((key, obj) => {
    setDb((prev) => {
      const arr = prev[key]
      const i = arr.findIndex((x) => x.id === obj.id)
      const nextArr = i >= 0 ? arr.map((x) => (x.id === obj.id ? obj : x)) : [obj, ...arr]
      return { ...prev, [key]: nextArr }
    })
  }, [])
  const removeLocal = useCallback((key, id) => {
    setDb((prev) => ({ ...prev, [key]: prev[key].filter((x) => x.id !== id) }))
  }, [])

  const fail = useCallback((e, ctx) => {
    console.error(`[DataProvider] ${ctx}`, e)
    setError(e?.message ?? `Erro ao guardar (${ctx})`)
  }, [])

  // ── CRUD genérico (otimista: UI já, persistência em segundo plano) ───────────
  const createRow = useCallback((table, appObj) => {
    const key = TABLE_TO_KEY[table]
    const obj = { ...appObj, id: appObj.id ?? uid() }
    setDb((prev) => {
      const arr = [obj, ...prev[key]]
      return { ...prev, [key]: SORT_TABLES.has(table) ? sortDesc(arr) : arr }
    })
    supabase.from(table).insert(MAPPERS[table].toRow(obj)).then(({ error: e }) => {
      if (e) { removeLocal(key, obj.id); fail(e, `insert ${table}`) }
    })
    return obj
  }, [removeLocal, fail])

  const updateRow = useCallback((table, id, patch) => {
    const key = TABLE_TO_KEY[table]
    setDb((prev) => ({ ...prev, [key]: prev[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
    supabase.from(table).update(MAPPERS[table].toRow(patch)).eq('id', id).then(({ error: e }) => {
      if (e) fail(e, `update ${table}`)
    })
  }, [fail])

  const removeRow = useCallback((table, id) => {
    const key = TABLE_TO_KEY[table]
    const prevObj = dbRef.current[key].find((x) => x.id === id)
    removeLocal(key, id)
    supabase.from(table).delete().eq('id', id).then(({ error: e }) => {
      if (e) { if (prevObj) upsertLocal(key, prevObj); fail(e, `delete ${table}`) }
    })
  }, [removeLocal, upsertLocal, fail])

  // ── estoque (cookie / massa / cookie50) ──────────────────────────────────────
  // stockRef é a fonte síncrona: mantém a matemática correta quando várias
  // baixas do mesmo sabor acontecem no mesmo instante (ex.: Tasting Box).
  const setEstoque = useCallback((tipo, cookieId, qty) => {
    const t = CHAVE_ESTOQUE[tipo] ? tipo : 'cookie'
    const q = Math.max(0, qty)
    const map = { ...stockRef.current[t], [cookieId]: q }
    stockRef.current = { ...stockRef.current, [t]: map }
    setDb((prev) => ({ ...prev, [CHAVE_ESTOQUE[t]]: map }))
    supabase.from('estoque').upsert({ tipo: t, cookie_id: cookieId, qty: q }, { onConflict: 'tipo,cookie_id' }).then(({ error: e }) => {
      if (e) fail(e, 'upsert estoque')
    })
  }, [fail])

  const adjustEstoque = useCallback((tipo, cookieId, delta) => {
    const t = CHAVE_ESTOQUE[tipo] ? tipo : 'cookie'
    const cur = stockRef.current[t][cookieId] ?? 0
    setEstoque(t, cookieId, cur + delta)
  }, [setEstoque])

  /** Baixa várias unidades de uma vez. `tipo` escolhe o balde de estoque. */
  const deductCookies = useCallback((items, tipo = 'cookie') => {
    if (!items?.length) return
    const t = CHAVE_ESTOQUE[tipo] ? tipo : 'cookie'
    const map = { ...stockRef.current[t] }
    for (const { cookieId, qty } of items) map[cookieId] = Math.max(0, (map[cookieId] ?? 0) - qty)
    stockRef.current = { ...stockRef.current, [t]: map }
    setDb((prev) => ({ ...prev, [CHAVE_ESTOQUE[t]]: map }))
    const ids = [...new Set(items.map((i) => i.cookieId))]
    const rows = ids.map((cookie_id) => ({ tipo: t, cookie_id, qty: map[cookie_id] }))
    supabase.from('estoque').upsert(rows, { onConflict: 'tipo,cookie_id' }).then(({ error: e }) => {
      if (e) fail(e, 'deduct estoque')
    })
  }, [fail])

  // ── config + caixas ──────────────────────────────────────────────────────────
  const updateConfig = useCallback((patch) => {
    setDb((prev) => ({ ...prev, config: { ...prev.config, ...patch } }))
    supabase.from('configuracao').update(configToRow(patch)).eq('id', 'main').then(({ error: e }) => {
      if (e) fail(e, 'update config')
    })
  }, [fail])

  const setBoxConfig = useCallback((valueOrFn) => {
    const next = typeof valueOrFn === 'function' ? valueOrFn(dbRef.current.boxConfig) : valueOrFn
    setDb((prev) => ({ ...prev, boxConfig: next }))
    supabase.from('configuracao').update({ box_config: next }).eq('id', 'main').then(({ error: e }) => {
      if (e) fail(e, 'update box_config')
    })
  }, [fail])

  const setMiniBoxConfig = useCallback((valueOrFn) => {
    const next = typeof valueOrFn === 'function' ? valueOrFn(dbRef.current.miniBoxConfig) : valueOrFn
    setDb((prev) => ({ ...prev, miniBoxConfig: next }))
    supabase.from('configuracao').update({ mini_box_config: next }).eq('id', 'main').then(({ error: e }) => {
      if (e) fail(e, 'update mini_box_config')
    })
  }, [fail])

  const setTastingBoxConfig = useCallback((valueOrFn) => {
    const next = typeof valueOrFn === 'function' ? valueOrFn(dbRef.current.tastingBoxConfig) : valueOrFn
    setDb((prev) => ({ ...prev, tastingBoxConfig: next }))
    supabase.from('configuracao').update({ tasting_box_config: next }).eq('id', 'main').then(({ error: e }) => {
      if (e) fail(e, 'update tasting_box_config')
    })
  }, [fail])

  if (!initialized) {
    return (
      <div className="flex h-[100dvh] items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
        {error ? (
          <div className="bfy-card w-full max-w-sm p-8 space-y-4 text-center">
            <p className="font-black text-lg" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
              Erro ao carregar
            </p>
            <p className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>{error}</p>
            <button type="button" className="btn-primary w-full py-3" onClick={loadAll}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <p className="text-sm font-semibold opacity-70" style={{ color: 'var(--color-text)' }}>
            A carregar dados…
          </p>
        )}
      </div>
    )
  }

  const value = {
    ...db,
    loading,
    error,
    clearError: () => setError(null),
    refetch: loadAll,
    createRow, updateRow, removeRow,
    setEstoque, adjustEstoque, deductCookies,
    updateConfig, setBoxConfig, setMiniBoxConfig, setTastingBoxConfig,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
