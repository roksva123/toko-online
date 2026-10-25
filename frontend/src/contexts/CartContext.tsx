import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'
import {
  addCartItem,
  clearServerCart,
  fetchCart,
  removeCartItem,
  updateCartItem,
  type CartItem,
} from '@/lib/api/cart'

export type { CartItem } from '@/lib/api/cart'

interface CartContextType {
  items: CartItem[]
  addItem: (item: CartItem) => Promise<void>
  removeItem: (product_id: string, variant_id: string) => Promise<void>
  updateQuantity: (product_id: string, variant_id: string, quantity: number) => Promise<void>
  clearCart: () => Promise<void>
  isLoading: boolean
  totalItems: number
  subtotal: number
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (isAuthLoading) return
    if (!isAuthenticated) {
      setItems([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchCart()
      .then((serverItems) => {
        if (!cancelled) setItems(serverItems)
      })
      .catch(() => {
        if (!cancelled) setItems([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isAuthenticated, isAuthLoading])

  const addItem = useCallback(async (item: CartItem) => {
    const serverItems = await addCartItem(item.variant_id, item.quantity)
    setItems(serverItems)
  }, [])

  const removeItem = useCallback(async (_productId: string, variantId: string) => {
    await removeCartItem(variantId)
    setItems((prev) => prev.filter((item) => item.variant_id !== variantId))
  }, [])

  const updateQuantity = useCallback(
    async (_productId: string, variantId: string, quantity: number) => {
      if (quantity <= 0) {
        await removeCartItem(variantId)
        setItems((prev) => prev.filter((item) => item.variant_id !== variantId))
        return
      }

      const serverItems = await updateCartItem(variantId, quantity)
      setItems(serverItems)
    },
    []
  )

  const clearCart = useCallback(async () => {
    await clearServerCart()
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
        isLoading,
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
