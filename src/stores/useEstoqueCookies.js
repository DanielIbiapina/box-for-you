import { useData } from './DataProvider'

// stockCookies:   { [cookieId]: number }  — unidades de cookies prontos/congelados
// stockMassa:     { [cookieId]: number }  — gramas de massa pronta por sabor
// stockCookies50: { [cookieId]: number }  — cookies de 50g (usados na Tasting Box)

export function useEstoqueCookies() {
  const {
    estoqueCookies, estoqueMassa, estoqueCookies50,
    setEstoque, adjustEstoque, deductCookies,
  } = useData()

  return {
    stockCookies: estoqueCookies,
    stockMassa: estoqueMassa,
    stockCookies50: estoqueCookies50,

    adjustCookies: (cookieId, delta) => adjustEstoque('cookie', cookieId, delta),
    setCookieQty: (cookieId, qty) => setEstoque('cookie', cookieId, qty),

    adjustMassa: (cookieId, delta) => adjustEstoque('massa', cookieId, delta),
    setMassaQty: (cookieId, qty) => setEstoque('massa', cookieId, qty),

    adjustCookies50: (cookieId, delta) => adjustEstoque('cookie50', cookieId, delta),
    setCookie50Qty: (cookieId, qty) => setEstoque('cookie50', cookieId, qty),

    deductSale: (items) => deductCookies(items, 'cookie'),
    /** Baixa dos cookies de 50g — usado pela Tasting Box */
    deductSale50: (items) => deductCookies(items, 'cookie50'),
  }
}
