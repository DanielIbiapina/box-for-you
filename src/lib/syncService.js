import { SYNC_KEYS, STORAGE_SYNC_EVENT } from './syncKeys'
import { isSupabaseConfigured, supabase } from './supabase'

const DEBOUNCE_MS = 1500
const TABLE = 'business_data'
const BUSINESS_ID = import.meta.env.VITE_BUSINESS_ID || 'crumb-lab'

let syncEnabled = false
let pendingKeys = new Set()
let debounceTimer = null
let syncStatusListeners = new Set()

export function initSync() {
  if (!isSupabaseConfigured) return
  syncEnabled = true
}

export function onSyncStatus(listener) {
  syncStatusListeners.add(listener)
  return () => syncStatusListeners.delete(listener)
}

function emitSyncStatus(status, detail = {}) {
  for (const listener of syncStatusListeners) {
    listener({ status, ...detail })
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

export function scheduleSync(key) {
  if (!syncEnabled || !supabase) return
  pendingKeys.add(key)
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(flushSync, DEBOUNCE_MS)
}

async function flushSync() {
  if (!syncEnabled || !supabase || pendingKeys.size === 0) return

  const keys = [...pendingKeys]
  pendingKeys.clear()
  emitSyncStatus('syncing')

  try {
    const snapshot = collectLocalSnapshot()
    const { error } = await supabase.from(TABLE).upsert(
      {
        id: BUSINESS_ID,
        data: snapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (error) throw error
    emitSyncStatus('synced', { keys })
  } catch (err) {
    keys.forEach((k) => pendingKeys.add(k))
    emitSyncStatus('error', { message: err.message })
  }
}

/** Baixa dados da nuvem e preenche o localStorage (sem enviar dados locais). */
export async function pullFromCloud() {
  if (!supabase) return { ok: false, reason: 'not_configured' }

  emitSyncStatus('pulling')

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('data')
      .eq('id', BUSINESS_ID)
      .maybeSingle()

    if (error) throw error

    const cloudData = data?.data ?? {}
    const hasCloudData = Object.keys(cloudData).length > 0

    if (hasCloudData) {
      for (const key of SYNC_KEYS) {
        if (key in cloudData) {
          writeLocalKey(key, cloudData[key])
        }
      }
    }

    emitSyncStatus('pulled', { hasCloudData })
    return { ok: true, hasCloudData }
  } catch (err) {
    emitSyncStatus('error', { message: err.message })
    return { ok: false, reason: err.message }
  }
}

/** Envia o estado local atual para a nuvem (ação manual). */
export async function pushToCloud() {
  if (!supabase) return { ok: false, reason: 'not_configured' }

  emitSyncStatus('syncing')

  try {
    const snapshot = collectLocalSnapshot()
    const { error } = await supabase.from(TABLE).upsert(
      {
        id: BUSINESS_ID,
        data: snapshot,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (error) throw error
    emitSyncStatus('synced', { manual: true })
    return { ok: true }
  } catch (err) {
    emitSyncStatus('error', { message: err.message })
    return { ok: false, reason: err.message }
  }
}
