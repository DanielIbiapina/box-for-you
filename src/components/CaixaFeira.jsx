import { useState } from 'react'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { resumoCaixa, contagemComparada, fmtHora, fmtDia } from '../stores/useCaixa'

// Abrir e fechar o caixa da feira: troco, contagem do que vai (mini cookies,
// embalagens, o que for) e, no fim, dinheiro contado contra o esperado.

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const PAGAMENTOS = [
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'mbway', label: 'MB WAY' },
  { id: 'multibanco', label: 'Multibanco' },
]

/** Aceita "12,50" e "12.50". */
const num = (s) => {
  const n = parseFloat(String(s ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

// ─── Abrir ────────────────────────────────────────────────────────────────────

export function AbrirCaixa({ sugestao, feiraNome, onAbrir, onSemCaixa, onClose }) {
  const [fundo, setFundo] = useState(sugestao.fundoInicial)
  const [itens, setItens] = useState(sugestao.itens)

  function submeter(e) {
    e.preventDefault()
    onAbrir({ fundoInicial: num(fundo) ?? 0, itens: itens.map((x) => ({ ...x, qty: num(x.qty) })) })
  }

  return (
    <Modal title="Abrir caixa" onClose={onClose} size="sm">
      <form onSubmit={submeter} className="space-y-5">
        {feiraNome && (
          <p className="ink-3" style={{ fontSize: 'var(--text-sm)' }}>
            Hoje é <strong className="ink-1">{feiraNome}</strong>.
          </p>
        )}

        <label className="block">
          <span className="bfy-label">Troco na caixa (€)</span>
          <input
            className="bfy-input bfy-num"
            inputMode="decimal"
            placeholder="0,00"
            value={fundo}
            onChange={(e) => setFundo(e.target.value)}
          />
          <span className="bfy-hint">O dinheiro que vai na caixa para dar troco.</span>
        </label>

        <div>
          <p className="bfy-label">O que vai para a feira</p>
          <p className="bfy-hint mb-2" style={{ marginTop: 0 }}>
            Conta o que levas. Ao fechar, contas o que sobrou e vês quanto saiu.
          </p>
          <ItensEditor itens={itens} onChange={setItens} podeAdicionar />
        </div>

        <div className="space-y-2 pt-1">
          <button type="submit" className="btn-primary btn-block">
            <Icon name="caixa" size={16} /> Abrir caixa e vender
          </button>
          <button type="button" className="btn-ghost btn-block btn-sm" onClick={onSemCaixa}>
            Vender sem abrir caixa
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Fechar ───────────────────────────────────────────────────────────────────

export function FecharCaixa({ caixa, sales, onFechar, onClose }) {
  const resumo = resumoCaixa(caixa, sales)
  const [contado, setContado] = useState('')
  const [itens, setItens] = useState(
    (caixa.contagemInicial ?? []).map((x) => ({ nome: x.nome, qty: '', levou: x.qty })),
  )
  const [notas, setNotas] = useState('')

  const contadoNum = num(contado)
  const diferenca = contadoNum == null ? null : Math.round((contadoNum - resumo.esperado) * 100) / 100

  function submeter(e) {
    e.preventDefault()
    if (contadoNum == null) return
    onFechar({
      dinheiroContado: contadoNum,
      itens: itens.map(({ nome, qty }) => ({ nome, qty: num(qty) })),
      notas,
    })
  }

  return (
    <Modal title="Fechar caixa" onClose={onClose} size="sm">
      <form onSubmit={submeter} className="space-y-5">
        <p className="ink-3" style={{ fontSize: 'var(--text-sm)' }}>
          Aberto às {fmtHora(caixa.abertoEm)} · {resumo.vendas} venda{resumo.vendas !== 1 ? 's' : ''} · {fmtEuro(resumo.total)}
        </p>

        <div className="bfy-sunk p-3 space-y-1.5">
          <Linha label="Troco ao abrir" valor={fmtEuro(caixa.fundoInicial)} />
          <Linha
            label={`Vendas em dinheiro (${resumo.porPagamento.dinheiro?.count ?? 0})`}
            valor={`+ ${fmtEuro(resumo.dinheiro)}`}
          />
          <div className="flex justify-between gap-3 pt-1.5" style={{ borderTop: '1px solid var(--line-1)' }}>
            <span className="font-bold ink-1">Deve haver na caixa</span>
            <span className="font-black bfy-num ink-1">{fmtEuro(resumo.esperado)}</span>
          </div>
        </div>

        <label className="block">
          <span className="bfy-label">Dinheiro contado (€) *</span>
          <input
            className="bfy-input bfy-num"
            inputMode="decimal"
            placeholder="0,00"
            required
            value={contado}
            onChange={(e) => setContado(e.target.value)}
          />
          {diferenca != null && <Diferenca valor={diferenca} />}
        </label>

        <div className="space-y-1.5">
          <p className="bfy-label">Outros pagamentos</p>
          {PAGAMENTOS.filter((p) => p.id !== 'dinheiro').map((p) => (
            <Linha
              key={p.id}
              label={`${p.label} (${resumo.porPagamento[p.id]?.count ?? 0})`}
              valor={fmtEuro(resumo.porPagamento[p.id]?.eur ?? 0)}
            />
          ))}
        </div>

        {itens.length > 0 && (
          <div>
            <p className="bfy-label">O que sobrou</p>
            <ItensEditor itens={itens} onChange={setItens} mostrarUso />
          </div>
        )}

        <label className="block">
          <span className="bfy-label">Notas</span>
          <textarea
            className="bfy-input"
            rows={2}
            placeholder="Ex.: 5 € de troco emprestados à banca do lado"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
          />
        </label>

        <button type="submit" className="btn-primary btn-block" disabled={contadoNum == null}>
          <Icon name="check" size={16} /> Fechar caixa
        </button>
      </form>
    </Modal>
  )
}

// ─── Ver um caixa (aberto ou fechado) ─────────────────────────────────────────

export function CaixaDetalhe({ caixa, sales, eventoNome, podeGerir, onReabrir, onApagar, onClose }) {
  const resumo = resumoCaixa(caixa, sales)
  const contagem = contagemComparada(caixa)

  return (
    <Modal title={`Caixa · ${fmtDia(caixa.dia)}`} onClose={onClose} size="sm">
      <div className="space-y-5">
        <p className="ink-3" style={{ fontSize: 'var(--text-sm)' }}>
          {eventoNome ? `${eventoNome} · ` : ''}
          {fmtHora(caixa.abertoEm)} – {caixa.fechadoEm ? fmtHora(caixa.fechadoEm) : 'aberto'}
          {caixa.abertoPor ? ` · ${caixa.abertoPor}` : ''}
        </p>

        <div className="bfy-sunk p-3 space-y-1.5">
          <Linha label="Troco ao abrir" valor={fmtEuro(caixa.fundoInicial)} />
          <Linha label="Vendas em dinheiro" valor={`+ ${fmtEuro(resumo.dinheiro)}`} />
          <Linha label="Devia haver" valor={fmtEuro(resumo.esperado)} forte />
          {caixa.dinheiroContado != null && (
            <>
              <Linha label="Contado" valor={fmtEuro(caixa.dinheiroContado)} forte />
              <Diferenca valor={resumo.diferenca} />
            </>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="bfy-label">Vendas neste caixa</p>
          {PAGAMENTOS.map((p) => (
            <Linha
              key={p.id}
              label={`${p.label} (${resumo.porPagamento[p.id]?.count ?? 0})`}
              valor={fmtEuro(resumo.porPagamento[p.id]?.eur ?? 0)}
            />
          ))}
          <Linha label="Total" valor={fmtEuro(resumo.total)} forte />
        </div>

        {contagem.length > 0 && (
          <div>
            <p className="bfy-label">Contagem</p>
            <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 gap-y-1.5 items-baseline" style={{ fontSize: 'var(--text-sm)' }}>
              <span />
              <span className="bfy-eyebrow text-right">Levou</span>
              <span className="bfy-eyebrow text-right">Sobrou</span>
              <span className="bfy-eyebrow text-right">Saiu</span>
              {contagem.map((x) => (
                <LinhaContagem key={x.nome} x={x} />
              ))}
            </div>
          </div>
        )}

        {caixa.notas && (
          <p className="bfy-sunk p-3 ink-2" style={{ fontSize: 'var(--text-sm)' }}>{caixa.notas}</p>
        )}

        {podeGerir && (
          <div className="flex gap-2">
            {caixa.fechadoEm && (
              <button type="button" className="btn-ghost flex-1" onClick={onReabrir}>
                Reabrir
              </button>
            )}
            <button type="button" className="btn-danger flex-1" onClick={onApagar}>
              <Icon name="lixo" size={15} /> Apagar
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function LinhaContagem({ x }) {
  const n = (v) => (v == null ? '—' : v)
  return (
    <>
      <span className="ink-1 truncate">{x.nome}</span>
      <span className="bfy-num text-right ink-2">{n(x.levou)}</span>
      <span className="bfy-num text-right ink-2">{n(x.sobrou)}</span>
      <span className="bfy-num text-right font-bold ink-1">{n(x.usou)}</span>
    </>
  )
}

// ─── Peças ────────────────────────────────────────────────────────────────────

/**
 * Lista de contagem. Ao abrir dá para acrescentar e tirar produtos; ao fechar
 * só se conta o que sobrou, e mostra-se quanto saiu.
 */
function ItensEditor({ itens, onChange, podeAdicionar = false, mostrarUso = false }) {
  const [novo, setNovo] = useState('')

  const mudar = (i, qty) => onChange(itens.map((x, j) => (j === i ? { ...x, qty } : x)))
  const passo = (i, d) => {
    const atual = num(itens[i].qty) ?? 0
    mudar(i, String(Math.max(0, atual + d)))
  }
  const tirar = (i) => onChange(itens.filter((_, j) => j !== i))

  function adicionar() {
    const nome = novo.trim()
    if (!nome) return
    if (itens.some((x) => x.nome.toLowerCase() === nome.toLowerCase())) { setNovo(''); return }
    onChange([...itens, { nome, qty: '' }])
    setNovo('')
  }

  return (
    <div className="space-y-2">
      {itens.map((x, i) => {
        const sobrou = num(x.qty)
        const usou = mostrarUso && sobrou != null && x.levou != null ? x.levou - sobrou : null
        return (
          <div key={x.nome} className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate ink-1" style={{ fontSize: 'var(--text-sm)' }}>{x.nome}</p>
              {mostrarUso && (
                <p className="ink-3" style={{ fontSize: 'var(--text-2xs)' }}>
                  Levou {x.levou ?? '—'}{usou != null ? ` · saiu ${usou}` : ''}
                </p>
              )}
            </div>
            <button type="button" className="btn-step" aria-label={`Menos ${x.nome}`} onClick={() => passo(i, -1)}>
              <Icon name="menos" size={16} />
            </button>
            <input
              className="bfy-input bfy-num text-center"
              style={{ width: '4.25rem', paddingLeft: '0.25rem', paddingRight: '0.25rem' }}
              inputMode="numeric"
              placeholder="0"
              aria-label={x.nome}
              value={x.qty}
              onChange={(e) => mudar(i, e.target.value.replace(/[^\d]/g, ''))}
            />
            <button type="button" className="btn-step" aria-label={`Mais ${x.nome}`} onClick={() => passo(i, 1)}>
              <Icon name="mais" size={16} />
            </button>
            {podeAdicionar && (
              <button type="button" className="btn-icon-sm" aria-label={`Tirar ${x.nome}`} onClick={() => tirar(i)}>
                <Icon name="fechar" size={14} />
              </button>
            )}
          </div>
        )
      })}

      {podeAdicionar && (
        <div className="flex gap-2 pt-1">
          <input
            className="bfy-input flex-1"
            placeholder="Outro produto…"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar() } }}
          />
          <button type="button" className="btn-ghost btn-sm shrink-0" onClick={adicionar} disabled={!novo.trim()}>
            <Icon name="mais" size={14} /> Adicionar
          </button>
        </div>
      )}
    </div>
  )
}

function Linha({ label, valor, forte = false }) {
  return (
    <div className="flex justify-between gap-3" style={{ fontSize: 'var(--text-sm)' }}>
      <span className={forte ? 'font-bold ink-1' : 'ink-2'}>{label}</span>
      <span className={`bfy-num shrink-0 ${forte ? 'font-black ink-1' : 'font-bold ink-1'}`}>{valor}</span>
    </div>
  )
}

function Diferenca({ valor }) {
  if (valor == null) return null
  const certo = Math.abs(valor) < 0.005
  const cor = certo ? 'var(--color-success)' : valor > 0 ? 'var(--color-accent-dark)' : 'var(--color-danger)'
  const texto = certo
    ? 'Bate certo'
    : valor > 0
      ? `Sobram ${fmtEuro(valor)}`
      : `Faltam ${fmtEuro(-valor)}`
  return (
    <p className="font-bold mt-1.5 flex items-center gap-1.5" style={{ color: cor, fontSize: 'var(--text-sm)' }}>
      <Icon name={certo ? 'check' : 'alerta'} size={15} /> {texto}
    </p>
  )
}
