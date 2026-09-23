import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import { formatCurrency, formatDate, orderStatusLabel } from "../../utils/formatters";
const config = {
  categories: { title: "Danh mục", path: "/categories", key: "categories", label: (item) => item.name, detail: (item) => item.slug },
  orders: { title: "Đơn hàng", path: "/admin/orders", key: "orders", label: (item) => `#${item._id.slice(-8).toUpperCase()}`, detail: (item) => `${formatCurrency(item.total)} · ${orderStatusLabel[item.orderStatus]}` },
  vouchers: { title: "Mã giảm giá", path: "/vouchers", key: "vouchers", label: (item) => item.code, detail: (item) => `${item.discountValue}${item.discountType === "percent" ? "%" : "đ"}` },
};
export default function AdminListPage({ type }) {
  const current = config[type]; const [items, setItems] = useState([]); const [query, setQuery] = useState(""); const [loading, setLoading] = useState(Boolean(current)); const [error, setError] = useState("");
  useEffect(() => { if (!current) return; axiosClient.get(current.path, { sessionProtected: true }).then(({ data }) => setItems(data.data[current.key])).catch((requestError) => setError(requestError.response?.data?.message || "Không thể tải dữ liệu.")).finally(() => setLoading(false)); }, [current]);
  if (!current) return <section className="admin-table-card"><h3>Khách hàng</h3><div className="empty"><p>Backend chưa có API quản lý người dùng. Không hiển thị dữ liệu giả.</p></div></section>;
  const visible = items.filter((item) => `${current.label(item)} ${current.detail(item)}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="admin-table-card"><div className="table-title"><div><h3>{current.title}</h3><p>Dữ liệu trực tiếp từ backend</p></div></div><div className="admin-search"><Search /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Tìm kiếm ${current.title.toLowerCase()}...`} /></div>{loading ? <div className="empty">Đang tải...</div> : error ? <div className="empty">{error}</div> : visible.length ? <table><thead><tr><th>Tên / mã</th><th>Chi tiết</th><th>Cập nhật</th></tr></thead><tbody>{visible.map((item) => <tr key={item._id}><td><strong>{current.label(item)}</strong></td><td>{current.detail(item)}</td><td>{formatDate(item.updatedAt || item.createdAt)}</td></tr>)}</tbody></table> : <div className="empty">Chưa có dữ liệu.</div>}</section>;
}
