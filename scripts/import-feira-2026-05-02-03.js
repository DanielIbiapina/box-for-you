/**
 * Importação — 2ª e 3ª feira (02/05/2026 e 03/05/2026)
 *
 * COMO USAR:
 * 1. Abra o app Crumb Lab no browser (local ou Vercel), desbloqueie com a senha
 * 2. DevTools → Console (F12)
 * 3. Cole TODO este ficheiro e prima Enter
 * 4. Vá a Configurações → "Enviar para a nuvem"
 *
 * NOTA dia 02/05: o relatório original tinha 65 registos (€247,00), mas o
 * export "Últimos registos" só incluiu 50 linhas. Este script importa essas 50.
 * Se tiver o export completo, avise para completarmos os 15 em falta.
 *
 * Seguro correr 2×: ignora dias já importados (import-feira2-* / import-feira3-*).
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

  const legacyCookies = [
    { id: 'legacy-mm', nome: 'M&M', short: 'M&M', emoji: '🍬', price: 3, image: '' },
    { id: 'legacy-bow', nome: 'Especial Brasil (BOW)', short: 'BOW', emoji: '🇧🇷', price: 3.5, image: '' },
    { id: 'legacy-brigadeiros', nome: '4 Brigadeiros', short: 'Brigadeiros', emoji: '🍫', price: 5, image: '' },
  ]

  function buildRecords(prefix, day, entries) {
    let seq = 0
    const id = () => `${prefix}-${String(++seq).padStart(3, '0')}`
    const at = (time, sec = 0) =>
      `${day}T${time}:${String(sec).padStart(2, '0')}.000+01:00`

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

    return entries({ demo, order, box })
  }

  // ── 02/05/2026 — 50 registos do export (65 no total original) ──────────────
  const feira2 = buildRecords('import-feira2', '2026-05-02', ({ demo, order, box }) => [
    order('14:02', 'MB WAY', 8.5, [['kinder', 1], ['mini', 1]], 0),
    order('14:02', 'Multibanco', 3.5, [['bow', 1]], 1),
    order('14:13', 'Multibanco', 7, [['nutella', 1], ['bow', 1]]),
    order('14:42', 'Dinheiro', 3.5, [['nutella', 1]]),
    order('14:52', 'Multibanco', 3.5, [['nutella', 1]]),
    order('14:58', 'Dinheiro', 5, [['mini', 1]]),
    order('15:02', 'Dinheiro', 8.5, [['bow', 1], ['mini', 1]]),
    demo('15:13', 'chocolate', 0),
    demo('15:13', 'mm', 1),
    demo('15:13', 'bow', 2),
    order('15:16', 'Dinheiro', 3.5, [['kinder', 1]]),
    order('15:26', 'Dinheiro', 5, [['brigadeiros', 1]], 0),
    box('15:26', 'Dinheiro', 10, [['chocolate', 2], ['mm', 1], ['bow', 1]], 1),
    order('15:33', 'Dinheiro', 5, [['brigadeiros', 1]], 0),
    order('15:33', 'Multibanco', 3, [['chocolate', 1]], 1),
    box('15:33', 'MB WAY', 10, [['chocolate', 1], ['kinder', 1], ['mm', 1], ['bow', 1]], 2),
    order('15:38', 'Dinheiro', 5, [['brigadeiros', 1]]),
    order('15:55', 'Dinheiro', 5, [['brigadeiros', 1]], 0),
    order('15:55', 'MB WAY', 3, [['chocolate', 1]], 1),
    box('15:55', 'MB WAY', 10, [['nutella', 1], ['kinder', 1], ['mm', 1], ['bow', 1]], 2),
    order('16:00', 'Dinheiro', 3.5, [['bow', 1]]),
    order('16:44', 'Multibanco', 6.5, [['mm', 1], ['bow', 1]], 0),
    demo('16:44', 'nutella', 1),
    order('16:45', 'Multibanco', 5, [['brigadeiros', 1]]),
    order('16:47', 'MB WAY', 3, [['chocolate', 1]]),
    order('16:51', 'Multibanco', 3.5, [['kinder', 1]]),
    order('16:59', 'Multibanco', 3.5, [['kinder', 1]]),
    demo('17:08', 'nutella', 0),
    order('17:15', 'Dinheiro', 3, [['chocolate', 1]], 0),
    order('17:15', 'Multibanco', 3, [['chocolate', 1]], 1),
    order('17:30', 'Dinheiro', 3.5, [['nutella', 1]], 0),
    demo('17:30', 'bow', 1),
    order('17:34', 'MB WAY', 3.5, [['bow', 1]]),
    order('17:45', 'Multibanco', 6.5, [['kinder', 1], ['mm', 1]]),
    order('18:00', 'MB WAY', 3.5, [['nutella', 1]]),
    order('18:07', 'Multibanco', 3.5, [['bow', 1]]),
    order('18:15', 'Multibanco', 3.5, [['nutella', 1]]),
    order('18:28', 'Multibanco', 3.5, [['bow', 1]]),
    order('18:34', 'Dinheiro', 3.5, [['bow', 1]], 0),
    order('18:34', 'Multibanco', 3.5, [['bow', 1]], 1),
    order('18:41', 'Dinheiro', 3.5, [['nutella', 1]]),
    box('19:02', 'Multibanco', 10, [['chocolate', 2], ['nutella', 1], ['bow', 1]], 0),
    order('19:02', 'Dinheiro', 3.5, [['nutella', 1]], 1),
    order('19:03', 'MB WAY', 3.5, [['bow', 1]]),
    order('19:13', 'Multibanco', 3.5, [['nutella', 1]]),
    demo('19:14', 'chocolate', 0),
    box('19:19', 'Multibanco', 10, [['nutella', 2], ['kinder', 1], ['bow', 1]]),
    order('19:34', 'Multibanco', 3.5, [['bow', 1]]),
    demo('19:40', 'chocolate', 0),
    box('23:53', 'MB WAY', 10, [['kinder', 1], ['mm', 1], ['bow', 2]]),
  ])

  // ── 03/05/2026 — 45 registos (completo) ────────────────────────────────────
  const feira3 = buildRecords('import-feira3', '2026-05-03', ({ demo, order, box }) => [
    order('10:43', 'Dinheiro', 6.5, [['kinder', 1], ['mm', 1]]),
    order('11:01', 'Multibanco', 3, [['chocolate', 1]], 0),
    order('11:01', 'Multibanco', 5, [['brigadeiros', 1]], 1),
    order('11:33', 'Multibanco', 5, [['mini', 1]]),
    order('11:57', 'Dinheiro', 3.5, [['kinder', 1]]),
    order('12:05', 'Dinheiro', 3.5, [['kinder', 1]]),
    demo('12:25', 'chocolate', 0),
    demo('12:25', 'mm', 1),
    order('12:49', 'Multibanco', 5, [['brigadeiros', 1]]),
    order('13:39', 'Multibanco', 3.5, [['bow', 1]]),
    demo('13:52', 'bow', 0),
    order('14:17', 'Multibanco', 5, [['mini', 1]]),
    order('14:36', 'Multibanco', 5, [['brigadeiros', 1]]),
    demo('14:46', 'chocolate', 0),
    order('15:06', 'Dinheiro', 7, [['nutella', 1], ['kinder', 1]]),
    order('15:10', 'Dinheiro', 3, [['chocolate', 1]]),
    order('15:40', 'MB WAY', 7, [['kinder', 1], ['bow', 1]]),
    order('15:49', 'MB WAY', 6.5, [['chocolate', 1], ['nutella', 1]]),
    order('16:07', 'Dinheiro', 3, [['chocolate', 1]], 0),
    order('16:07', 'Multibanco', 6.5, [['chocolate', 1], ['nutella', 1]], 1),
    order('16:21', 'Multibanco', 3.5, [['nutella', 1]]),
    order('16:22', 'Multibanco', 3.5, [['kinder', 1]]),
    order('16:23', 'Dinheiro', 3, [['chocolate', 1]]),
    demo('16:27', 'mm', 0),
    demo('16:27', 'bow', 1),
    order('16:37', 'Dinheiro', 6, [['chocolate', 1], ['mm', 1]]),
    order('16:42', 'Dinheiro', 6.5, [['mm', 1], ['bow', 1]]),
    box('16:54', 'MB WAY', 10, [['nutella', 1], ['mm', 1], ['bow', 2]]),
    order('17:05', 'Multibanco', 3, [['chocolate', 1]]),
    order('17:08', 'Multibanco', 3.5, [['bow', 1]]),
    order('17:16', 'Multibanco', 3.5, [['kinder', 1]]),
    order('17:21', 'Dinheiro', 3, [['chocolate', 1]]),
    demo('17:24', 'nutella', 0),
    demo('17:52', 'mm', 0),
    demo('17:52', 'mm', 1),
    order('18:04', 'Multibanco', 3, [['mm', 1]]),
    order('18:18', 'Dinheiro', 3, [['chocolate', 1]]),
    demo('18:21', 'mm', 0),
    demo('18:21', 'chocolate', 1),
    demo('18:21', 'bow', 2),
    order('18:24', 'Multibanco', 3, [['chocolate', 1]]),
    order('18:30', 'Dinheiro', 3, [['chocolate', 1]], 0),
    order('18:30', 'Multibanco', 3.5, [['nutella', 1]], 1),
    order('18:56', 'Dinheiro', 3.5, [['nutella', 1]]),
    order('22:49', 'Dinheiro', 10, [['kinder', 1], ['mm', 1], ['bow', 1]]),
  ])

  // ── Aplicar importações ────────────────────────────────────────────────────
  let existing = []
  try {
    existing = JSON.parse(localStorage.getItem(SALES_KEY) || '[]')
  } catch {
    existing = []
  }

  const results = []
  const batches = [
    { prefix: 'import-feira2-', label: '02/05/2026', records: feira2, expectedTotal: 247, note: '50 de 65 registos (export parcial)' },
    { prefix: 'import-feira3-', label: '03/05/2026', records: feira3, expectedTotal: 152.5, note: 'completo' },
  ]

  for (const batch of batches) {
    if (existing.some((s) => String(s.id).startsWith(batch.prefix))) {
      results.push({ label: batch.label, skipped: true })
      continue
    }
    existing = [...existing, ...batch.records]
    const total = batch.records.filter((s) => s.totalEur > 0).reduce((s, x) => s + x.totalEur, 0)
    const demos = batch.records.filter((s) => s.kind === 'demo').length
    results.push({
      label: batch.label,
      skipped: false,
      count: batch.records.length,
      demos,
      total,
      note: batch.note,
      expectedTotal: batch.expectedTotal,
    })
  }

  localStorage.setItem(SALES_KEY, JSON.stringify(existing))

  // Cookies legacy (só adiciona se ainda não existirem)
  let cookies = []
  try {
    cookies = JSON.parse(localStorage.getItem(COOKIES_KEY) || '[]')
  } catch {
    cookies = []
  }
  const ids = new Set(cookies.map((c) => c.id))
  const mergedCookies = [...cookies, ...legacyCookies.filter((c) => !ids.has(c.id))]
  if (mergedCookies.length > cookies.length) {
    localStorage.setItem(COOKIES_KEY, JSON.stringify(mergedCookies))
  }

  // ── Resumo ─────────────────────────────────────────────────────────────────
  const imported = results.filter((r) => !r.skipped)
  const skipped = results.filter((r) => r.skipped)

  if (imported.length === 0) {
    console.warn('⚠️ Nada importado — ambos os dias já existem.')
    alert('02/05 e 03/05 já foram importados anteriormente.')
    return
  }

  for (const r of imported) {
    console.log(`✅ ${r.label}: ${r.count} registos (${r.demos} demos) — €${r.total.toFixed(2)} [${r.note}]`)
    if (r.expectedTotal && Math.abs(r.total - r.expectedTotal) > 0.01) {
      console.warn(`   ⚠️ Total importado (€${r.total.toFixed(2)}) ≠ relatório original (€${r.expectedTotal.toFixed(2)})`)
    }
  }
  for (const r of skipped) {
    console.log(`⏭️ ${r.label}: já importado, ignorado`)
  }

  console.log(`   Total no storage: ${existing.length} registos`)
  console.log('→ Configurações → Enviar para a nuvem')

  const lines = imported.map(
    (r) =>
      `${r.label}: ${r.count} registos — €${r.total.toFixed(2)}` +
      (r.expectedTotal && Math.abs(r.total - r.expectedTotal) > 0.01
        ? `\n  (relatório original: €${r.expectedTotal.toFixed(2)} — ${r.note})`
        : ''),
  )

  alert(
    `Importação concluída!\n\n${lines.join('\n\n')}` +
      (skipped.length ? `\n\nIgnorados (já existiam): ${skipped.map((r) => r.label).join(', ')}` : '') +
      `\n\nPróximo passo: Configurações → Enviar para a nuvem`,
  )
})()
