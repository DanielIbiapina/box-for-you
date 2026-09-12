import { useData } from './DataProvider'

const DEFAULT = {
  nomeNegocio: 'Box for You',
  nomeProprietaria: 'Dhara',
  moeda: '€',
  metaLucroMensal: 2000,
  formasPagamento: ['Dinheiro', 'MB WAY', 'Multibanco'],
  instrucoesLevantamento: '',
  instrucoesEntrega: '',
}

export function useConfiguracoes() {
  const { config, updateConfig } = useData()

  return {
    config: { ...DEFAULT, ...config },
    update: (changes) => updateConfig(changes),
    reset: () => updateConfig(DEFAULT),
  }
}
