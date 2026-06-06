/**
 * Importação — 1ª feira (01/05/2026)
 *
 * COMO USAR:
 * 1. Abra o app Crumb Lab no browser (local ou Vercel), desbloqueie com a senha
 * 2. DevTools → Console (F12)
 * 3. Cole TODO este ficheiro e prima Enter
 * 4. Vá a Configurações → "Enviar para a nuvem" (ou aguarde o sync automático)
 *
 * Seguro correr 2×: ignora se já existir import-feira1-* nos registos.
 */

(() => {
  const SALES_KEY = 'cookies-sales:v1'
  const COOKIES_KEY = 'bfy:feiras-cookies'

  const F = {
    chocolate: 'chocolate-triplo',
    nutella: 'nutella',
    kinder: 'kinder-bueno',
    mm: 'legacy-mm',
    bow: 'legacy-bow',
    mini: 'mini-box',
    brigadeiros: 'legacy-brigadeiros',
  }

  const pay = {
    Dinheiro: 'dinheiro',
    'MB WAY': 'mbway',
    Multibanco: 'multibanco',
  }

  const DAY = '2026-05-01'
  let seq = 0

  const id = () => `import-feira1-${String(++seq).padStart(3, '0')}`
  const at = (time, sec = 0) =>
    `${DAY}T${time}:${String(sec).padStart(2, '0')}.000+01:00`

  const demo = (time, flavorKey, sec = 0) => ({
    id: id(),
    createdAt: at(time, sec),
    kind: 'demo',
    demoFlavorId: F[flavorKey],
    flavorId: null,
    boxFlavors: [],
    paymentId: 'gratis',
    totalEur: 0,
  })

  const order = (time, payment, total, lines, sec = 0) => ({
    id: id(),
    createdAt: at(time, sec),
    kind: 'order',
    lines: lines.map(([k, qty]) => ({ productId: F[k], qty })),
    flavorId: null,
    boxFlavors: [],
    paymentId: pay[payment],
    totalEur: total,
  })

  const box = (time, payment, total, counts, sec = 0) => {
    const boxFlavors = []
    for (const [k, n] of counts) {
      for (let i = 0; i < n; i++) boxFlavors.push(F[k])
    }
    return {
      id: id(),
      createdAt: at(time, sec),
      kind: 'box',
      flavorId: null,
      boxFlavors,
      paymentId: pay[payment],
      totalEur: total,
    }
  }

  // Registos em ordem cronológica (mais antigo → mais recente)
  const imported = [
    demo('14:05', 'nutella', 0),
    demo('14:05', 'mm', 1),
    demo('14:05', 'bow', 2),
    order('14:43', 'Dinheiro', 5, [['mini', 1]]),
    order('15:00', 'Dinheiro', 3.5, [['bow', 1]]),
    order('15:07', 'MB WAY', 7, [['bow', 2]]),
    order('15:17', 'Dinheiro', 3.5, [['bow', 1]]),
    box('15:25', 'Dinheiro', 10, [['chocolate', 2], ['bow', 2]]),
    order('15:26', 'Dinheiro', 5, [['mini', 1]]),
    demo('15:31', 'chocolate', 0),
    demo('15:31', 'bow', 1),
    order('15:43', 'Multibanco', 3.5, [['bow', 1]]),
    order('15:57', 'Dinheiro', 3.5, [['bow', 1]]),
    box('15:57', 'Dinheiro', 10, [['bow', 4]]),
    order('16:01', 'Dinheiro', 3, [['chocolate', 1]]),
    order('16:04', 'MB WAY', 3.5, [['bow', 1]]),
    box('16:15', 'Dinheiro', 10, [['chocolate', 2], ['mm', 1], ['bow', 1]]),
    order('16:24', 'Multibanco', 5, [['brigadeiros', 1]]),
    demo('16:26', 'kinder', 0),
    demo('16:26', 'nutella', 1),
    demo('16:27', 'chocolate', 0),
    order('16:31', 'MB WAY', 10, [['mini', 1], ['brigadeiros', 1]]),
    box('16:42', 'MB WAY', 10, [['chocolate', 1], ['nutella', 1], ['kinder', 1], ['mm', 1]]),
    order('16:47', 'Multibanco', 5, [['brigadeiros', 1]]),
    box('16:51', 'Dinheiro', 10, [['chocolate', 1], ['kinder', 1], ['mm', 1], ['bow', 1]]),
    order('16:55', 'Multibanco', 3, [['chocolate', 1]]),
    order('17:03', 'MB WAY', 3, [['chocolate', 1]]),
    order('17:14', 'Multibanco', 3, [['chocolate', 1]], 0),
    order('17:14', 'MB WAY', 3.5, [['bow', 1]], 1),
    demo('17:19', 'mm', 0),
    demo('17:19', 'nutella', 1),
    order('17:20', 'Dinheiro', 3, [['mm', 1]]),
    order('17:21', 'MB WAY', 3, [['mm', 1]]),
    order('17:24', 'Multibanco', 3.5, [['nutella', 1]]),
    order('17:27', 'Dinheiro', 3.5, [['nutella', 1]]),
    demo('17:32', 'nutella', 0),
    order('17:56', 'Multibanco', 6.5, [['nutella', 1], ['mm', 1]]),
    box('18:03', 'MB WAY', 10, [['chocolate', 1], ['nutella', 1], ['kinder', 2]], 0),
    box('18:03', 'MB WAY', 10, [['chocolate', 1], ['nutella', 1], ['kinder', 1], ['mm', 1]], 1),
    order('18:21', 'Multibanco', 6.5, [['nutella', 1], ['mm', 1]]),
    order('19:22', 'Dinheiro', 3.5, [['nutella', 1]]),
  ]

  const legacyCookies = [
    { id: 'legacy-mm', nome: 'M&M', short: 'M&M', emoji: '🍬', price: 3, image: '' },
    { id: 'legacy-bow', nome: 'Especial Brasil (BOW)', short: 'BOW', emoji: '🇧🇷', price: 3.5, image: '' },
    { id: 'legacy-brigadeiros', nome: '4 Brigadeiros', short: 'Brigadeiros', emoji: '🍫', price: 5, image: '' },
  ]

  // ── Verificar duplicado ──
  let existing = []
  try {
    existing = JSON.parse(localStorage.getItem(SALES_KEY) || '[]')
  } catch {
    existing = []
  }

  if (existing.some((s) => String(s.id).startsWith('import-feira1-'))) {
    console.warn('⚠️ Importação já feita — nada alterado.')
    alert('Esta feira já foi importada anteriormente.')
    return
  }

  // Novos registos no fim (são mais antigos que vendas recentes)
  const mergedSales = [...existing, ...imported]
  localStorage.setItem(SALES_KEY, JSON.stringify(mergedSales))

  // Cookies legacy para os nomes aparecerem nos relatórios
  let cookies = []
  try {
    cookies = JSON.parse(localStorage.getItem(COOKIES_KEY) || '[]')
  } catch {
    cookies = []
  }
  const ids = new Set(cookies.map((c) => c.id))
  const mergedCookies = [...cookies, ...legacyCookies.filter((c) => !ids.has(c.id))]
  localStorage.setItem(COOKIES_KEY, JSON.stringify(mergedCookies))

  const total = imported.filter((s) => s.totalEur > 0).reduce((s, x) => s + x.totalEur, 0)
  const demos = imported.filter((s) => s.kind === 'demo').length

  console.log(`✅ Importados ${imported.length} registos (${demos} demos)`)
  console.log(`   Total histórico: €${total.toFixed(2)}`)
  console.log(`   Total no storage: ${mergedSales.length} registos`)
  console.log('→ Agora vá a Configurações → Enviar para a nuvem')

  alert(
    `Importação concluída!\n\n` +
      `${imported.length} registos da feira de 01/05/2026\n` +
      `Total: €${total.toFixed(2)}\n\n` +
      `Próximo passo: Configurações → Enviar para a nuvem`,
  )
})()
