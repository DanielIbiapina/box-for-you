import { SYNC_KEYS, STORAGE_SYNC_EVENT } from './syncKeys'

const BACKUP_VERSION = 1

/** Lê todas as chaves sincronizadas do localStorage e devolve um snapshot. */
export function collectAllData() {
  const data = {}
  for (const key of SYNC_KEYS) {
    const raw = localStorage.getItem(key)
    if (raw === null) continue
    try {
      data[key] = JSON.parse(raw)
    } catch {
      data[key] = raw
    }
  }
  return data
}

/** Gera o conteúdo JSON do backup (string) com metadados. */
export function buildBackupJSON() {
  const payload = {
    _backup: 'box-for-you',
    _version: BACKUP_VERSION,
    _exportedAt: new Date().toISOString(),
    data: collectAllData(),
  }
  return JSON.stringify(payload, null, 2)
}

/** Dispara o download de um ficheiro .json com todos os dados locais. */
export function downloadBackup() {
  const json = buildBackupJSON()
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `boxforyou-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  return json
}

/** Lê um File (input type=file) e devolve o objeto JSON parseado. */
export function readBackupFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)))
      } catch {
        reject(new Error('JSON inválido'))
      }
    }
    reader.onerror = () => reject(new Error('Falha ao ler o ficheiro'))
    reader.readAsText(file)
  })
}

/**
 * Valida e aplica um backup importado, sobrescrevendo as chaves presentes.
 * Aceita tanto o formato com metadados ({ data: {...} }) quanto um snapshot cru.
 * Retorna { ok, keys }.
 */
export function applyBackup(parsed) {
  const data =
    parsed && typeof parsed.data === 'object' && parsed.data ? parsed.data : parsed
  if (!data || typeof data !== 'object') {
    return { ok: false, keys: [] }
  }
  const applied = []
  for (const key of SYNC_KEYS) {
    if (!(key in data)) continue
    try {
      localStorage.setItem(key, JSON.stringify(data[key]))
      window.dispatchEvent(new CustomEvent(STORAGE_SYNC_EVENT, { detail: { key } }))
      applied.push(key)
    } catch {
      // storage cheio ou desativado
    }
  }
  return { ok: applied.length > 0, keys: applied }
}
