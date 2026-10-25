import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback } from 'react';
const CartContext = createContext(undefined);
export function CartProvider({ children }) {
    const [items, setItems] = useState([]);
    const addItem = useCallback((item) => {
        setItems((prev) => {
            const existing = prev.find((i) => i.product_id === item.product_id && i.variant_id === item.variant_id);
            if (existing) {
                return prev.map((i) => i.product_id === item.product_id && i.variant_id === item.variant_id
                    ? { ...i, quantity: i.quantity + item.quantity }
                    : i);
            }
            return [...prev, item];
        });
    }, []);
    const removeItem = useCallback((product_id, variant_id) => {
        setItems((prev) => prev.filter((i) => !(i.product_id === product_id && i.variant_id === variant_id)));
    }, []);
    const updateQuantity = useCallback((product_id, variant_id, quantity) => {
        if (quantity <= 0) {
            removeItem(product_id, variant_id);
            return;
        }
        setItems((prev) => prev.map((i) => i.product_id === product_id && i.variant_id === variant_id
            ? { ...i, quantity }
            : i));
    }, [removeItem]);
    const clearCart = useCallback(() => {
        setItems([]);
    }, []);
    const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    return (_jsx(CartContext.Provider, { value: {
            items,
            addItem,
            removeItem,
            updateQuantity,
            clearCart,
            totalItems,
            subtotal,
        }, children: children }));
}
export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within CartProvider');
    }
    return context;
}
//# sourceMappingURL=CartContext.js.map