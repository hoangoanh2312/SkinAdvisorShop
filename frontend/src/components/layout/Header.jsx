import { Heart, Menu, Search, ShoppingBag, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useCart } from "../../contexts/CartContext";
export default function Header() {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const { count } = useCart(),
    navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    navigate(`/products?q=${encodeURIComponent(search)}`);
    setSearch("");
  };
  return (
    <>
      <div className="topbar">
        Miễn phí vận chuyển cho đơn hàng từ 499.000đ <span>•</span> Hiểu da ·
        Chăm da đúng cách
      </div>
      <header className="header">
        <div className="header-inner">
          <button
            className="mobile-toggle"
            onClick={() => setOpen(!open)}
            aria-label="Mở menu"
          >
            {open ? <X /> : <Menu />}
          </button>
          <Link to="/" className="logo">
            SKINORA<span>.</span>
          </Link>
          <nav
            className={open ? "nav open" : "nav"}
            onClick={() => setOpen(false)}
          >
            <NavLink to="/">Trang chủ</NavLink>
            <NavLink to="/products">Sản phẩm</NavLink>
            <a href="/#skin-concerns">Loại da</a>
            <Link to="/products?q=Niacinamide">Thành phần</Link>
            <NavLink to="/skin-advisor" className="ai-nav">
              Skin Advisor AI
            </NavLink>
          </nav>
          <form className="header-search" onSubmit={submit}>
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
            />
          </form>
          <div className="header-icons">
            <button className="search-mobile" aria-label="Tìm kiếm">
              <Search />
            </button>
            <Link to="/login" aria-label="Tài khoản">
              <UserRound />
            </Link>
            <Link to="/products" aria-label="Yêu thích">
              <Heart />
            </Link>
            <Link to="/cart" className="cart-icon" aria-label="Giỏ hàng">
              <ShoppingBag />
              <span>{count}</span>
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
