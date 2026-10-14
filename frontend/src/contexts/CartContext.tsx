import { createContext, useContext, useState, useCallback } from 'react'

export interface CartItem {
  product_id: string
  product_name: string
  variant_id: string
  variant_name: string
  price: number
  quantity: number
  image_url: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (product_id: string, variant_id: string) => void
  updateQuantity: (product_id: string, variant_id: string, quantity: number) => void
  clearCart: () => void
  totalItems: number
  subtotal: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.product_id === item.product_id && i.variant_id === item.variant_id
      )

      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id && i.variant_id === item.variant_id
            ? { ...i, quantity: i.quantity + item.quantity }
            : i
        )
      }

      return [...prev, item]
    })
  }, [])

  const removeItem = useCallback((product_id: string, variant_id: string) => {
    setItems((prev) =>
      prev.filter(
        (i) => !(i.product_id === product_id && i.variant_id === variant_id)
      )
    )
  }, [])

  const updateQuantity = useCallback(
    (product_id: string, variant_id: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(product_id, variant_id)
        return
      }

      setItems((prev) =>
        prev.map((i) =>
          i.product_id === product_id && i.variant_id === variant_id
            ? { ...i, quantity }
            : i
        )
      )
    },
    [removeItem]
  )

  const clearCart = useCallback(() => {
    setItems([])
  }, [])

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error('useCart must be used within CartProvider')
  }
  return context
}
