import { useData } from './DataProvider'

// stockCookies: { [cookieId]: number }  — unidades de cookies prontos/congelados
// stockMassa:   { [cookieId]: number }  — gramas de massa pronta por sabor

export function useEstoqueCookies() {
  const { estoqueCookies, estoqueMassa, setEstoque, adjustEstoque, deductCookies } = useData()

  return {
    stockCookies: estoqueCookies,
    stockMassa: estoqueMassa,
    adjustCookies: (cookieId, delta) => adjustEstoque('cookie', cookieId, delta),
    setCookieQty: (cookieId, qty) => setEstoque('cookie', cookieId, qty),
    adjustMassa: (cookieId, delta) => adjustEstoque('massa', cookieId, delta),
    setMassaQty: (cookieId, qty) => setEstoque('massa', cookieId, qty),
    deductSale: (items) => deductCookies(items),
  }
}
