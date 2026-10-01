/* Service worker do CRM (Crumb Lab — Gestão).
 *
 * Só serve para as notificações push: quando a loja recebe um pedido, o banco
 * avisa a Vercel (api/notificar.js), que manda o aviso para cá — e isto mostra
 * a notificação no telemóvel/iPad, mesmo com a app fechada.
 * Não guarda nada em cache: a app continua a carregar sempre da rede.
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let dados
  try { dados = event.data ? event.data.json() : {} } catch { dados = { corpo: event.data?.text() ?? '' } }

  const titulo = dados.titulo || 'Crumb Lab'
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.corpo || '',
      icon: '/icon-192.png',
      badge: '/favicon-192.png',
      tag: 'pedido-novo',
      renotify: true,
      data: { url: dados.url || '/crm/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const alvo = new URL(event.notification.data?.url || '/crm/', self.location.origin).href
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const j of janelas) {
      if (j.url.startsWith(self.location.origin + '/crm')) {
        await j.focus()
        return
      }
    }
    await self.clients.openWindow(alvo)
  })())
})
