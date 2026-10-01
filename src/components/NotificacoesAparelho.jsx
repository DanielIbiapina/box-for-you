import { useEffect, useState } from 'react'
import { Icon } from './Icon'
import {
  ativarPush, desativarPush, ehIOS, emModoApp, estadoPush, testarPush,
} from '../lib/push'

/**
 * Ligar as notificações push neste aparelho — as que chegam mesmo com a app
 * fechada (como as do resultado do jogo). Cada aparelho liga-se uma vez.
 */
export function NotificacoesAparelho() {
  const [estado, setEstado] = useState('a-ver') // a-ver | ligado | desligado | bloqueado | sem-suporte
  const [ocupado, setOcupado] = useState(false)
  const [msg, setMsg] = useState(null) // { tipo: 'ok' | 'erro', texto }

  useEffect(() => {
    let vivo = true
    estadoPush().then((e) => { if (vivo) setEstado(e) }).catch(() => { if (vivo) setEstado('sem-suporte') })
    return () => { vivo = false }
  }, [])

  async function correr(fn, ok) {
    setOcupado(true)
    setMsg(null)
    try {
      await fn()
      setEstado(await estadoPush())
      if (ok) setMsg({ tipo: 'ok', texto: ok })
    } catch (e) {
      setMsg({ tipo: 'erro', texto: e.message })
      setEstado(await estadoPush().catch(() => 'sem-suporte'))
    } finally {
      setOcupado(false)
    }
  }

  const iosNoBrowser = ehIOS() && !emModoApp()

  return (
    <div className="pt-4 space-y-3" style={{ borderTop: '1px solid var(--line-1)' }}>
      <div>
        <p className="text-sm font-bold ink-1">Notificações no telemóvel / iPad</p>
        <p className="text-xs ink-3 mt-0.5">
          Avisam de cada pedido novo da loja mesmo com a app fechada. Liga em cada aparelho onde queres receber.
        </p>
      </div>

      {estado === 'ligado' && (
        <>
          <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--color-success)' }}>
            <Icon name="check" size={15} /> Ligadas neste aparelho.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost btn-sm flex-1" disabled={ocupado}
              onClick={() => correr(testarPush, 'Teste enviado — deve chegar em poucos segundos.')}>
              Enviar teste
            </button>
            <button type="button" className="btn-ghost btn-sm flex-1" disabled={ocupado}
              onClick={() => correr(desativarPush, 'Desligadas neste aparelho.')}>
              Desligar aqui
            </button>
          </div>
        </>
      )}

      {estado === 'desligado' && (
        <button type="button" className="btn-primary w-full py-2.5 text-sm" disabled={ocupado}
          onClick={() => correr(ativarPush, 'Pronto! Carrega em "Enviar teste" para experimentar.')}>
          <Icon name="alerta" size={15} /> Ativar neste aparelho
        </button>
      )}

      {estado === 'bloqueado' && (
        <p className="text-sm ink-3">
          As notificações estão bloqueadas para este site. Dá permissão nas definições do navegador
          (ou do iPhone/iPad, em Definições → Notificações → Crumb Lab) e volta aqui.
        </p>
      )}

      {estado === 'sem-suporte' && (
        iosNoBrowser ? (
          <div className="bfy-sunk p-3 text-sm ink-2 space-y-1">
            <p className="font-semibold ink-1">No iPhone / iPad é preciso um passo antes:</p>
            <p>1. No Safari, toca em <strong>Partilhar</strong> (o quadrado com a seta).</p>
            <p>2. Escolhe <strong>Adicionar ao ecrã principal</strong>.</p>
            <p>3. Abre a <strong>Crumb Lab</strong> por esse ícone novo e volta aqui a Definições.</p>
          </div>
        ) : (
          <p className="text-sm ink-3">Este navegador não suporta notificações. Experimenta no Chrome ou no Safari.</p>
        )
      )}

      {msg && (
        <p className="text-sm font-semibold" style={{ color: msg.tipo === 'ok' ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {msg.texto}
        </p>
      )}
    </div>
  )
}
