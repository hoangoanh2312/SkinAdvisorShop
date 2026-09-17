import {
  ArrowUpRight,
  PackageX,
  ShoppingCart,
  Users,
  WalletCards,
} from "lucide-react";
import { formatPrice, recentOrders } from "../../data/mockData";
const stats = [
  [WalletCards, "Tổng doanh thu", "128.450.000đ", "+18.2%"],
  [ShoppingCart, "Tổng đơn hàng", "1.284", "+12.5%"],
  [Users, "Khách hàng", "3.892", "+8.4%"],
  [PackageX, "Sản phẩm sắp hết", "8", "Cần xử lý"],
];
export default function Dashboard() {
  return (
    <>
      <div className="stat-grid">
        {stats.map(([Icon, label, value, trend]) => (
          <article key={label}>
            <span>
              <Icon />
            </span>
            <div>
              <small>{label}</small>
              <strong>{value}</strong>
              <em>
                {trend} <ArrowUpRight />
              </em>
            </div>
          </article>
        ))}
      </div>
      <div className="admin-grid">
        <section className="chart-card">
          <div>
            <h3>Tổng quan doanh thu</h3>
            <select>
              <option>7 ngày qua</option>
            </select>
          </div>
          <div className="chart">
            <div className="chart-bars">
              {[42, 58, 46, 75, 62, 88, 78].map((h, i) => (
                <span key={i} style={{ height: `${h}%` }}>
                  <i>{["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}</i>
                </span>
              ))}
            </div>
          </div>
        </section>
        <section className="mini-card">
          <h3>Danh mục nổi bật</h3>
          {[
            ["Serum", 38],
            ["Kem dưỡng", 27],
            ["Chống nắng", 22],
            ["Làm sạch", 13],
          ].map((x) => (
            <div className="progress" key={x[0]}>
              <span>
                {x[0]} <b>{x[1]}%</b>
              </span>
              <i>
                <em style={{ width: `${x[1]}%` }} />
              </i>
            </div>
          ))}
        </section>
      </div>
      <section className="admin-table-card">
        <div className="table-title">
          <h3>Đơn hàng gần đây</h3>
          <button>Xem tất cả</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Mã đơn</th>
              <th>Khách hàng</th>
              <th>Ngày đặt</th>
              <th>Tổng tiền</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.map((o) => (
              <tr key={o.id}>
                <td>
                  <strong>{o.id}</strong>
                </td>
                <td>{o.customer}</td>
                <td>{o.date}</td>
                <td>{formatPrice(o.total)}</td>
                <td>
                  <span className="status">{o.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
