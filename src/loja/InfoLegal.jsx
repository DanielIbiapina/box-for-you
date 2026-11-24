import { useEffect, useState } from 'react'
import { fetchCardapio } from './api'
import { fmtEuro } from './util'
import { linkWhatsApp } from './negocio'
import { IconeLivro } from './icones'
import { RodapeLegal } from './RodapeLegal'

/**
 * Informação legal da loja (crumblabcookies.com/legal/): identificação do
 * vendedor, termos de compra, entregas, trocas e devoluções, alergénios,
 * resolução de litígios e proteção de dados. A Ifthenpay e a lei do comércio
 * eletrónico pedem que tudo isto esteja no site.
 *
 * Os dados variáveis vêm do cardápio (o mesmo RPC da loja): nome, NIF e
 * morada (Definições → Dados legais), tabela de entrega, horários e locais.
 * O texto é um ponto de partida — a dona deve confirmar as regras.
 */

const ATUALIZADO = '24 de novembro de 2026'

const SECCOES = [
  ['quem-somos', 'Quem somos'],
  ['termos', 'Termos e condições de compra'],
  ['entregas', 'Entregas e levantamento'],
  ['devolucoes', 'Trocas e devoluções'],
  ['alergenios', 'Alergénios'],
  ['litigios', 'Reclamações e litígios'],
  ['privacidade', 'Proteção de dados'],
]

const DIAS = [['1', 'segunda'], ['2', 'terça'], ['3', 'quarta'], ['4', 'quinta'], ['5', 'sexta'], ['6', 'sábado'], ['0', 'domingo']]

/** "segunda a sexta, 15h–19h · sábado, 13h–22h · domingo, 10h–22h" (dias seguidos iguais juntam-se). */
function horarioTexto(h) {
  if (!h) return ''
  const faixa = (d) => (d ? `${d.abre}h–${d.fecha}h` : 'fechado')
  if (!h.semana) return `todos os dias, ${faixa(h)}`
  const grupos = []
  for (const [k, nome] of DIAS) {
    const f = faixa(h.semana[k])
    const ultimo = grupos[grupos.length - 1]
    if (ultimo && ultimo.f === f) ultimo.ate = nome
    else grupos.push({ de: nome, ate: null, f })
  }
  return grupos.map((g) => `${g.ate ? `${g.de} a ${g.ate}` : g.de}, ${g.f}`).join(' · ')
}

export function InfoLegal() {
  const [c, setC] = useState(null)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    fetchCardapio().then(setC).catch(() => setErro(true))
  }, [])

  // as âncoras (#termos…) só existem depois de carregar: salta para lá quando estiverem prontas
  useEffect(() => {
    if (!c || !window.location.hash) return
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView()
  }, [c])

  const legal = c?.legal ?? {}
  const marca = (c?.negocio?.nome || 'Crumb Lab').trim()
  const quem = legal.nome || marca
  const faixas = c?.entrega?.ativo ? c.entrega.faixas ?? [] : []
  const maxKm = faixas.length ? faixas[faixas.length - 1].ateKm : null
  const locais = c?.locais ?? []
  const contactoTxt = [legal.telefone && `WhatsApp ${legal.telefone}`, legal.email].filter(Boolean).join(' ou ')

  return (
    <div className="loja-body legal">
      <header className="loja-top">
        <div className="loja-wrap-largo py-2.5 flex items-center justify-between gap-4">
          <a href="/" aria-label="Voltar à loja"><img className="loja-logo" src="/hero-crumb.png" alt="Crumb Lab" /></a>
          <a className="btn-ghost btn-sm legal-voltar" href="/">Voltar à loja</a>
        </div>
      </header>

      <main className="loja-wrap legal-corpo">
        <h1 className="legal-titulo">Informação legal</h1>
        <p className="legal-sub">Tudo o que precisas de saber antes de encomendar. Última atualização: {ATUALIZADO}.</p>

        <nav className="legal-indice" aria-label="Nesta página">
          {SECCOES.map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
        </nav>

        {erro && <p className="legal-aviso">Não conseguimos carregar todos os dados agora. Atualiza a página.</p>}

        <section id="quem-somos" className="legal-seccao">
          <h2>Quem somos</h2>
          <p>A {marca} faz cookies artesanais, à mão, e vende-os através deste site, em feiras e por encomenda.</p>
          <dl className="legal-ficha">
            <div><dt>Vendedor</dt><dd>{quem}</dd></div>
            {legal.nif && <div><dt>NIF</dt><dd className="bfy-num">{legal.nif}</dd></div>}
            {legal.morada && <div><dt>Morada</dt><dd>{legal.morada}</dd></div>}
            {legal.telefone && (
              <div><dt>Telefone / WhatsApp</dt><dd><a href={linkWhatsApp('Olá!')} target="_blank" rel="noreferrer">{legal.telefone}</a></dd></div>
            )}
            {legal.email && <div><dt>Email</dt><dd><a href={`mailto:${legal.email}`}>{legal.email}</a></dd></div>}
          </dl>
        </section>

        <section id="termos" className="legal-seccao">
          <h2>Termos e condições de compra</h2>
          <h3>Encomendas</h3>
          <p>
            Fazes a encomenda neste site, escolhendo os produtos, o dia e a hora. Ao terminar recebes um código
            (por exemplo, #K7M2PQ) com que podes acompanhar o pedido. A encomenda fica confirmada quando a
            confirmamos contigo por mensagem ou, nas campanhas com pagamento na hora, quando o pagamento chega.
          </p>
          <h3>Preços</h3>
          <p>
            Os preços estão em euros e incluem IVA à taxa legal em vigor, quando aplicável. Antes de confirmares
            vês sempre o total, com a taxa de entrega quando a houver. Vale o preço mostrado no momento da encomenda.
          </p>
          <h3>Pagamento</h3>
          <p>
            Aceitamos MB WAY e dinheiro (na entrega ou no levantamento). Nalgumas campanhas, como a Black Crumb,
            o pagamento é só por MB WAY e feito no momento da encomenda. Se precisares de fatura com NIF, diz-nos ao encomendar.
          </p>
          <h3>Alterar ou cancelar</h3>
          <p>
            Podes alterar ou cancelar a encomenda sem custos enquanto não a começarmos a preparar. Fala connosco
            {contactoTxt ? ` por ${contactoTxt}` : ''}. Se já tiveres pago, devolvemos o valor pelo mesmo meio de
            pagamento, no prazo máximo de 14 dias.
          </p>
          <h3>Se não conseguirmos cumprir</h3>
          <p>
            Os cookies são feitos em pequenas fornadas. Se, por algum motivo, não conseguirmos entregar o que
            encomendaste, avisamos-te o quanto antes e propomos outro sabor, outro dia ou a devolução do valor pago.
          </p>
        </section>

        <section id="entregas" className="legal-seccao">
          <h2>Entregas e levantamento</h2>
          <p>
            Entregamos ou tens o pedido pronto a levantar no dia e na faixa de uma hora que escolheres ao encomendar.
            {c?.horarios ? ` Horário: ${horarioTexto(c.horarios)}.` : ''}
          </p>
          {locais.length > 0 && (
            <>
              <h3>Levantar</h3>
              <p>
                O levantamento é grátis, em{' '}
                {locais.map((l, i) => (
                  <span key={l.id}>{i > 0 ? (i === locais.length - 1 ? ' ou ' : ', ') : ''}<b>{l.nome}</b>{l.morada ? ` (${l.morada})` : ''}</span>
                ))}.
              </p>
            </>
          )}
          <h3>Entrega em casa</h3>
          <p>
            Levamos o pedido à morada que indicares{maxKm ? `, até ${String(maxKm).replace('.', ',')} km da nossa cozinha (em linha reta)` : ''}.
            A taxa depende da distância e aparece antes de confirmares:
          </p>
          {faixas.length > 0 && (
            <ul className="legal-faixas">
              {faixas.map((f, i) => (
                <li key={i}>até {String(f.ateKm).replace('.', ',')} km · <b>{f.preco > 0 ? fmtEuro(f.preco) : 'grátis'}</b></li>
              ))}
            </ul>
          )}
          <p>
            Se a tua rua não aparecer no mapa, a taxa fica a confirmar e combinamo-la contigo antes da entrega.
            Se não estiveres à hora combinada, tentamos contactar-te; não sendo possível entregar, combinamos
            uma nova entrega, que pode ter nova taxa.
          </p>
        </section>

        <section id="devolucoes" className="legal-seccao">
          <h2>Trocas e devoluções</h2>
          <p>
            Os cookies são alimentos frescos, que se estragam depressa. Por isso, e nos termos do artigo 17.º do
            Decreto-Lei n.º 24/2014, não se aplica o direito de livre resolução de 14 dias das compras à distância.
          </p>
          <p>
            Isso não te deixa sem resposta: se algum produto chegar danificado, trocado ou não estiver em condições,
            avisa-nos no próprio dia, com uma fotografia se possível{contactoTxt ? `, por ${contactoTxt}` : ''}.
            Substituímos o produto ou devolvemos o valor correspondente, pelo mesmo meio de pagamento, no prazo máximo de 14 dias.
          </p>
        </section>

        <section id="alergenios" className="legal-seccao">
          <h2>Alergénios</h2>
          <p>
            Os nossos cookies levam, em regra, glúten (farinha de trigo), ovo e leite. Alguns sabores levam frutos
            de casca rija (como pistácio ou avelã), e todos são feitos na mesma cozinha, por isso podem conter
            vestígios de frutos de casca rija, amendoim e soja. Se tens alguma alergia ou intolerância, fala connosco
            antes de encomendar e deixa uma nota no pedido.
          </p>
        </section>

        <section id="litigios" className="legal-seccao">
          <h2>Reclamações e litígios</h2>
          <p>Se alguma coisa correr mal, fala connosco primeiro: queremos resolver.</p>
          <p>
            Podes também reclamar no{' '}
            <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer">Livro de Reclamações Eletrónico</a>.
          </p>
          <p>
            Em caso de litígio de consumo, podes recorrer a uma entidade de resolução alternativa de litígios:{' '}
            <a href="https://www.cicap.pt" target="_blank" rel="noreferrer">CICAP, o Centro de Informação de Consumo e Arbitragem do Porto</a>.
            Mais informação no <a href="https://www.consumidor.gov.pt" target="_blank" rel="noreferrer">Portal do Consumidor</a>.
          </p>
          <a className="legal-livro" href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer">
            <IconeLivro size={22} /> Livro de Reclamações
          </a>
        </section>

        <section id="privacidade" className="legal-seccao">
          <h2>Proteção de dados</h2>
          <h3>Quem trata os teus dados</h3>
          <p>
            {quem}{legal.nif ? `, NIF ${legal.nif}` : ''}{legal.morada ? `, ${legal.morada}` : ''}.
            {contactoTxt ? ` Contacto: ${contactoTxt}.` : ''}
          </p>
          <h3>Que dados e para quê</h3>
          <p>
            Pedimos só o necessário para a encomenda: o teu nome e telemóvel e, se escolheres entrega, a morada,
            a localidade e o código postal. Usamo-los para preparar e entregar o pedido, para falar contigo sobre
            ele e, quando pedires, para a fatura. A base legal é a execução do contrato de compra e, na faturação,
            o cumprimento de obrigações legais. Não usamos os teus dados para publicidade e não os vendemos.
          </p>
          <h3>Quem mais os vê</h3>
          <p>
            Os pedidos ficam guardados em serviços que trabalham para nós: a Supabase (base de dados) e a Vercel
            (alojamento do site). Para calcularmos a distância da entrega, o teu navegador envia a rua e o código
            postal ao OpenStreetMap (Nominatim). As letras do site vêm do Google Fonts.
          </p>
          <h3>Durante quanto tempo</h3>
          <p>
            Guardamos os dados enquanto fores nosso cliente e, depois, só o que a lei obriga a guardar
            (por exemplo, documentos de faturação, até 10 anos).
          </p>
          <h3>Os teus direitos</h3>
          <p>
            Podes pedir para ver, corrigir ou apagar os teus dados, limitar ou opor-te ao seu uso e recebê-los
            num formato portátil{contactoTxt ? `, por ${contactoTxt}` : ''}. Se achares que não tratámos bem os teus dados,
            podes reclamar à <a href="https://www.cnpd.pt" target="_blank" rel="noreferrer">CNPD</a>.
          </p>
          <h3>No teu telemóvel</h3>
          <p>
            O site guarda no teu navegador o carrinho e o teu contacto, para o próximo pedido ser mais rápido.
            Não usamos cookies de publicidade nem de estatísticas. (Os únicos cookies que fazemos são os de comer.)
          </p>
        </section>
      </main>

      <RodapeLegal legal={legal} marca={marca} />
    </div>
  )
}
