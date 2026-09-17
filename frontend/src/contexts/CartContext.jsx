import { createContext, useContext, useEffect, useMemo, useState } from "react";
const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("skinora_cart")) || [];
    } catch {
      return [];
    }
  });
  useEffect(
    () => localStorage.setItem("skinora_cart", JSON.stringify(items)),
    [items],
  );
  const addToCart = (product, variant = product.variants[0]) =>
    setItems((current) => {
      const key = `${product.id}-${variant.size}`,
        found = current.find((i) => i.key === key);
      return found
        ? current.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [...current, { key, product, variant, quantity: 1 }];
    });
  const updateQuantity = (key, quantity) =>
    setItems((current) =>
      current.map((i) =>
        i.key === key ? { ...i, quantity: Math.max(1, quantity) } : i,
      ),
    );
  const removeItem = (key) =>
    setItems((current) => current.filter((i) => i.key !== key));
  const value = useMemo(
    () => ({
      items,
      addToCart,
      updateQuantity,
      removeItem,
      clearCart: () => setItems([]),
      count: items.reduce((n, i) => n + i.quantity, 0),
      total: items.reduce((n, i) => n + i.variant.price * i.quantity, 0),
    }),
    [items],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
