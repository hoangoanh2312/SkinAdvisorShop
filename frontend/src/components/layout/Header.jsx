import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";

export default function Header() {
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const { count } = useCart(); const { user, loading, isAuthenticated } = useAuth(); const navigate = useNavigate();
  const isAdmin = !loading && user?.role === "admin";
  const submit = (event) => { event.preventDefault(); navigate(`/products?q=${encodeURIComponent(search)}`); setSearch(""); };
  return <><div className="topbar">Miễn phí vận chuyển cho đơn hàng từ 499.000đ <span>•</span> Hiểu da · Chăm da đúng cách</div><header className={`header ${isAdmin ? "admin-store-header" : ""}`}><div className="header-inner"><button className="mobile-toggle" onClick={() => setOpen(!open)} aria-label={open ? "Đóng menu" : "Mở menu"}>{open ? <X /> : <Menu />}</button><Link to="/" className="logo">SKINORA<span>.</span></Link>
    <nav className={open ? "nav open" : "nav"} onClick={() => setOpen(false)}>{isAdmin ? <><NavLink to="/">Xem cửa hàng</NavLink><NavLink to="/admin">Trang quản trị</NavLink><NavLink to="/profile">Hồ sơ quản trị</NavLink></> : <><NavLink to="/">Trang chủ</NavLink><NavLink to="/products">Sản phẩm</NavLink><a href="/#skin-concerns">Loại da</a><Link to="/products?q=Niacinamide">Thành phần</Link><NavLink to="/skin-advisor" className="ai-nav">Skin Advisor AI</NavLink><NavLink to="/skin-analysis" className="ai-nav">Phân tích da</NavLink></>}</nav>
    {!isAdmin && <form className="header-search" onSubmit={submit}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm..." /></form>}
    <div className="header-icons">{!isAdmin && !loading && <button className="search-mobile" aria-label="Tìm kiếm"><Search /></button>}{!loading && <Link to={isAuthenticated ? "/profile" : "/login"} aria-label="Tài khoản"><UserRound /></Link>}{!isAdmin && !loading && <><Link to="/products" aria-label="Yêu thích"><Heart /></Link><Link to="/cart" className="cart-icon" aria-label="Giỏ hàng"><ShoppingBag /><span>{count}</span></Link></>}</div>
  </div></header></>;
}
