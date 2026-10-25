export interface CartItem {
    product_id: string;
    product_name: string;
    variant_id: string;
    variant_name: string;
    price: number;
    quantity: number;
    image_url: string;
}
interface CartContextType {
    items: CartItem[];
    addItem: (item: CartItem) => void;
    removeItem: (product_id: string, variant_id: string) => void;
    updateQuantity: (product_id: string, variant_id: string, quantity: number) => void;
    clearCart: () => void;
    totalItems: number;
    subtotal: number;
}
export declare function CartProvider({ children }: {
    children: React.ReactNode;
}): import("react").JSX.Element;
export declare function useCart(): CartContextType;
export {};
//# sourceMappingURL=CartContext.d.ts.map