import { useEffect, useState } from 'react'
import { isAppLockEnabled, isUnlocked, unlock } from '../lib/appLock'
import { initSync, pullFromCloud } from '../lib/syncService'
import App from '../App.jsx'

export function AppGate() {
  const [ready, setReady] = useState(!isAppLockEnabled)
  const [checking, setChecking] = useState(isAppLockEnabled)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isAppLockEnabled) {
      initSync()
      pullFromCloud()
      return
    }

    isUnlocked().then((ok) => {
      setReady(ok)
      setChecking(false)
      if (ok) {
        initSync()
        pullFromCloud()
      }
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await unlock(password)
    if (result.ok) {
      initSync()
      await pullFromCloud()
      setReady(true)
    } else {
      setError(result.reason)
    }
    setBusy(false)
  }

  if (checking) {
    return (
      <div
        className="flex h-[100dvh] items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
      >
        <p className="text-sm opacity-50" style={{ color: 'var(--color-text)' }}>
          Carregando…
        </p>
      </div>
    )
  }

  if (!ready) {
    return (
      <div
        className="flex h-[100dvh] items-center justify-center p-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <form onSubmit={handleSubmit} className="bfy-card w-full max-w-sm p-8 space-y-5">
          <div className="text-center">
            <p
              className="text-2xl font-black"
              style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}
            >
              Crumb Lab
            </p>
            <p className="text-sm mt-1 opacity-60" style={{ color: 'var(--color-text)' }}>
              Digite a senha para continuar
            </p>
          </div>

          <label className="block">
            <span className="bfy-label">Senha</span>
            <input
              className="bfy-input"
              type="password"
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && (
            <p
              className="text-xs rounded-lg px-3 py-2 text-center"
              style={{ background: 'rgba(229,115,115,0.15)', color: '#c62828' }}
            >
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full py-3" disabled={busy || !password}>
            {busy ? 'Verificando…' : 'Entrar'}
          </button>

          <p className="text-[11px] text-center opacity-45" style={{ color: 'var(--color-text)' }}>
            A senha fica salva neste dispositivo — você só precisa digitar de novo se limpar os dados do navegador.
          </p>
        </form>
      </div>
    )
  }

  return <App />
}
