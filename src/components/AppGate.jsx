import { useEffect, useState } from 'react'
import { isAppLockEnabled, isUnlocked, unlock } from '../lib/appLock'
import { isSupabaseConfigured } from '../lib/supabase'
import { bootstrapSync, pushToCloud } from '../lib/syncService'
import { runDataMigrations } from '../lib/dataMigrations'
import App from '../App.jsx'

export function AppGate() {
  const needsCloudBoot = isSupabaseConfigured
  const [ready, setReady] = useState(!isAppLockEnabled && !needsCloudBoot)
  const [checking, setChecking] = useState(isAppLockEnabled)
  const [booting, setBooting] = useState(!isAppLockEnabled && needsCloudBoot)
  const [bootError, setBootError] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function loadCloudData() {
    if (!isSupabaseConfigured) return true
    setBooting(true)
    setBootError('')
    const result = await bootstrapSync()
    setBooting(false)
    if (!result.ok) {
      const msg =
        result.reason === 'offline'
          ? 'Sem internet — liga-te à rede para carregar e guardar os dados.'
          : (result.reason ?? 'Não foi possível carregar os dados.')
      setBootError(msg)
      return false
    }
    return true
  }

  useEffect(() => {
    async function boot() {
      if (!isAppLockEnabled) {
        const ok = await loadCloudData()
        if (ok) {
          runDataMigrations()
          await pushToCloud()
          setReady(true)
        }
        return
      }

      const unlocked = await isUnlocked()
      setChecking(false)
      if (!unlocked) return
      const ok = await loadCloudData()
      if (ok) {
        runDataMigrations()
        await pushToCloud()
        setReady(true)
      }
    }
    boot()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await unlock(password)
    if (result.ok) {
      const cloudOk = await loadCloudData()
      if (cloudOk) {
        runDataMigrations()
        await pushToCloud()
        setReady(true)
      }
    } else {
      setError(result.reason)
    }
    setBusy(false)
  }

  if (checking || booting) {
    return (
      <div
        className="flex h-[100dvh] items-center justify-center p-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="text-center space-y-2">
          <p className="text-sm font-semibold opacity-70" style={{ color: 'var(--color-text)' }}>
            {booting ? 'A carregar dados da nuvem…' : 'Carregando…'}
          </p>
          {booting && (
            <p className="text-xs opacity-45" style={{ color: 'var(--color-text)' }}>
              Garante ligação à internet para não perder alterações
            </p>
          )}
        </div>
      </div>
    )
  }

  if (bootError && !ready) {
    return (
      <div
        className="flex h-[100dvh] items-center justify-center p-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="bfy-card w-full max-w-sm p-8 space-y-4 text-center">
          <p className="font-black text-lg" style={{ fontFamily: 'var(--font-title)', color: 'var(--color-accent-dark)' }}>
            Erro ao sincronizar
          </p>
          <p className="text-sm opacity-60" style={{ color: 'var(--color-text)' }}>{bootError}</p>
          <button
            type="button"
            className="btn-primary w-full py-3"
            onClick={() => loadCloudData().then(async (ok) => {
              if (ok) {
                runDataMigrations()
                await pushToCloud()
                setReady(true)
              }
            })}
          >
            Tentar de novo
          </button>
        </div>
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
