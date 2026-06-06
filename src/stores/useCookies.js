import { useStorage } from './useStorage'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

export const DEFAULT_COOKIES = [
  { id: 'chocolate-triplo',  nome: 'Chocolate Triplo',  short: 'Choc. Triplo',  emoji: '🍫', price: 3.50, image: '' },
  { id: 'nutella',           nome: 'Nutella',           short: 'Nutella',        emoji: '🫙', price: 3.50, image: '' },
  { id: 'kinder-bueno',      nome: 'Kinder Bueno',      short: 'Kinder Bueno',   emoji: '🥚', price: 3.50, image: '' },
  { id: 'pistache',          nome: 'Pistache',          short: 'Pistache',       emoji: '🌿', price: 3.50, image: '' },
  { id: 'red-white',         nome: 'Red White',         short: 'Red White',      emoji: '🤍', price: 3.50, image: '' },
  { id: 'all-black',         nome: 'All Black',         short: 'All Black',      emoji: '🖤', price: 3.50, image: '' },
  { id: 'black-pistachio',   nome: 'Black Pistachio',   short: 'Blk Pistachio',  emoji: '💚', price: 3.50, image: '' },
]

export const DEFAULT_BOX      = { size: 4, price: 12 }
export const DEFAULT_MINI_BOX = { price: 7 }

export function useCookies() {
  const [cookies,      setCookies]      = useStorage('bfy:feiras-cookies',  DEFAULT_COOKIES)
  const [boxConfig,    setBoxConfig]    = useStorage('bfy:feiras-box',      DEFAULT_BOX)
  const [miniBoxConfig, setMiniBoxConfig] = useStorage('bfy:feiras-minibox', DEFAULT_MINI_BOX)

  function addCookie(data) {
    setCookies((prev) => [...prev, { ...data, id: uid() }])
  }

  function updateCookie(id, changes) {
    setCookies((prev) => prev.map((c) => (c.id === id ? { ...c, ...changes } : c)))
  }

  function removeCookie(id) {
    setCookies((prev) => prev.filter((c) => c.id !== id))
  }

  return {
    cookies,
    boxConfig,
    miniBoxConfig,
    addCookie,
    updateCookie,
    removeCookie,
    setBoxConfig,
    setMiniBoxConfig,
  }
}
