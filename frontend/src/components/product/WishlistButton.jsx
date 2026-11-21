import { Heart } from "lucide-react";
import { useWishlist } from "../../contexts/wishlistState";
import { useAuth } from "../../contexts/AuthContext";

export default function WishlistButton({ productId, className = "" }) {
  const wishlist = useWishlist();
  const auth = useAuth();
  if (!wishlist || auth?.user?.role === "admin") return null;
  const { isSaved, toggle, busy } = wishlist;
  const saved = isSaved(productId);
  return <button type="button" className={`wishlist-button ${saved ? "is-saved" : ""} ${className}`} aria-label={saved ? "Bỏ sản phẩm yêu thích" : "Lưu sản phẩm yêu thích"} aria-pressed={saved} disabled={Boolean(auth?.loading) || busy.includes(productId)} onClick={() => toggle(productId)}><Heart size={20} fill={saved ? "currentColor" : "none"} aria-hidden="true" /></button>;
}
