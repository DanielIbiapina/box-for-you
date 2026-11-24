import { IconeLivro } from './icones'

/** Rodapé com a identificação do vendedor e as ligações legais — o mesmo da loja. */
export function RodapeLegal({ legal = {}, marca = 'Crumb Lab' }) {
  const linha = [legal.nome || marca, legal.nif && `NIF ${legal.nif}`, legal.morada].filter(Boolean).join(' · ')
  return (
    <footer className="loja-footer">
      <div className="loja-wrap text-center space-y-1">
        <img className="loja-logo loja-logo-on-dark mx-auto" src="/hero-crumb.png" alt="" />
        <p className="text-sm">cookies. coffee. repeat</p>
        <p className="rodape-legal-id">{linha}</p>
        <nav className="rodape-legal" aria-label="Informação legal">
          <a href="/legal/#termos">Termos e condições</a>
          <a href="/legal/#entregas">Entregas</a>
          <a href="/legal/#devolucoes">Trocas e devoluções</a>
          <a href="/legal/#privacidade">Privacidade</a>
          <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer" className="rodape-livro">
            <IconeLivro size={15} /> Livro de Reclamações
          </a>
        </nav>
      </div>
    </footer>
  )
}
