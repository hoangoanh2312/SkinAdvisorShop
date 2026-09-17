import {
  ChevronLeft,
  ClipboardList,
  LayoutDashboard,
  Package,
  Shapes,
  TicketPercent,
  Users,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
const links = [
  ["/admin", LayoutDashboard, "Tổng quan"],
  ["/admin/products", Package, "Sản phẩm"],
  ["/admin/categories", Shapes, "Danh mục"],
  ["/admin/orders", ClipboardList, "Đơn hàng"],
  ["/admin/users", Users, "Khách hàng"],
  ["/admin/vouchers", TicketPercent, "Mã giảm giá"],
];
export default function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="logo logo-light">
          SKINORA<span>.</span>
        </div>
        <div className="admin-label">TRANG QUẢN TRỊ</div>
        <nav>
          {links.map(([to, Icon, label]) => (
            <NavLink key={to} to={to} end={to === "/admin"}>
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <NavLink to="/">
          <ChevronLeft size={18} /> Về cửa hàng
        </NavLink>
      </aside>
      <section className="admin-content">
        <header>
          <div>
            <span className="eyebrow">QUẢN TRỊ SKINORA</span>
            <h2>Xin chào, Admin</h2>
          </div>
          <div className="admin-avatar">SA</div>
        </header>
        <Outlet />
      </section>
    </div>
  );
}
