import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import { cartStorageKey, readCart } from "../utils/cartStorage";
import { variantDisplayPrice } from "../utils/productAdapter";

const CartContext = createContext(null);
export const useCart = () => useContext(CartContext);

export function CartProvider({ children }) {
  const { user, loading } = useAuth();
  const storageKey = cartStorageKey(user, loading);
  const [cart, setCart] = useState(() => ({ key: null, items: [] }));

  // Đổi tài khoản không được mang giỏ của người trước sang người mới.
  useEffect(() => {
    if (!storageKey) return;
    setCart({ key: storageKey, items: readCart(storageKey) });
  }, [storageKey]);

  // Chỉ lưu đúng giỏ thuộc tài khoản hiện tại, không ghi đè khi đang khôi phục phiên.
  useEffect(() => {
    if (storageKey && cart.key === storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(cart.items)); } catch { /* storage unavailable */ }
    }
  }, [storageKey, cart]);

  const items = cart.key === storageKey ? cart.items : [];
  const changeItems = useCallback((updater) => {
    setCart((current) => {
      if (!storageKey || current.key !== storageKey) return current;
      return { ...current, items: updater(current.items) };
    });
  }, [storageKey]);

  const addToCart = (product, variant, quantity = 1) => {
    if (!storageKey || !product?.isActive || !variant?._id || variant.isActive === false ||
        Number(variant.price) <= 0 || !Number.isInteger(variant.stock) || variant.stock <= 0 ||
        !Number.isInteger(quantity) || quantity <= 0) return false;
    changeItems((current) => {
      const key = `${product.id}-${variant._id}`;
      const found = current.find((i) => i.key === key);
      const item = {
        key, productId: product.id, variantId: variant._id,
        productName: product.name, variantName: variant.name || `${variant.size || ""} ${variant.unit || ""}`.trim(),
        brand: product.brand, image: variant.image || product.images?.[0] || "",
        displayPrice: variantDisplayPrice(variant), stock: variant.stock,
        quantity: Math.min((found?.quantity || 0) + quantity, variant.stock),
      };
      return found ? current.map((i) => i.key === key ? item : i) : [...current, item];
    });
    return true;
  };
  const updateQuantity = (key, quantity) => changeItems((current) => current.map((i) => i.key === key
    ? { ...i, quantity: Math.min(Math.max(1, Number.isFinite(quantity) ? Math.trunc(quantity) : 1), i.stock) }
    : i));
  const removeItem = (key) => changeItems((current) => current.filter((i) => i.key !== key));
  const clearCart = useCallback(() => changeItems(() => []), [changeItems]);
  const value = useMemo(() => ({
    items, addToCart, updateQuantity, removeItem, clearCart,
    count: items.reduce((n, i) => n + i.quantity, 0),
    total: items.reduce((n, i) => n + i.displayPrice * i.quantity, 0),
  }), [items, clearCart]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
