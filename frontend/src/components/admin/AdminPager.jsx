export default function AdminPager({ pagination, onPage }) {
  if (!pagination || pagination.totalPages <= 1) return null;
  return <nav className="admin-pager" aria-label="Phân trang quản trị">
    <button type="button" disabled={pagination.page <= 1} onClick={() => onPage(pagination.page - 1)}>Trước</button>
    <span>Trang {pagination.page}/{pagination.totalPages}, tổng {pagination.total} mục</span>
    <button type="button" disabled={pagination.page >= pagination.totalPages} onClick={() => onPage(pagination.page + 1)}>Sau</button>
  </nav>;
}
