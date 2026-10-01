#!/usr/bin/env node
/**
 * Cópia de segurança manual de todos os dados do Supabase.
 *
 *   npm run backup
 *
 * Pede o email e a senha da conta da dona (a senha não aparece no ecrã e não
 * fica gravada em lado nenhum) e descarrega cada tabela para
 * backups/AAAA-MM-DD_HHMM/<tabela>.json. A pasta backups/ não vai para o git —
 * tem dados de clientes, guarda-a só neste computador.
 *
 * Usa a conta da dona de propósito: com a conta da feira, o RLS esconde
 * receitas, clientes, pedidos e despesas, e a cópia ficaria incompleta.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createInterface } from 'readline'
import { createClient } from '@supabase/supabase-js'

// tabela → colunas para ordenar (ordem estável = paginação sem saltar linhas)
const TABELAS = [
  ['configuracao', ['id']],
  ['cookies_catalogo', ['id']],
  ['estoque', ['tipo', 'cookie_id']],
  ['eventos', ['id']],
  ['vendas', ['id']],
  ['pedidos', ['id']],
  ['clientes', ['id']],
  ['despesas', ['id']],
  ['custos_fixos', ['id']],
  ['receitas', ['id']],
  ['ingredientes', ['id']],
  ['movimentacoes', ['id']],
]
const PAGINA = 1000

function lerEnv() {
  try {
    return Object.fromEntries(
      readFileSync('.env', 'utf8').split(/\r?\n/)
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    )
  } catch {
    return {}
  }
}

/** Pergunta no terminal; com `esconder`, a resposta aparece como asteriscos. */
function perguntar(texto, { esconder = false } = {}) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    process.stdout.write(texto)
    if (esconder) rl._writeToOutput = () => rl.output.write('*')
    rl.question('', (resposta) => {
      rl.close()
      if (esconder) process.stdout.write('\n')
      resolve(resposta.trim())
    })
  })
}

async function lerTabela(sb, tabela, ordens) {
  const linhas = []
  for (let pagina = 0; pagina < 200; pagina++) {
    let q = sb.from(tabela).select('*')
    for (const coluna of ordens) q = q.order(coluna, { ascending: true })
    const de = pagina * PAGINA
    const { data, error } = await q.range(de, de + PAGINA - 1)
    if (error) throw new Error(`${tabela}: ${error.message}`)
    linhas.push(...data)
    if (data.length < PAGINA) break
  }
  return linhas
}

const carimbo = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`
}

async function main() {
  const env = { ...lerEnv(), ...process.env }
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.')
    process.exit(1)
  }

  console.log('Cópia de segurança — Crumb Lab\n')
  const email = env.BACKUP_EMAIL || await perguntar('Email da conta da dona: ')
  const senha = env.BACKUP_PASSWORD || await perguntar('Senha: ', { esconder: true })

  const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { data: sessao, error: eLogin } = await sb.auth.signInWithPassword({ email, password: senha })
  if (eLogin) {
    console.error(`\nNão deu para entrar: ${eLogin.message}`)
    process.exit(1)
  }
  if (sessao.user?.app_metadata?.role === 'feira') {
    console.error('\nEssa é uma conta de feira — não vê tudo. Usa a conta da dona.')
    await sb.auth.signOut()
    process.exit(1)
  }

  const pasta = join('backups', carimbo())
  mkdirSync(pasta, { recursive: true })
  const resumo = { criadoEm: new Date().toISOString(), conta: email, tabelas: {} }

  console.log('')
  for (const [tabela, ordens] of TABELAS) {
    const linhas = await lerTabela(sb, tabela, ordens)
    writeFileSync(join(pasta, `${tabela}.json`), JSON.stringify(linhas, null, 2))
    resumo.tabelas[tabela] = linhas.length
    console.log(`  ${tabela.padEnd(18)} ${String(linhas.length).padStart(6)} linhas`)
  }
  writeFileSync(join(pasta, '_resumo.json'), JSON.stringify(resumo, null, 2))
  await sb.auth.signOut()

  console.log(`\nPronto. Cópia guardada em ${pasta}`)
}

main().catch((e) => {
  console.error(`\nA cópia falhou: ${e.message}`)
  process.exit(1)
})
