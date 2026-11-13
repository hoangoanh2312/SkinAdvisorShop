// Giữ giỏ hàng riêng cho từng khách trên cùng một trình duyệt.
// Không tái sử dụng key skinora_cart trước đây vì key đó không gắn với tài khoản.
export const cartStorageKey = (user, loading = false) => {
  if (loading) return null;
  if (!user) return "skinora_cart_guest_v2";
  const identity = user._id || user.id || user.email?.toLowerCase();
  return identity ? `skinora_cart_customer_${encodeURIComponent(String(identity))}` : null;
};

export const readCart = (key, storage = localStorage) => {
  if (!key) return [];
  try {
    const value = JSON.parse(storage.getItem(key) || "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item) =>
      item && typeof item === "object" && item.variantId && item.productId &&
      Number.isInteger(item.quantity) && item.quantity > 0 &&
      Number.isFinite(item.displayPrice) && item.displayPrice > 0 &&
      Number.isInteger(item.stock) && item.stock > 0
    ).map((item) => ({ ...item, quantity: Math.min(item.quantity, item.stock) }));
  } catch { return []; }
};
