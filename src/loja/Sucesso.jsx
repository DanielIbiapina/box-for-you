import { fmtEuro } from './util'

const INSTRUCOES = {
  'MB WAY':     'Vamos enviar-te o pedido de pagamento MB WAY para o número que deixaste.',
  'Multibanco': 'Vamos enviar-te os dados para transferência ou uma referência Multibanco.',
  'Dinheiro':   'Pagas em dinheiro na entrega ou quando levantares.',
}

/** Confirmação — o cliente sai daqui a saber exatamente o que acontece a seguir. */
export function Sucesso({ resultado, pagamento, onNovo }) {
  return (
    <div className="sheet-backdrop">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Pedido registado">
        <div className="p-7 text-center space-y-5">
          <div className="text-6xl" aria-hidden="true">🍪</div>

          <div>
            <h2 className="loja-section-title">Pedido recebido!</h2>
            <p className="text-sm ink-2 mt-2">
              Já está na nossa lista. Falamos contigo em breve para confirmar
              tudo e combinar a entrega.
            </p>
          </div>

          <div className="bfy-card p-4 text-left space-y-2.5">
            <Linha rotulo="Referência" valor={<span className="bfy-num">#{resultado.referencia}</span>} />
            <Linha rotulo="Total" valor={<span className="bfy-num">{fmtEuro(resultado.total)}</span>} />
            <Linha rotulo="Pagamento" valor={pagamento} />
          </div>

          <p className="text-sm ink-2">{INSTRUCOES[pagamento] ?? ''}</p>

          <button type="button" className="btn-primary btn-block py-3" onClick={onNovo}>
            Fazer outro pedido
          </button>
        </div>
      </div>
    </div>
  )
}

function Linha({ rotulo, valor }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm ink-3">{rotulo}</span>
      <span className="text-sm font-bold ink-1">{valor}</span>
    </div>
  )
}
