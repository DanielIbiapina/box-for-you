import { useData } from './DataProvider'

export const DEFAULT_COOKIES = [
  { id: 'chocolate-triplo',  nome: 'Chocolate Triplo',  short: 'Choc. Triplo',  emoji: '🍫', price: 3.50, image: '', ativoNoCardapio: true },
  { id: 'nutella',           nome: 'Nutella',           short: 'Nutella',        emoji: '🫙', price: 3.50, image: '', ativoNoCardapio: true },
  { id: 'kinder-bueno',      nome: 'Kinder Bueno',      short: 'Kinder Bueno',   emoji: '🥚', price: 3.50, image: '', ativoNoCardapio: true },
  { id: 'pistache',          nome: 'Pistache',          short: 'Pistache',       emoji: '🌿', price: 3.50, image: '', ativoNoCardapio: true },
  { id: 'red-white',         nome: 'Red White',         short: 'Red White',      emoji: '🤍', price: 3.50, image: '', ativoNoCardapio: true },
  { id: 'all-black',         nome: 'All Black',         short: 'All Black',      emoji: '🖤', price: 3.50, image: '', ativoNoCardapio: true },
  { id: 'black-pistachio',   nome: 'Black Pistachio',   short: 'Blk Pistachio',  emoji: '💚', price: 3.50, image: '', ativoNoCardapio: true },
]

export const DEFAULT_BOX         = { size: 4, price: 12 }
export const DEFAULT_MINI_BOX    = { price: 7 }
export const DEFAULT_TASTING_BOX = { price: 16 }

export function useCookies() {
  const {
    cookies, boxConfig, miniBoxConfig, tastingBoxConfig,
    createRow, updateRow, removeRow, setBoxConfig, setMiniBoxConfig, setTastingBoxConfig,
  } = useData()

  function addCookie(data) {
    return createRow('cookies_catalogo', { ...data, ativoNoCardapio: data.ativoNoCardapio !== false })
  }

  function toggleCardapio(id) {
    const c = cookies.find((x) => x.id === id)
    if (!c) return
    updateRow('cookies_catalogo', id, { ativoNoCardapio: c.ativoNoCardapio === false })
  }

  return {
    cookies,
    boxConfig,
    miniBoxConfig,
    tastingBoxConfig,
    addCookie,
    updateCookie: (id, changes) => updateRow('cookies_catalogo', id, changes),
    removeCookie: (id) => removeRow('cookies_catalogo', id),
    toggleCardapio,
    setBoxConfig,
    setMiniBoxConfig,
    setTastingBoxConfig,
  }
}
