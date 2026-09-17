import { useState, useMemo } from 'react'
import { useReceitas } from '../stores/useReceitas'
import { useEstoque } from '../stores/useEstoque'
import { Modal } from '../components/Modal'
import { Icon } from '../components/Icon'
import { expandirIngredientes, agruparIngredientes, tipoComponente } from '../lib/receitaExpand'

export function Producao() {
  const { receitas } = useReceitas()
  const { ingredientes, baixarEstoqueProducao } = useEstoque()

  const [fase, setFase] = useState(1)
  const [receitaId, setReceitaId] = useState('')
  const [quantidade, setQuantidade] = useState(24)
  const [confirmado, setConfirmado] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)

  const [planejarMode, setPlanejarMode] = useState(false)
  const [planejamento, setPlanejamento] = useState([])
  const [novoSabor, setNovoSabor] = useState({ receitaId: '', quantidade: 24 })
  const [feiraConfirmada, setFeiraConfirmada] = useState(false)
  const [showConfirmFeira, setShowConfirmFeira] = useState(false)

  const receita = receitas.find((r) => r.id === receitaId)
  const prodUnidade = receita && tipoComponente(receita) !== 'cookie' ? 'g' : 'cookies'
  const prodLabel = prodUnidade === 'g' ? 'gramas' : 'cookies'

  const pesoMassaTotal = useMemo(() => {
    if (!receita) return 0
    const fator = quantidade / (receita.rendimento || 1)
    const expandidos = expandirIngredientes(receita.ingredientes ?? [], fator, receitas)
    const totalPorBatch = expandidos
      .filter((i) => ['g', 'ml', 'kg', 'L'].includes(i.unidade))
      .reduce((sum, i) => {
        const mult = i.unidade === 'kg' || i.unidade === 'L' ? 1000 : 1
        return sum + (i.quantidade ?? 0) * mult
      }, 0)
    return totalPorBatch
  }, [receita, quantidade, receitas])

  const ingredientesNecessarios = useMemo(() => {
    if (!receita) return []
    const fator = quantidade / (receita.rendimento || 1)
    const expandidos = agruparIngredientes(
      expandirIngredientes(receita.ingredientes ?? [], fator, receitas),
    )
    return expandidos.map((ing) => {
      const ingEstoque = ing.ingredienteId
        ? ingredientes.find((i) => i.id === ing.ingredienteId)
        : null
      return {
        nome: ing._daBase ? `${ing.nome || ingEstoque?.nome || '?'} (${ing._daBase})` : ing.nome || ingEstoque?.nome || '?',
        ingredienteId: ing.ingredienteId || null,
        quantidade: ing.quantidade,
        unidade: ing.unidade,
        estoqueAtual: ingEstoque?.estoqueAtual ?? null,
        suficiente: ingEstoque ? ingEstoque.estoqueAtual >= ing.quantidade : null,
      }
    })
  }, [receita, quantidade, ingredientes, receitas])

  const listaUnificada = useMemo(() => {
    const mapa = {}
    for (const item of planejamento) {
      const r = receitas.find((x) => x.id === item.receitaId)
      if (!r) continue
      const fator = item.quantidade / (r.rendimento || 1)
      const expandidos = expandirIngredientes(r.ingredientes ?? [], fator, receitas)
      for (const ing of expandidos) {
        const ingEstoque = ing.ingredienteId
          ? ingredientes.find((i) => i.id === ing.ingredienteId)
          : null
        const nome = ing.nome || ingEstoque?.nome || '?'
        const key = `${ing.ingredienteId || ''}_${nome}_${ing.unidade}`
        if (!mapa[key]) {
          mapa[key] = {
            nome,
            unidade: ing.unidade,
            total: 0,
            ingredienteId: ing.ingredienteId || null,
            estoqueAtual: ingEstoque?.estoqueAtual ?? null,
          }
        }
        mapa[key].total += ing.quantidade
      }
    }
    return Object.values(mapa).map((item) => ({
      ...item,
      suficiente: item.estoqueAtual !== null ? item.estoqueAtual >= item.total : null,
    }))
  }, [planejamento, receitas, ingredientes])

  function addAoPlanejamento() {
    if (!novoSabor.receitaId || novoSabor.quantidade <= 0) return
    setPlanejamento((p) => [...p, { ...novoSabor }])
    setNovoSabor({ receitaId: '', quantidade: 24 })
  }

  function handleConfirmarProducao() {
    const itens = ingredientesNecessarios
      .filter((i) => i.ingredienteId)
      .map((i) => ({ ingredienteId: i.ingredienteId, quantidade: i.quantidade }))
    baixarEstoqueProducao(itens, `Produção: ${receita?.nome} (${quantidade} ${prodUnidade})`)
    setConfirmado(true)
    setShowConfirmModal(false)
  }

  function handleConfirmarFeira() {
    const itens = listaUnificada
      .filter((i) => i.ingredienteId)
      .map((i) => ({ ingredienteId: i.ingredienteId, quantidade: i.total }))
    baixarEstoqueProducao(itens, 'Produção: Planejamento de Feira')
    setFeiraConfirmada(true)
    setShowConfirmFeira(false)
  }

  function exportarLista() {
    if (planejarMode) {
      const lines = [
        'Lista de Compras — Planejamento de Feira',
        `Gerado em: ${new Date().toLocaleString('pt-BR')}`,
        '',
        ...planejamento.map((it) => {
          const r = receitas.find((x) => x.id === it.receitaId)
          return `• ${r?.nome ?? it.receitaId}: ${it.quantidade} cookies`
        }),
        '',
        'INGREDIENTES NECESSÁRIOS:',
        ...listaUnificada.map((i) => `  ${i.nome}: ${i.total.toFixed(1)} ${i.unidade}`),
      ]
      navigator.clipboard?.writeText(lines.join('\n'))
      alert('Lista copiada para a área de transferência!')
    } else {
      if (!receita) return
      const lines = [
        `Produção: ${receita.nome}`,
        `Quantidade: ${quantidade} ${prodUnidade}`,
        `Massa total estimada: ${pesoMassaTotal.toFixed(0)} g`,
        '',
        'INGREDIENTES:',
        ...ingredientesNecessarios.map((i) => `  ${i.nome}: ${i.quantidade.toFixed(1)} ${i.unidade}`),
      ]
      navigator.clipboard?.writeText(lines.join('\n'))
      alert('Lista copiada para a área de transferência!')
    }
  }

  // ── Planejar Feira ────────────────────────────────────────────────────────
  if (planejarMode) {
    const temInsuficiente = listaUnificada.some((i) => i.suficiente === false)
    const temVinculados   = listaUnificada.some((i) => i.ingredienteId)

    return (
      <div className="bfy-page bfy-page-flow">
        <div className="flex items-center gap-3 mb-6">
          <button
            className="btn-ghost btn-sm"
            onClick={() => { setPlanejarMode(false); setFeiraConfirmada(false) }}
          >
            <Icon name="voltar" size={15} /> Voltar
          </button>
          <h1 className="bfy-page-title">Planear feira</h1>
        </div>

        {/* Adicionar receitas */}
        <div className="bfy-card p-5 mb-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--ink-3)' }}>
            Adicione as receitas e quantidades que planeja produzir:
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            <select
              className="bfy-input flex-1 min-w-0"
              value={novoSabor.receitaId}
              onChange={(e) => setNovoSabor((n) => ({ ...n, receitaId: e.target.value }))}
            >
              <option value="">— Selecionar receita —</option>
              {receitas.filter((r) => tipoComponente(r) === 'cookie').map((r) => (
                <option key={r.id} value={r.id}>{r.emoji ?? '🍪'} {r.nome}</option>
              ))}
            </select>
            <input
              className="bfy-input w-28"
              type="number"
              min="1"
              value={novoSabor.quantidade}
              onChange={(e) => setNovoSabor((n) => ({ ...n, quantidade: parseInt(e.target.value) || 0 }))}
              placeholder="Qtd"
            />
            <button className="btn-primary px-5" onClick={addAoPlanejamento}><Icon name="mais" size={15} /> Add</button>
          </div>

          {planejamento.length === 0 && (
            <p className="text-sm text-center py-2" style={{ color: 'var(--ink-4)' }}>
              Nenhuma receita adicionada ainda
            </p>
          )}
          {planejamento.map((item, i) => {
            const r = receitas.find((x) => x.id === item.receitaId)
            return (
              <div
                key={i}
                className="flex items-center gap-3 rounded-xl px-3 py-2 mb-1"
                style={{ background: 'var(--color-surface-sunk)' }}
              >
                <span className="text-lg">{r?.emoji ?? '🍪'}</span>
                <span className="flex-1 font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                  {r?.nome ?? item.receitaId}
                </span>
                <span className="text-sm font-bold" style={{ color: 'var(--color-accent-dark)' }}>
                  {item.quantidade} cookies
                </span>
                <button
                  className="opacity-40 hover:opacity-70 text-xl leading-none"
                  onClick={() => setPlanejamento((p) => p.filter((_, j) => j !== i))}
                >×</button>
              </div>
            )
          })}
        </div>

        {/* Lista unificada de ingredientes */}
        {listaUnificada.length > 0 && (
          <div className="bfy-card p-5">
            <div className="flex items-center justify-between gap-2 mb-3 min-w-0">
              <h2
                className="text-lg font-black min-w-0 truncate bfy-card-title"
              >
                Ingredientes Necessários
              </h2>
              <button className="btn-ghost btn-sm shrink-0" onClick={exportarLista}>
                Copiar
              </button>
            </div>

            {temInsuficiente && (
              <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(229,115,115,0.1)' }}>
                <p className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>
                  Alguns ingredientes estão insuficientes no estoque
                </p>
              </div>
            )}

            <div className="space-y-2 mb-4">
              {listaUnificada.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl px-4 py-2.5"
                  style={{
                    background: item.suficiente === false
                      ? 'rgba(229,115,115,0.1)'
                      : item.suficiente === true
                      ? 'rgba(90,158,133,0.1)'
                      : 'var(--color-surface-sunk)',
                  }}
                >
                  <div>
                    <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                      {item.nome}
                    </p>
                    {item.estoqueAtual !== null && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>
                        Estoque: {item.estoqueAtual.toFixed(1)} {item.unidade}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                      {item.total.toFixed(1)} {item.unidade}
                    </p>
                    {item.suficiente === false && (
                      <p className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>Falta</p>
                    )}
                    {item.suficiente === true && (
                      <p className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>OK</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Confirmar Feira */}
            {!feiraConfirmada ? (
              temVinculados ? (
                <button
                  className="btn-primary w-full py-3"
                  disabled={planejamento.length === 0}
                  onClick={() => setShowConfirmFeira(true)}
                ><Icon name="check" size={16} /> Confirmar produção e baixar estoque</button>
              ) : (
                <p className="text-xs text-center" style={{ color: 'var(--ink-3)' }}>
                  Vincule ingredientes ao estoque nas receitas para baixar automaticamente
                </p>
              )
            ) : (
              <div className="p-4 rounded-xl text-center" style={{ background: 'rgba(90,158,133,0.15)' }}>
                <p className="mb-1" style={{ color: 'var(--color-success)' }}><Icon name="check" size={24} strokeWidth={2.4} /></p>
                <p className="font-bold" style={{ color: 'var(--color-success)' }}>Produção confirmada!</p>
                <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                  Estoque atualizado com sucesso.
                </p>
                <button
                  className="btn-ghost text-sm mt-3 px-4"
                  onClick={() => { setPlanejamento([]); setFeiraConfirmada(false) }}
                >
                  Novo planejamento
                </button>
              </div>
            )}
          </div>
        )}

        {/* Modal: Confirmar Feira */}
        {showConfirmFeira && (
          <Modal title="Confirmar Produção" onClose={() => setShowConfirmFeira(false)} size="sm">
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
                Será registrada saída de estoque para os ingredientes vinculados:
              </p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {listaUnificada.filter((i) => i.ingredienteId).map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-xl"
                    style={{ background: 'var(--color-surface-sunk)' }}
                  >
                    <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                      {item.nome}
                    </span>
                    <span
                      className="text-sm tabular-nums font-bold"
                      style={{ color: item.suficiente === false ? 'var(--color-danger)' : 'var(--color-text)' }}
                    >
                      −{item.total.toFixed(2)} {item.unidade}
                    </span>
                  </div>
                ))}
              </div>
              {listaUnificada.some((i) => !i.ingredienteId) && (
                <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                  * Ingredientes sem vínculo ao estoque não serão baixados
                </p>
              )}
              <div className="flex gap-3">
                <button className="btn-ghost flex-1" onClick={() => setShowConfirmFeira(false)}>Cancelar</button>
                <button className="btn-primary flex-1" onClick={handleConfirmarFeira}>Confirmar</button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    )
  }

  // ── Calculadora de Produção ───────────────────────────────────────────────
  const temInsuficienteProducao = ingredientesNecessarios.some((i) => i.suficiente === false)
  const temVinculadosProducao   = ingredientesNecessarios.some((i) => i.ingredienteId)

  return (
    <div className="bfy-page bfy-page-flow">
      <div className="flex items-center justify-between mb-6">
        <h1 className="bfy-page-title">
          Calculadora de Produção
        </h1>
        <button
          className="btn-ghost text-sm px-4"
          onClick={() => { setPlanejarMode(true); setFeiraConfirmada(false) }}
        >
          Planear feira
        </button>
      </div>

      {receitas.length === 0 ? (
        <div className="bfy-card bfy-empty">
          <Icon name="receitas" size={30} />
          <p style={{ fontSize: 'var(--text-md)' }}>Cadastre receitas primeiro para usar a calculadora.</p>
        </div>
      ) : (
        <>
          {/* Stepper */}
          <div className="flex items-center mb-6">
            {[
              { n: 1, label: 'Demanda' },
              { n: 2, label: 'Massa' },
              { n: 3, label: 'Ingredientes' },
            ].map(({ n, label }, idx, arr) => (
              <div key={n} className="flex items-center flex-1">
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-full font-black text-sm shrink-0 transition-all"
                  style={{
                    background: fase >= n ? 'var(--color-accent-dark)' : 'var(--line-2)',
                    color: fase >= n ? '#fff' : 'var(--color-text)',
                  }}
                >
                  {n}
                </div>
                <span
                  className="text-xs font-semibold ml-2 hidden sm:block"
                  style={{ color: 'var(--color-text)', opacity: fase >= n ? 0.8 : 0.3 }}
                >
                  {label}
                </span>
                {idx < arr.length - 1 && (
                  <div
                    className="flex-1 h-0.5 mx-3"
                    style={{ background: fase > n ? 'var(--color-accent-dark)' : 'var(--line-2)' }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Fase 1 */}
          <div className="bfy-card p-6 mb-4">
            <h2 className="text-base font-bold mb-4 bfy-card-title">
              1. Quanto vais produzir?
            </h2>
            <div className="space-y-4">
              <label className="block">
                <span className="bfy-label">Receita</span>
                <select
                  className="bfy-input"
                  value={receitaId}
                  onChange={(e) => {
                    const id = e.target.value
                    setReceitaId(id)
                    const r = receitas.find((x) => x.id === id)
                    if (r) setQuantidade(r.rendimento || 1)
                    setFase(1)
                    setConfirmado(false)
                  }}
                >
                  <option value="">— Selecionar receita —</option>
                  {receitas.filter((r) => tipoComponente(r) === 'cookie').length > 0 && (
                    <optgroup label="Cookies">
                      {receitas.filter((r) => tipoComponente(r) === 'cookie').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.emoji ?? '🍪'} {r.nome} (rende {r.rendimento} un.)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {receitas.filter((r) => tipoComponente(r) === 'base').length > 0 && (
                    <optgroup label="Massas base">
                      {receitas.filter((r) => tipoComponente(r) === 'base').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.emoji ?? '🧱'} {r.nome} (rende {r.rendimento} g)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {receitas.filter((r) => tipoComponente(r) === 'recheio').length > 0 && (
                    <optgroup label="Recheios">
                      {receitas.filter((r) => tipoComponente(r) === 'recheio').map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.emoji ?? '🍫'} {r.nome} (rende {r.rendimento} g)
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>

              <label className="block">
                <span className="bfy-label">Quantidade ({prodLabel})</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn-ghost w-10 h-10 px-0 py-0 text-xl font-bold"
                    onClick={() => setQuantidade((q) => Math.max(1, q - (receita?.rendimento ?? 1)))}
                  >−</button>
                  <input
                    className="bfy-input text-center font-bold text-xl w-28"
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={(e) => setQuantidade(parseFloat(e.target.value) || 1)}
                  />
                  <button
                    type="button"
                    className="btn-ghost w-10 h-10 px-0 py-0 text-xl font-bold"
                    onClick={() => setQuantidade((q) => q + (receita?.rendimento ?? 1))}
                  >+</button>
                  <span className="text-sm" style={{ color: 'var(--ink-3)' }}>{prodUnidade}</span>
                </div>
                {receita && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--ink-3)' }}>
                    = {(quantidade / receita.rendimento).toFixed(1)} receita{quantidade !== receita.rendimento ? 's' : ''}
                  </p>
                )}
              </label>

              <button
                className="btn-primary w-full py-3"
                disabled={!receitaId}
                onClick={() => setFase(2)}
              >
                Calcular massa <Icon name="avancar" size={15} />
              </button>
            </div>
          </div>

          {/* Fase 2 */}
          {fase >= 2 && receita && (
            <div className="bfy-card p-6 mb-4">
              <h2 className="text-base font-bold mb-4 bfy-card-title">
                2. Massa necessária
              </h2>
              <div className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'var(--color-surface-sunk)' }}>
                <span className="text-5xl">{receita.emoji ?? '🍪'}</span>
                <div>
                  <p className="font-black text-lg" style={{ color: 'var(--color-text)' }}>
                    {pesoMassaTotal > 0
                      ? `≈ ${pesoMassaTotal.toFixed(0)} g de massa`
                      : 'Sem ingredientes em g/ml/kg/L'}
                  </p>
                  <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                    para {quantidade} {prodUnidade} de {receita.nome}
                  </p>
                </div>
              </div>
              <button className="btn-primary w-full mt-4 py-3" onClick={() => setFase(3)}>
                Ver ingredientes <Icon name="avancar" size={15} />
              </button>
            </div>
          )}

          {/* Fase 3 */}
          {fase >= 3 && receita && (
            <div className="bfy-card p-6">
              <div className="flex items-center justify-between gap-2 mb-4 min-w-0">
                <h2 className="text-base font-bold min-w-0 truncate bfy-card-title">
                  3. Ingredientes necessários
                </h2>
                <button className="btn-ghost btn-sm shrink-0" onClick={exportarLista}>
                  Copiar
                </button>
              </div>

              {ingredientesNecessarios.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--ink-3)' }}>
                  Nenhum ingrediente cadastrado nesta receita.
                </p>
              ) : (
                <div className="space-y-2">
                  {ingredientesNecessarios.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl px-4 py-3"
                      style={{
                        background: item.suficiente === false
                          ? 'rgba(229,115,115,0.1)'
                          : item.suficiente === true
                          ? 'rgba(90,158,133,0.1)'
                          : 'var(--color-surface-sunk)',
                      }}
                    >
                      <div>
                        <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{item.nome}</p>
                        {item.estoqueAtual !== null && (
                          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                            Estoque: {item.estoqueAtual.toFixed(1)} {item.unidade}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-black tabular-nums" style={{ color: 'var(--color-accent-dark)' }}>
                          {item.quantidade.toFixed(1)} {item.unidade}
                        </p>
                        {item.suficiente === false && (
                          <p className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>Insuficiente</p>
                        )}
                        {item.suficiente === true && (
                          <p className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>OK</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Confirmar Produção */}
              {ingredientesNecessarios.length > 0 && !confirmado && (
                <div className="mt-4 pt-4" style={{ borderTop: '1.5px solid var(--line-1)' }}>
                  {temInsuficienteProducao && (
                    <div className="mb-3 p-3 rounded-xl" style={{ background: 'rgba(229,115,115,0.1)' }}>
                      <p className="text-sm font-bold" style={{ color: 'var(--color-danger)' }}>Estoque insuficiente</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                        Alguns ingredientes precisam ser comprados. Você pode confirmar mesmo assim para registrar a produção.
                      </p>
                    </div>
                  )}
                  {temVinculadosProducao ? (
                    <button
                      className="btn-primary w-full py-3"
                      onClick={() => setShowConfirmModal(true)}
                    ><Icon name="check" size={16} /> Confirmar produção e baixar estoque</button>
                  ) : (
                    <p className="text-xs text-center py-2" style={{ color: 'var(--ink-3)' }}>
                      Vincule ingredientes ao estoque nas receitas para baixar automaticamente
                    </p>
                  )}
                </div>
              )}

              {confirmado && (
                <div className="mt-4 p-4 rounded-xl text-center" style={{ background: 'rgba(90,158,133,0.15)' }}>
                  <p className="mb-1" style={{ color: 'var(--color-success)' }}><Icon name="check" size={24} strokeWidth={2.4} /></p>
                  <p className="font-bold" style={{ color: 'var(--color-success)' }}>Produção confirmada!</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--ink-3)' }}>
                    Estoque atualizado com sucesso.
                  </p>
                  <button
                    className="btn-ghost text-sm mt-3 px-4"
                    onClick={() => { setConfirmado(false); setFase(1); setReceitaId('') }}
                  >
                    Nova produção
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal: Confirmar Produção */}
      {showConfirmModal && (
        <Modal title="Confirmar Produção" onClose={() => setShowConfirmModal(false)} size="sm">
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--ink-2)' }}>
              Será registrada saída de estoque para os ingredientes vinculados:
            </p>
            <div className="space-y-1.5">
              {ingredientesNecessarios.filter((i) => i.ingredienteId).map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: 'var(--color-surface-sunk)' }}
                >
                  <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>{item.nome}</span>
                  <span
                    className="text-sm tabular-nums font-bold"
                    style={{ color: item.suficiente === false ? 'var(--color-danger)' : 'var(--color-text)' }}
                  >
                    −{item.quantidade.toFixed(2)} {item.unidade}
                  </span>
                </div>
              ))}
            </div>
            {ingredientesNecessarios.some((i) => !i.ingredienteId) && (
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                * Ingredientes sem vínculo ao estoque não serão baixados
              </p>
            )}
            <div className="flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setShowConfirmModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1" onClick={handleConfirmarProducao}>Confirmar</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
