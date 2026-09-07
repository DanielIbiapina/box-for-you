import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { DataProvider } from '../stores/DataProvider'
import App from '../App.jsx'

function FullScreen({ children }) {
  return (
    <div className="flex h-[100dvh] items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      {children}
    </div>
  )
}

export function AppGate() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) { setChecking(false); return }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) {
    return (
      <FullScreen>
        <div className="bfy-card w-full max-w-sm p-8 text-center space-y-2">
          <p className="font-black text-lg bfy-card-title">
            Supabase não configurado
          </p>
          <p className="text-sm ink-3">
            Preenche <code className="text-xs">VITE_SUPABASE_URL</code> e{' '}
            <code className="text-xs">VITE_SUPABASE_ANON_KEY</code> no <code className="text-xs">.env</code>.
          </p>
        </div>
      </FullScreen>
    )
  }

  if (checking) {
    return (
      <FullScreen>
        <p className="text-sm font-semibold ink-2">Carregando…</p>
      </FullScreen>
    )
  }

  if (!session) return <LoginScreen />

  return (
    <DataProvider>
      <App role={session.user?.app_metadata?.role ?? 'owner'} />
    </DataProvider>
  )
}

function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Email ou senha incorretos' : err.message)
      setBusy(false)
    }
    // sucesso → onAuthStateChange no AppGate assume daqui
  }

  return (
    <FullScreen>
      <form onSubmit={handleSubmit} className="bfy-card w-full max-w-sm p-8 space-y-5">
        <div className="text-center">
          <p className="text-2xl font-black bfy-card-title">
            Crumb Lab
          </p>
          <p className="text-sm mt-1 ink-3">
            Entra com o teu email e senha
          </p>
        </div>

        <label className="block">
          <span className="bfy-label">Email</span>
          <input
            className="bfy-input"
            type="email"
            autoFocus
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block">
          <span className="bfy-label">Senha</span>
          <input
            className="bfy-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && (
          <p className="text-xs rounded-lg px-3 py-2 text-center" style={{ background: 'rgba(229,115,115,0.15)', color: '#c62828' }}>
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-3" disabled={busy || !email || !password}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </FullScreen>
  )
}
