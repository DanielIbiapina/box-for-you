import { SYNC_KEYS, ARRAY_SYNC_KEYS, STORAGE_SYNC_EVENT } from './syncKeys'
import { isSupabaseConfigured, supabase } from './supabase'

const DEBOUNCE_MS = 400
const TABLE = 'business_data'
const BUSINESS_ID = import.meta.env.VITE_BUSINESS_ID || 'crumb-lab'

let syncEnabled = false
let pendingKeys = new Set()
let debounceTimer = null
let syncStatusListeners = new Set()
let applyingRemote = false
let isPushing = false
let lastCloudUpdatedAt = null
let lastPushAt = 0
let realtimeChannel = null
let listenersBound = false

export function initSync() {
  if (!isSupabaseConfigured) return
  syncEnabled = true
}

export function isApplyingRemoteSync() {
  return applyingRemote
}

export function onSyncStatus(listener) {
  syncStatusListeners.add(listener)
  listener({ status: 'idle', online: navigator.onLine })
  return () => syncStatusListeners.delete(listener)
}

function emitSyncStatus(status, detail = {}) {
  const payload = { status, online: navigator.onLine, ...detail }
  for (const listener of syncStatusListeners) {
    listener(payload)
  }
}

function readLocalKey(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeLocalKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, { detail: { key } }))
  } catch {
    // storage full or disabled
  }
}

function collectLocalSnapshot() {
  const snapshot = {}
  for (const key of SYNC_KEYS) {
    const value = readLocalKey(key)
    if (value !== null) snapshot[key] = value
  }
  return snapshot
}

function mergeArrayById(remoteArr, localArr) {
  const map = new Map()
  for (const item of remoteArr ?? []) {
    if (item?.id != null) map.set(item.id, item)
  }
  for (const item of localArr ?? []) {
    if (item?.id != null) map.set(item.id, item)
  }
  const merged = [...map.values()]
  merged.sort((a, b) => {
    const ta = a.createdAt ?? a.criadoEm ?? ''
    const tb = b.createdAt ?? b.criadoEm ?? ''
    return tb.localeCompare(ta)
  })
  return merged
}

function mergeValue(key, localVal, remoteVal, localChanged) {
  if (!localChanged) return remoteVal ?? localVal ?? null

  if (ARRAY_SYNC_KEYS.has(key) && Array.isArray(localVal)) {
    return mergeArrayById(Array.isArray(remoteVal) ? remoteVal : [], localVal)
  }

  if (
    localVal &&
    remoteVal &&
    typeof localVal === 'object' &&
    typeof remoteVal === 'object' &&
    !Array.isArray(localVal)
  ) {
    return { ...remoteVal, ...localVal }
  }

  return localVal
}

function buildMergedSnapshot(localSnapshot, remoteSnapshot, changedKeys) {
  const merged = {}
  for (const key of SYNC_KEYS) {
    const local = localSnapshot[key]
    const remote = remoteSnapshot?.[key]
    merged[key] = mergeValue(key, local, remote, changedKeys.has(key))
  }
  return merged
}

function applySnapshotToLocal(snapshot, skipKeys = new Set()) {
  applyingRemote = true
  try {
    for (const key of SYNC_KEYS) {
      if (skipKeys.has(key)) continue
      if (key in snapshot) writeLocalKey(key, snapshot[key])
    }
  } finally {
    applyingRemote = false
  }
}

function bindGlobalListeners() {
  if (listenersBound || typeof window === 'undefined') return
  listenersBound = true

  window.addEventListener('online', () => {
    emitSyncStatus('idle')
    if (pendingKeys.size > 0) flushSync()
    else pullFromCloud()
  })

  window.addEventListener('offline', () => {
    emitSyncStatus('offline')
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && syncEnabled && navigator.onLine) {
      pullFromCloud()
    }
  })
}

function subscribeToCloud() {
  if (!supabase || realtimeChannel) return

  realtimeChannel = supabase
    .channel(`business_data:${BUSINESS_ID}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: TABLE,
        filter: `id=eq.${BUSINESS_ID}`,
      },
      (payload) => handleRemoteUpdate(payload.new),
    )
    .subscribe()
}

function handleRemoteUpdate(row) {
  if (!row || isPushing) return

  const updatedAt = row.updated_at
  if (updatedAt && lastPushAt && Date.parse(updatedAt) <= lastPushAt + 800) return

  const cloudData = row.data ?? {}
  lastCloudUpdatedAt = updatedAt

  if (pendingKeys.size > 0) {
    const merged = buildMergedSnapshot(collectLocalSnapshot(), cloudData, pendingKeys)
    applySnapshotToLocal(merged)
    emitSyncStatus('merged')
  } else {
    applySnapshotToLocal(cloudData)
    emitSyncStatus('pulled')
  }
}

export function scheduleSync(key) {
  if (!syncEnabled || !supabase || applyingRemote) return
  pendingKeys.add(key)
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(flushSync, DEBOUNCE_MS)
}

async function fetchRemoteRow() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('data, updated_at')
    .eq('id', BUSINESS_ID)
    .maybeSingle()

  if (error) throw error
  return data
}

async function flushSync() {
  if (!syncEnabled || !supabase || pendingKeys.size === 0) return
  if (!navigator.onLine) {
    emitSyncStatus('offline')
    return
  }

  const keys = [...pendingKeys]
  isPushing = true
  emitSyncStatus('syncing')

  try {
    const remoteRow = await fetchRemoteRow()
    const remoteData = remoteRow?.data ?? {}
    const localSnapshot = collectLocalSnapshot()
    const merged = buildMergedSnapshot(localSnapshot, remoteData, pendingKeys)

    const now = new Date().toISOString()
    const { error } = await supabase.from(TABLE).upsert(
      {
        id: BUSINESS_ID,
        data: merged,
        updated_at: now,
      },
      { onConflict: 'id' },
    )

    if (error) throw error

    pendingKeys.clear()
    lastPushAt = Date.parse(now)
    lastCloudUpdatedAt = now
    emitSyncStatus('synced', { keys })
  } catch (err) {
    keys.forEach((k) => pendingKeys.add(k))
    emitSyncStatus('error', { message: err.message })
  } finally {
    isPushing = false
  }
}

/** Inicializa sync em tempo real + carrega dados da nuvem antes de usar o app */
export async function bootstrapSync() {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: true, configured: false }
  }

  syncEnabled = true
  bindGlobalListeners()
  subscribeToCloud()
  return pullFromCloud()
}

/** Baixa dados da nuvem e funde com alterações locais pendentes */
export async function pullFromCloud() {
  if (!supabase) return { ok: false, reason: 'not_configured' }
  if (!navigator.onLine) {
    emitSyncStatus('offline')
    return { ok: false, reason: 'offline' }
  }

  emitSyncStatus('pulling')

  try {
    const remoteRow = await fetchRemoteRow()
    const cloudData = remoteRow?.data ?? {}
    const hasCloudData = Object.keys(cloudData).length > 0
    lastCloudUpdatedAt = remoteRow?.updated_at ?? null

    if (hasCloudData) {
      if (pendingKeys.size > 0) {
        const merged = buildMergedSnapshot(collectLocalSnapshot(), cloudData, pendingKeys)
        applySnapshotToLocal(merged)
        emitSyncStatus('merged')
        await flushSync()
      } else {
        applySnapshotToLocal(cloudData)
        emitSyncStatus('pulled')
      }
    } else {
      emitSyncStatus('pulled', { hasCloudData: false })
    }

    return { ok: true, hasCloudData }
  } catch (err) {
    emitSyncStatus('error', { message: err.message })
    return { ok: false, reason: err.message }
  }
}

/** Envia o estado local atual para a nuvem (ação manual) */
export async function pushToCloud() {
  if (!supabase) return { ok: false, reason: 'not_configured' }
  if (!navigator.onLine) return { ok: false, reason: 'offline' }

  for (const key of SYNC_KEYS) pendingKeys.add(key)
  await flushSync()
  return pendingKeys.size === 0 ? { ok: true } : { ok: false, reason: 'sync_failed' }
}
