import { Plus, Search } from "lucide-react";
const content = {
  categories: [
    "Danh mục",
    "Quản lý nhóm sản phẩm",
    ["Sữa rửa mặt", "Toner", "Serum", "Kem dưỡng", "Kem chống nắng", "Mặt nạ"],
  ],
  orders: [
    "Đơn hàng",
    "Theo dõi và xử lý đơn hàng",
    [
      "#SKN-1048 — Đang giao",
      "#SKN-1047 — Đã xác nhận",
      "#SKN-1046 — Hoàn thành",
    ],
  ],
  users: [
    "Khách hàng",
    "Quản lý tài khoản khách hàng",
    ["Nguyễn Minh Anh", "Trần Hoàng My", "Lê Thu Hà"],
  ],
  vouchers: [
    "Mã giảm giá",
    "Chương trình ưu đãi",
    [
      "SKINORA10 — Giảm 10%",
      "FREESHIP — Miễn phí vận chuyển",
      "WELCOME15 — Giảm 15%",
    ],
  ],
};
export default function AdminListPage({ type }) {
  const [title, desc, items] = content[type];
  return (
    <section className="admin-table-card">
      <div className="table-title">
        <div>
          <h3>{title}</h3>
          <p>{desc}</p>
        </div>
        <button className="btn btn-dark btn-small">
          <Plus /> Thêm mới
        </button>
      </div>
      <div className="admin-search">
        <Search />
        <input placeholder={`Tìm kiếm ${title.toLowerCase()}...`} />
      </div>
      <table>
        <thead>
          <tr>
            <th>Tên / mã</th>
            <th>Trạng thái</th>
            <th>Cập nhật</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {items.map((x, i) => (
            <tr key={x}>
              <td>
                <strong>{x}</strong>
              </td>
              <td>
                <span className="status">Đang hoạt động</span>
              </td>
              <td>{15 + i}/09/2026</td>
              <td>
                <button className="text-link">Chỉnh sửa</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
