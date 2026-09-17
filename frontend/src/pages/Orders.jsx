import { PackageSearch } from "lucide-react";
import { formatPrice, recentOrders } from "../data/mockData";
export default function Orders() {
  return (
    <div className="container orders-page">
      <div className="page-intro compact">
        <span className="eyebrow">LỊCH SỬ ĐƠN HÀNG</span>
        <h1>Đơn hàng của tôi</h1>
      </div>
      <div className="order-cards">
        {recentOrders.slice(0, 2).map((o) => (
          <article key={o.id}>
            <PackageSearch />
            <div>
              <strong>{o.id}</strong>
              <span>Ngày đặt: {o.date}</span>
            </div>
            <b>{formatPrice(o.total)}</b>
            <em>{o.status}</em>
          </article>
        ))}
      </div>
      <p className="demo-note">Dữ liệu đơn hàng hiện là dữ liệu minh họa.</p>
    </div>
  );
}
