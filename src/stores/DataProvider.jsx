import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { MAPPERS, configToApp, configToRow } from './mappers'
import { PEDIDO_NOVO } from '../lib/avisos'
import { aoRecusar, juntar, porGuardar as porGuardarAgora, subscrever, tentarAgora } from './fila'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

// tabela → chave no estado, se ordena por data desc (mais novo primeiro) e,
// nas tabelas que crescem sem fim, a coluna de data: essas abrem com o recente
// e vão buscar o histórico a seguir, em segundo plano.
const COLLECTIONS = [
  { table: 'receitas',         key: 'receitas',       sort: true },
  { table: 'ingredientes',     key: 'ingredientes',   sort: false },
  { table: 'movimentacoes',    key: 'movimentacoes',  sort: true,  recente: 'data' },
  { table: 'eventos',          key: 'eventos',        sort: false },
  { table: 'clientes',         key: 'clientes',       sort: true,  recente: 'criado_em' },
  { table: 'vendas',           key: 'vendas',         sort: true,  recente: 'created_at' },
  { table: 'pedidos',          key: 'pedidos',        sort: true,  recente: 'criado_em' },
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
/** Quanto chega para abrir a app e trabalhar; o resto vem depois. */
const ABERTURA = 400

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

/** As linhas mais recentes de uma tabela — o que a app precisa para abrir. */
async function lerRecentes(tabela, coluna, quantos = ABERTURA) {
  return supabase.from(tabela).select('*').order(coluna, { ascending: false }).limit(quantos)
}

/**
 * O resto do histórico, do ponto onde a abertura parou para trás.
 * Usa `lte` (e não `lt`) para não saltar linhas com a mesma data; as repetidas
 * são descartadas na junção, que é por id.
 */
async function lerHistorico(tabela, coluna, marca) {
  const linhas = []
  let corte = marca
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const { data, error } = await supabase
      .from(tabela).select('*')
      .order(coluna, { ascending: false })
      .lte(coluna, corte)
      .limit(PAGINA)
    if (error) return { data: null, error }
    if (!data?.length) break
    const fim = data[data.length - 1][coluna]
    linhas.push(...data)
    if (data.length < PAGINA || fim === corte) break
    corte = fim
  }
  return { data: linhas, error: null }
}

const juntarPorId = (atuais, novas) => {
  const mapa = new Map(atuais.map((x) => [x.id, x]))
  for (const linha of novas) mapa.set(linha.id, linha)
  return [...mapa.values()]
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
  const [porGuardar, setPorGuardar] = useState(porGuardarAgora)
  const [historicoCompleto, setHistoricoCompleto] = useState(true)
  /** Só é seguro vender sem rede depois de correr supabase/estoque-atomico.sql. */
  const [estoqueAtomico, setEstoqueAtomico] = useState(false)

  const dbRef = useRef(db)
  useEffect(() => { dbRef.current = db }, [db])
  // fonte síncrona do estoque (para loops de baixa/restauração acumularem certo)
  // tipos: 'cookie' (unidades normais) | 'massa' (gramas) | 'cookie50' (cookies de 50g)
  const stockRef = useRef({ cookie: {}, massa: {}, cookie50: {} })

  /**
   * O histórico antigo, depois da app já estar a andar. Cada tabela entra
   * assim que chega, sem travar nada; no fim, `historicoCompleto` diz que os
   * relatórios já têm tudo.
   */
  const carregarHistorico = useCallback(async (abertura) => {
    setHistoricoCompleto(false)
    const grandes = COLLECTIONS.filter((c) => c.recente)
    await Promise.all(grandes.map(async (c) => {
      const abertas = abertura[c.key] ?? []
      if (abertas.length < ABERTURA) return          // já veio tudo na abertura
      const marca = getTime(abertas[abertas.length - 1])   // a mais antiga que já temos
      if (!marca) return
      const { data, error } = await lerHistorico(c.table, c.recente, marca)
      if (error) {
        console.error('[DataProvider] histórico', c.table, error)
        return
      }
      const linhas = (data ?? []).map((r) => MAPPERS[c.table].toApp(r))
      setDb((prev) => ({ ...prev, [c.key]: sortDesc(juntarPorId(prev[c.key], linhas)) }))
    }))
    setHistoricoCompleto(true)
  }, [])

  // ── carregar tudo ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [colRes, estRes, cfgRes] = await Promise.all([
        // Tabelas que crescem sem fim abrem só com o recente (o histórico vem
        // a seguir, em carregarHistorico); as pequenas vêm inteiras.
        Promise.all(COLLECTIONS.map((c) => (
          c.recente ? lerRecentes(c.table, c.recente) : lerTudo(c.table)
        ))),
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
      carregarHistorico(next)
    } catch (e) {
      console.error('[DataProvider] load', e)
      setError('Não foi possível carregar os dados. Verifica a ligação.')
    } finally {
      setLoading(false)
    }
  }, [carregarHistorico])

  useEffect(() => { loadAll() }, [loadAll])

  // ── fila de gravações ───────────────────────────────────────────────────────
  useEffect(() => subscrever(setPorGuardar), [])

  // A função de stock existe? Sem ela, vender sem rede podia sobrescrever
  // o trabalho de outro aparelho — e a Feira volta a exigir ligação.
  useEffect(() => {
    let vivo = true
    const ver = () => {
      supabase.rpc('estoque_ajustar', { p: [] }).then(({ error }) => {
        if (!vivo || error?.code === 'PGRST202') return
        if (!error) setEstoqueAtomico(true)
      })
    }
    ver()
    window.addEventListener('online', ver)
    return () => { vivo = false; window.removeEventListener('online', ver) }
  }, [])

  useEffect(() => {
    aoRecusar(async (trabalho, erro) => {
      console.error('[fila] recusado', trabalho, erro)
      // Recarrega primeiro (o servidor é que manda) e só depois avisa —
      // ao carregar, a mensagem de erro é limpa.
      await loadAll()
      setError('Uma alteração não foi aceite pelo servidor e foi desfeita.')
    })
    tentarAgora()
  }, [loadAll])

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
  const removeLocal = useCallback((key, id) => {
    setDb((prev) => ({ ...prev, [key]: prev[key].filter((x) => x.id !== id) }))
  }, [])

  // ── CRUD genérico ───────────────────────────────────────────────────────────
  // A UI muda já; a gravação vai para a fila (stores/fila.js), que repete
  // sozinha enquanto a rede não deixar. Só o que o servidor RECUSA é perdido —
  // e aí recarregamos, porque quem manda é o servidor.
  const createRow = useCallback((table, appObj) => {
    const key = TABLE_TO_KEY[table]
    const obj = { ...appObj, id: appObj.id ?? uid() }
    setDb((prev) => {
      const arr = [obj, ...prev[key]]
      return { ...prev, [key]: SORT_TABLES.has(table) ? sortDesc(arr) : arr }
    })
    juntar({ tipo: 'insert', tabela: table, linha: MAPPERS[table].toRow(obj) })
    return obj
  }, [])

  const updateRow = useCallback((table, id, patch) => {
    const key = TABLE_TO_KEY[table]
    setDb((prev) => ({ ...prev, [key]: prev[key].map((x) => (x.id === id ? { ...x, ...patch } : x)) }))
    juntar({ tipo: 'update', tabela: table, id, patch: MAPPERS[table].toRow(patch) })
  }, [])

  const removeRow = useCallback((table, id) => {
    const key = TABLE_TO_KEY[table]
    removeLocal(key, id)
    juntar({ tipo: 'delete', tabela: table, id })
  }, [removeLocal])

  // ── estoque (cookie / massa / cookie50) ──────────────────────────────────────
  // stockRef é a fonte síncrona: mantém a matemática correta quando várias
  // baixas do mesmo sabor acontecem no mesmo instante (ex.: Tasting Box).
  const setEstoque = useCallback((tipo, cookieId, qty) => {
    const t = CHAVE_ESTOQUE[tipo] ? tipo : 'cookie'
    const q = Math.max(0, qty)
    const map = { ...stockRef.current[t], [cookieId]: q }
    stockRef.current = { ...stockRef.current, [t]: map }
    setDb((prev) => ({ ...prev, [CHAVE_ESTOQUE[t]]: map }))
    juntar({
      tipo: 'upsert', tabela: 'estoque', conflito: 'tipo,cookie_id',
      linhas: [{ tipo: t, cookie_id: cookieId, qty: q }],
    })
  }, [])

  /**
   * Somas e subtrações vão como DELTA ("tira 1"), nunca como total.
   * É isso que deixa duas pessoas mexer no stock ao mesmo tempo — ou uma
   * sincronizar mais tarde — sem apagar o trabalho da outra.
   */
  const aplicarDeltas = useCallback((t, deltas) => {
    const map = { ...stockRef.current[t] }
    for (const [cookieId, delta] of Object.entries(deltas)) {
      map[cookieId] = Math.max(0, (map[cookieId] ?? 0) + delta)
    }
    stockRef.current = { ...stockRef.current, [t]: map }
    setDb((prev) => ({ ...prev, [CHAVE_ESTOQUE[t]]: map }))
    juntar({
      tipo: 'ajuste',
      movimentos: Object.entries(deltas)
        .filter(([, delta]) => delta !== 0)
        .map(([cookie_id, delta]) => ({ tipo: t, cookie_id, delta })),
    })
  }, [])

  const adjustEstoque = useCallback((tipo, cookieId, delta) => {
    const t = CHAVE_ESTOQUE[tipo] ? tipo : 'cookie'
    aplicarDeltas(t, { [cookieId]: delta })
  }, [aplicarDeltas])

  /** Baixa várias unidades de uma vez. `tipo` escolhe o balde de estoque. */
  const deductCookies = useCallback((items, tipo = 'cookie') => {
    if (!items?.length) return
    const t = CHAVE_ESTOQUE[tipo] ? tipo : 'cookie'
    const deltas = {}
    for (const { cookieId, qty } of items) deltas[cookieId] = (deltas[cookieId] ?? 0) - qty
    aplicarDeltas(t, deltas)
  }, [aplicarDeltas])

  // ── config + caixas ──────────────────────────────────────────────────────────
  const updateConfig = useCallback((patch) => {
    setDb((prev) => ({ ...prev, config: { ...prev.config, ...patch } }))
    juntar({ tipo: 'update', tabela: 'configuracao', id: 'main', patch: configToRow(patch) })
  }, [])

  const setBoxConfig = useCallback((valueOrFn) => {
    const next = typeof valueOrFn === 'function' ? valueOrFn(dbRef.current.boxConfig) : valueOrFn
    setDb((prev) => ({ ...prev, boxConfig: next }))
    juntar({ tipo: 'update', tabela: 'configuracao', id: 'main', patch: { box_config: next } })
  }, [])

  const setMiniBoxConfig = useCallback((valueOrFn) => {
    const next = typeof valueOrFn === 'function' ? valueOrFn(dbRef.current.miniBoxConfig) : valueOrFn
    setDb((prev) => ({ ...prev, miniBoxConfig: next }))
    juntar({ tipo: 'update', tabela: 'configuracao', id: 'main', patch: { mini_box_config: next } })
  }, [])

  const setTastingBoxConfig = useCallback((valueOrFn) => {
    const next = typeof valueOrFn === 'function' ? valueOrFn(dbRef.current.tastingBoxConfig) : valueOrFn
    setDb((prev) => ({ ...prev, tastingBoxConfig: next }))
    juntar({ tipo: 'update', tabela: 'configuracao', id: 'main', patch: { tasting_box_config: next } })
  }, [])

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
    porGuardar,
    historicoCompleto,
    estoqueAtomico,
    clearError: () => setError(null),
    refetch: loadAll,
    createRow, updateRow, removeRow,
    setEstoque, adjustEstoque, deductCookies,
    updateConfig, setBoxConfig, setMiniBoxConfig, setTastingBoxConfig,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}
