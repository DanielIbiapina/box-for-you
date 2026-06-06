/** Chaves do localStorage sincronizadas com o Supabase */
export const SYNC_KEYS = [
  'bfy:receitas',
  'bfy:ingredientes',
  'bfy:movimentacoes',
  'bfy:eventos',
  'bfy:configuracoes',
  'cookies-sales:v1',
  'bfy:feiras-cookies',
  'bfy:feiras-box',
  'bfy:feiras-minibox',
  'bfy:vendas-avulsas',
  'bfy:estoque-cookies',
  'bfy:estoque-massa',
  'bfy:clientes',
  'bfy:pedidos-vendas',
]

/** Arrays que são unidos por id ao sincronizar (evita perder vendas/pedidos simultâneos) */
export const ARRAY_SYNC_KEYS = new Set([
  'bfy:receitas',
  'bfy:ingredientes',
  'bfy:movimentacoes',
  'bfy:eventos',
  'cookies-sales:v1',
  'bfy:feiras-cookies',
  'bfy:vendas-avulsas',
  'bfy:clientes',
  'bfy:pedidos-vendas',
])

export const STORAGE_SYNC_EVENT = 'bfy:storage-sync'
