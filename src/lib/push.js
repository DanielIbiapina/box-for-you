import { supabase } from './supabase'
import { VAPID_PUBLIC } from './vapid'

/**
 * Notificações push no telemóvel/iPad: avisam de pedidos novos da loja mesmo
 * com a app fechada. O envio é feito pelo banco + Vercel (supabase/push.sql,
 * api/notificar.js); aqui só se liga/desliga ESTE aparelho.
 *
 * No iPhone/iPad (iOS 16.4+) só funciona depois de pôr a app no ecrã principal
 * (Partilhar → Adicionar ao ecrã principal) e abri-la por esse ícone.
 */

const FLAG = 'bfy:push-ativo'

export const pushSuportado = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const ehIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** Aberta pelo ícone do ecrã principal (modo app), não num separador do browser. */
export const emModoApp = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true

/** Este aparelho tem as notificações push ligadas? (para não avisar a dobrar) */
export function pushAtivoAqui() {
  try { return localStorage.getItem(FLAG) === '1' } catch { return false }
}

function marcar(ativo) {
  try {
    if (ativo) localStorage.setItem(FLAG, '1')
    else localStorage.removeItem(FLAG)
  } catch { /* modo privado */ }
}

function chaveEmBytes(base64) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function registo() {
  return navigator.serviceWorker.register('/sw.js', { scope: '/crm/' })
}

/** Estado atual neste aparelho: 'ligado' | 'desligado' | 'bloqueado' | 'sem-suporte' */
export async function estadoPush() {
  if (!pushSuportado()) return 'sem-suporte'
  if (Notification.permission === 'denied') return 'bloqueado'
  const reg = await navigator.serviceWorker.getRegistration('/crm/')
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) marcar(false)
  return sub && Notification.permission === 'granted' ? 'ligado' : 'desligado'
}

function nomeDoAparelho() {
  const ua = navigator.userAgent
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return 'Android'
  if (/Windows/.test(ua)) return 'Windows'
  if (/Mac/.test(ua)) return 'Mac'
  return 'Outro'
}

/** Pede autorização, inscreve este aparelho e guarda-o no banco. */
export async function ativarPush() {
  if (!pushSuportado()) throw new Error('Este browser não suporta notificações.')
  const permissao = await Notification.requestPermission()
  if (permissao !== 'granted') throw new Error('As notificações não foram autorizadas.')

  const reg = await registo()
  await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveEmBytes(VAPID_PUBLIC) }))

  const j = sub.toJSON()
  const { data: sessao } = await supabase.auth.getSession()
  const { error } = await supabase.from('push_inscricoes').upsert({
    endpoint: j.endpoint,
    p256dh: j.keys?.p256dh ?? '',
    auth: j.keys?.auth ?? '',
    email: sessao.session?.user?.email ?? '',
    aparelho: nomeDoAparelho(),
  }, { onConflict: 'endpoint' })
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') throw new Error('Falta correr o supabase/push.sql no Supabase.')
    throw new Error(error.message)
  }
  marcar(true)
}

/** Desliga as notificações neste aparelho (e tira-o do banco). */
export async function desativarPush() {
  const reg = await navigator.serviceWorker.getRegistration('/crm/')
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_inscricoes').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  marcar(false)
}

/** Manda uma notificação de teste para todos os aparelhos ativados. */
export async function testarPush() {
  const { data, error } = await supabase.rpc('push_testar')
  if (error) throw new Error(error.code === 'PGRST202' ? 'Falta correr o supabase/push.sql no Supabase.' : error.message)
  if (!data?.ok) throw new Error(data?.motivo ?? 'Não deu para testar.')
  return data
}
