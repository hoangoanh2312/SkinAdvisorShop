import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useWishlist } from "../../contexts/wishlistState";

// Đầu trang: dải thông tin mảnh phía trên, thanh điều hướng dạng viên tròn nổi (bám theo khi cuộn)
export default function Header() {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { count } = useCart(); const { user, loading, isAuthenticated } = useAuth(); const navigate = useNavigate();
  const location = useLocation();
  const wishlist = useWishlist(); const wishlistMessage = wishlist?.message; const wishlistCount = wishlist?.products?.length || 0;
  const isAdmin = !loading && user?.role === "admin";

  useEffect(() => { setOpen(false); setSearchOpen(false); }, [location.pathname, location.search]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

  const submit = (event) => {
    event.preventDefault();
    const text = search.trim();
    navigate(text ? `/products?q=${encodeURIComponent(text)}` : "/products");
    setSearch(""); setSearchOpen(false);
  };
  const links = isAdmin
    ? [["/", "Xem cửa hàng", true], ["/admin", "Trang quản trị"], ["/profile", "Hồ sơ"]]
    : [["/", "Trang chủ", true], ["/products", "Cửa hàng"], ["/skin-analysis", "Phân tích da"], ["/skin-advisor", "Trợ lý AI"], ["/cau-chuyen", "Câu chuyện"]];

  return <>
    <div className="hx-strip">
      <span>Miễn phí giao hàng mọi đơn</span><span aria-hidden="true" className="hx-strip-sep" /><span>Hàng chính hãng, giá theo từng dung tích</span><span aria-hidden="true" className="hx-strip-sep" /><span>Phân tích da bằng AI miễn phí</span>
    </div>
    <header className={`hx-header ${scrolled ? "is-scrolled" : ""} ${isAdmin ? "is-admin" : ""}`}>
      <div className="hx-bar">
        <button type="button" className="hx-icon hx-menu" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="hx-nav" aria-label={open ? "Đóng menu" : "Mở menu"}>{open ? <X /> : <Menu />}</button>
        <Link to="/" className="hx-logo" aria-label="sandwich beauty, về trang chủ">sandwich beauty</Link>
        <nav id="hx-nav" className={`hx-nav ${open ? "open" : ""}`} aria-label="Điều hướng chính" onClick={(event) => { if (event.target.closest("a")) setOpen(false); }}>
          {links.map(([to, label, end]) => <NavLink key={to} to={to} end={end}>{label}</NavLink>)}
          {!isAdmin && <NavLink to="/wishlist" className="hx-nav-mobile-only">Yêu thích{wishlistCount ? ` (${wishlistCount})` : ""}</NavLink>}
        </nav>
        <div className="hx-actions">
          {!isAdmin && <form className={`hx-search ${searchOpen ? "is-open" : ""}`} onSubmit={submit} role="search">
            <button type="button" className="hx-icon" aria-label="Tìm kiếm" onClick={() => setSearchOpen(true)}><Search /></button>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm sản phẩm, thành phần" aria-label="Tìm sản phẩm" onBlur={() => !search && setSearchOpen(false)} />
          </form>}
          {!isAdmin && !loading && <Link to="/wishlist" className="hx-icon hx-hide-sm" aria-label={wishlistCount ? `Sản phẩm yêu thích (${wishlistCount})` : "Sản phẩm yêu thích"}><Heart />{wishlistCount > 0 && <span className="hx-badge">{wishlistCount}</span>}</Link>}
          {!loading && <Link to={isAuthenticated ? "/profile" : "/login"} className="hx-icon" aria-label={isAuthenticated ? "Tài khoản" : "Đăng nhập"}><UserRound /></Link>}
          {!isAdmin && !loading && <Link to="/cart" className="hx-icon hx-cart" aria-label="Giỏ hàng"><ShoppingBag />{count > 0 && <span className="hx-badge">{count}</span>}</Link>}
        </div>
      </div>
      {open && <button type="button" className="hx-backdrop" aria-label="Đóng menu" onClick={() => setOpen(false)} />}
    </header>
    {wishlistMessage && <div className="wishlist-notice" role="status" aria-live="polite">{wishlistMessage}</div>}
  </>;
}
