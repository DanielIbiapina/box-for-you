/** Categorias de despesas alinhadas à planilha de custos operacionais */

export const CATEGORIAS_VARIAVEIS = [
  { id: 'materia-prima', label: 'Matéria-prima' },
  { id: 'embalagem', label: 'Embalagem' },
  { id: 'material-limpeza', label: 'Material limpeza' },
  { id: 'material-cozinha', label: 'Material cozinha' },
  { id: 'logistica', label: 'Logística' },
  { id: 'dia-a-dia', label: 'Dia a dia' },
  { id: 'material-mercados', label: 'Material mercados' },
  { id: 'pessoal', label: 'Pessoal' },
  { id: 'inscricao', label: 'Inscrição feira' },
  { id: 'outro', label: 'Outro' },
]

export const CATEGORIAS_TAXAS = [
  { id: 'taxa-cartao', label: 'Taxa cartão' },
  { id: 'taxa-ifood', label: 'Taxa iFood' },
  { id: 'taxa-imposto', label: 'Imposto' },
  { id: 'taxa-darkstore', label: 'Darkstore' },
]

/** Todas as categorias selecionáveis no formulário de saída */
export const CATEGORIAS_DESPESA = [
  ...CATEGORIAS_VARIAVEIS,
  ...CATEGORIAS_TAXAS,
  { id: 'custo-fixo', label: 'Custo fixo' },
]

export const CATEGORIA_LABEL = Object.fromEntries(
  CATEGORIAS_DESPESA.map((c) => [c.id, c.label]),
)

/** Seed inicial do template de custos fixos mensais */
export const CUSTOS_FIXOS_SEED = [
  { id: 'fixo-aluguel', nome: 'Aluguel', valorPadrao: 0 },
  { id: 'fixo-agua', nome: 'Água', valorPadrao: 10 },
  { id: 'fixo-energia', nome: 'Energia', valorPadrao: 5 },
  { id: 'fixo-internet', nome: 'Internet', valorPadrao: 0 },
  { id: 'fixo-telefone', nome: 'Telefone', valorPadrao: 5 },
  { id: 'fixo-folha', nome: 'Folha de pagamento', valorPadrao: 0 },
  { id: 'fixo-prolabore', nome: 'Pró-labore', valorPadrao: 100 },
  { id: 'fixo-gas', nome: 'Gás', valorPadrao: 5 },
  { id: 'fixo-contabilidade', nome: 'Contabilidade', valorPadrao: 15 },
  { id: 'fixo-sistema', nome: 'Sistema', valorPadrao: 20 },
  { id: 'fixo-marketing', nome: 'Marketing', valorPadrao: 0 },
  { id: 'fixo-ifood', nome: 'Mensalidade iFood', valorPadrao: 0 },
  { id: 'fixo-banco', nome: 'Tarifa bancária', valorPadrao: 0 },
  { id: 'fixo-mei', nome: 'Mensalidade MEI', valorPadrao: 0 },
  { id: 'fixo-claude', nome: 'Claude', valorPadrao: 22 },
  { id: 'fixo-canva', nome: 'Canva Pro', valorPadrao: 17 },
]

export function labelCategoria(id) {
  return CATEGORIA_LABEL[id] ?? id ?? '—'
}
