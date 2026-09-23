import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { variantDisplayPrice } from "../utils/productAdapter";
const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);
export function CartProvider({ children }) {
  const [items, setItems] = useState(() => { try { const saved = JSON.parse(localStorage.getItem("skinora_cart")) || []; return saved.filter((item) => item.variantId && item.productId); } catch { return []; } });
  useEffect(() => localStorage.setItem("skinora_cart", JSON.stringify(items)), [items]);
  const addToCart = (product, variant, quantity = 1) => {
    if (!variant?._id || variant.stock <= 0) return false;
    setItems((current) => {
      const key = `${product.id}-${variant._id}`, found = current.find((i) => i.key === key);
      const item = { key, productId: product.id, variantId: variant._id, productName: product.name, variantName: variant.name || `${variant.size || ""} ${variant.unit || ""}`.trim(), brand: product.brand, image: variant.image || product.images?.[0] || "", displayPrice: variantDisplayPrice(variant), stock: variant.stock, quantity: Math.min((found?.quantity || 0) + quantity, variant.stock) };
      return found ? current.map((i) => i.key === key ? item : i) : [...current, item];
    });
    return true;
  };
  const updateQuantity = (key, quantity) => setItems((current) => current.map((i) => i.key === key ? { ...i, quantity: Math.min(Math.max(1, quantity), i.stock) } : i));
  const removeItem = (key) => setItems((current) => current.filter((i) => i.key !== key));
  const value = useMemo(() => ({ items, addToCart, updateQuantity, removeItem, clearCart: () => setItems([]), count: items.reduce((n, i) => n + i.quantity, 0), total: items.reduce((n, i) => n + i.displayPrice * i.quantity, 0) }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
