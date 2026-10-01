import webpush from 'web-push'
import { VAPID_PUBLIC } from '../src/lib/vapid.js'

/**
 * Envia a notificação "pedido novo" para os telemóveis/iPads da dona.
 *
 * Quem chama é o próprio banco (trigger em supabase/push.sql), logo depois de
 * a loja gravar um pedido — por isso o aviso chega mesmo com a app fechada.
 * O banco manda o texto e a lista de aparelhos inscritos; aqui só se assina
 * com a chave privada e se entrega aos serviços de push (Apple, Google…).
 *
 * Variáveis na Vercel: VAPID_PRIVATE_KEY e PUSH_SEGREDO (o mesmo segredo que
 * está em push_config, no banco — sem ele ninguém usa este endereço).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false })

  const segredo = process.env.PUSH_SEGREDO
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!segredo || !privada) return res.status(500).json({ ok: false, motivo: 'Falta configurar a Vercel.' })

  const { segredo: recebido, titulo, corpo, url, inscricoes } = req.body ?? {}
  if (recebido !== segredo) return res.status(401).json({ ok: false })
  if (!Array.isArray(inscricoes) || inscricoes.length === 0) return res.status(200).json({ ok: true, enviados: 0 })

  webpush.setVapidDetails('https://www.crumblabcookies.com', VAPID_PUBLIC, privada)
  const mensagem = JSON.stringify({
    titulo: String(titulo ?? 'Crumb Lab'),
    corpo: String(corpo ?? ''),
    url: String(url ?? '/crm/'),
  })

  const resultados = await Promise.allSettled(
    inscricoes.slice(0, 50).map((s) => webpush.sendNotification(s, mensagem, { TTL: 6 * 3600, urgency: 'high' })),
  )
  const enviados = resultados.filter((r) => r.status === 'fulfilled').length
  // 404/410 = o aparelho deixou de aceitar (desinstalou, limpou dados…)
  const expiradas = resultados
    .map((r, i) => (r.status === 'rejected' && [404, 410].includes(r.reason?.statusCode) ? inscricoes[i].endpoint : null))
    .filter(Boolean)

  return res.status(200).json({ ok: true, enviados, expiradas })
}
