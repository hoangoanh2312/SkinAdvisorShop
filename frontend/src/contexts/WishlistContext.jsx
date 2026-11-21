import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axiosClient, { apiErrorMessage } from "../api/axiosClient";
import { useAuth } from "./AuthContext";
import { WishlistContext } from "./wishlistState";

function WishlistSession({ children, userId, role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [status, setStatus] = useState(userId && role === "customer" ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState([]);
  const busyRef = useRef(new Set());
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!userId || role !== "customer") return;
    const requestId = ++requestRef.current;
    setStatus("loading");
    try {
      const { data } = await axiosClient.get("/wishlist", { sessionProtected: true });
      if (requestId !== requestRef.current) return;
      setProducts(data.data.products || []);
      setStatus("ready");
    } catch {
      if (requestId !== requestRef.current) return;
      setStatus("error");
      setMessage("Không thể tải sản phẩm yêu thích. Vui lòng thử lại.");
    }
  }, [userId, role]);

  useEffect(() => {
    if (!userId || role !== "customer") return undefined;
    const requestId = ++requestRef.current;
    let active = true;
    axiosClient.get("/wishlist", { sessionProtected: true })
      .then(({ data }) => { if (active && requestId === requestRef.current) { setProducts(data.data.products || []); setStatus("ready"); } })
      .catch(() => { if (active && requestId === requestRef.current) { setStatus("error"); setMessage("Không thể tải sản phẩm yêu thích. Vui lòng thử lại."); } });
    return () => { active = false; };
  }, [userId, role]);
  useEffect(() => { if (!message) return undefined; const timer = window.setTimeout(() => setMessage(""), 4000); return () => window.clearTimeout(timer); }, [message]);

  const toggle = async (productId) => {
    if (!userId) {
      navigate("/login", { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    if (role !== "customer" || !productId || busyRef.current.has(productId)) return;
    busyRef.current.add(productId);
    setBusy((current) => [...current, productId]);
    setMessage("");
    const saved = products.some((product) => String(product._id) === String(productId));
    try {
      if (saved) await axiosClient.delete(`/wishlist/${productId}`, { sessionProtected: true });
      else await axiosClient.post(`/wishlist/${productId}`, {}, { sessionProtected: true });
      await refresh();
      setMessage(saved ? "Đã bỏ sản phẩm yêu thích" : "Đã lưu sản phẩm yêu thích");
    } catch (error) {
      setMessage(apiErrorMessage(error, "Không thể cập nhật sản phẩm yêu thích"));
    } finally {
      busyRef.current.delete(productId);
      setBusy((current) => current.filter((id) => id !== productId));
    }
  };

  return <WishlistContext.Provider value={{ products, status, message, busy, toggle, refresh, isSaved: (id) => products.some((item) => String(item._id) === String(id)) }}>{children}</WishlistContext.Provider>;
}

export function WishlistProvider({ children }) {
  const { user, loading } = useAuth();
  const userId = !loading ? (user?._id || user?.id) : null;
  return <WishlistSession key={userId || "guest"} userId={userId} role={user?.role}>{children}</WishlistSession>;
}
