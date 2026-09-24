import { useEffect, useState } from 'react'
import { useData } from '../stores/DataProvider'
import { Icon } from './Icon'
import { PEDIDO_NOVO, notificar, tocarSino } from '../lib/avisos'

const fmtEuro = (v) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v ?? 0)

const SUMICO_MS = 20000

/**
 * Balão de "pedido novo da loja": som, aviso na tela e notificação do sistema.
 * Fica no topo, some sozinho passado algum tempo e escreve no título do
 * separador enquanto houver pedidos por ver — para dar pelo aviso mesmo
 * com a app noutro separador.
 */
export function AvisoPedidos({ onVer }) {
  const { clientes } = useData()
  const [avisos, setAvisos] = useState([])

  useEffect(() => {
    function aoChegar(e) {
      const p = e.detail
      if (!p?.id) return
      setAvisos((atuais) => (
        atuais.some((a) => a.id === p.id)
          ? atuais
          : [{ id: p.id, clienteId: p.clienteId, total: p.totalEur ?? 0 }, ...atuais].slice(0, 4)
      ))
      tocarSino()
      notificar('Novo pedido da loja', `${fmtEuro(p.totalEur ?? 0)} · ver na plataforma`)
      setTimeout(() => setAvisos((atuais) => atuais.filter((a) => a.id !== p.id)), SUMICO_MS)
    }
    window.addEventListener(PEDIDO_NOVO, aoChegar)
    return () => window.removeEventListener(PEDIDO_NOVO, aoChegar)
  }, [])

  useEffect(() => {
    const base = 'Crumb Lab — Gestão'
    document.title = avisos.length ? `(${avisos.length}) Pedido novo · ${base}` : base
    return () => { document.title = base }
  }, [avisos.length])

  if (avisos.length === 0) return null

  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((a) => {
        const nome = clientes.find((c) => c.id === a.clienteId)?.nome
        return (
          <div key={a.id} className="aviso">
            <span className="aviso-icone" aria-hidden="true">
              <Icon name="carrinho" size={20} strokeWidth={2} />
            </span>
            <div className="aviso-txt">
              <p className="aviso-titulo">Novo pedido da loja</p>
              <p className="aviso-detalhe">
                {nome ? `${nome} · ` : ''}{fmtEuro(a.total)}
              </p>
            </div>
            <button
              type="button"
              className="aviso-ver"
              onClick={() => {
                setAvisos((atuais) => atuais.filter((x) => x.id !== a.id))
                onVer?.()
              }}
            >
              Ver
            </button>
            <button
              type="button"
              className="aviso-fechar"
              onClick={() => setAvisos((atuais) => atuais.filter((x) => x.id !== a.id))}
              aria-label="Dispensar aviso"
            >✕</button>
          </div>
        )
      })}
    </div>
  )
}
