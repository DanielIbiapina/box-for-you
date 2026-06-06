const SESSION_KEY = 'bfy:session'

export const appPassword = import.meta.env.VITE_APP_PASSWORD ?? ''

export const isAppLockEnabled = Boolean(appPassword)

async function hashPassword(password) {
  const data = new TextEncoder().encode(password)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

let expectedHash = null

async function getExpectedHash() {
  if (!expectedHash) expectedHash = await hashPassword(appPassword)
  return expectedHash
}

export async function isUnlocked() {
  if (!isAppLockEnabled) return true
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (!stored) return false
    return stored === (await getExpectedHash())
  } catch {
    return false
  }
}

export async function unlock(password) {
  if (!isAppLockEnabled) return { ok: true }
  const hash = await hashPassword(password)
  if (hash !== (await getExpectedHash())) {
    return { ok: false, reason: 'Senha incorreta' }
  }
  try {
    localStorage.setItem(SESSION_KEY, hash)
    return { ok: true }
  } catch {
    return { ok: false, reason: 'Não foi possível salvar a sessão' }
  }
}

export function lock() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}
