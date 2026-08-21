import { useData } from './DataProvider'

// Vendas do POS das feiras (antes em localStorage 'cookies-sales:v1').
// Cada venda: { id, kind, lines, flavorId, boxFlavors, paymentId, totalEur, desconto, eventId, createdAt }

export function useVendas() {
  const { vendas, createRow, removeRow } = useData()

  return {
    sales: vendas,
    addSale: (sale) => createRow('vendas', { createdAt: new Date().toISOString(), ...sale }),
    removeSale: (id) => removeRow('vendas', id),
  }
}
