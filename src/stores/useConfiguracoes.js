import { useStorage } from './useStorage'

const DEFAULT = {
  nomeNegocio: 'Box for You',
  nomeProprietaria: 'Dhara',
  moeda: '€',
  metaLucroMensal: 2000,
  formasPagamento: ['Dinheiro', 'MB WAY', 'Multibanco'],
}

export function useConfiguracoes() {
  const [config, setConfig] = useStorage('bfy:configuracoes', DEFAULT)

  function update(changes) {
    setConfig(prev => ({ ...prev, ...changes }))
  }

  function reset() {
    setConfig(DEFAULT)
  }

  return { config, update, reset }
}
