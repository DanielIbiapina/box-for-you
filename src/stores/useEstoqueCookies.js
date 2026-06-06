import { useStorage } from './useStorage'

// stockCookies: { [cookieId]: number }  — unidades de cookies prontos/congelados
// stockMassa:   { [cookieId]: number }  — gramas de massa pronta por sabor

export function useEstoqueCookies() {
  const [stockCookies, setStockCookies] = useStorage('bfy:estoque-cookies', {})
  const [stockMassa,   setStockMassa]   = useStorage('bfy:estoque-massa',   {})

  function adjustCookies(cookieId, delta) {
    setStockCookies((prev) => ({
      ...prev,
      [cookieId]: Math.max(0, (prev[cookieId] ?? 0) + delta),
    }))
  }

  function setCookieQty(cookieId, qty) {
    setStockCookies((prev) => ({ ...prev, [cookieId]: Math.max(0, qty) }))
  }

  function adjustMassa(cookieId, delta) {
    setStockMassa((prev) => ({
      ...prev,
      [cookieId]: Math.max(0, (prev[cookieId] ?? 0) + delta),
    }))
  }

  function setMassaQty(cookieId, qty) {
    setStockMassa((prev) => ({ ...prev, [cookieId]: Math.max(0, qty) }))
  }

  // items: [{ cookieId, qty }]
  function deductSale(items) {
    if (!items?.length) return
    setStockCookies((prev) => {
      const next = { ...prev }
      for (const { cookieId, qty } of items) {
        next[cookieId] = Math.max(0, (next[cookieId] ?? 0) - qty)
      }
      return next
    })
  }

  return {
    stockCookies,
    stockMassa,
    adjustCookies,
    setCookieQty,
    adjustMassa,
    setMassaQty,
    deductSale,
  }
}
