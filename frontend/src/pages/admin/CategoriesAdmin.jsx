import { useCallback, useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import AdminPager from "../../components/admin/AdminPager";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";

const blank = { name: "", slug: "", description: "" };
export default function CategoriesAdmin() {
  const [items, setItems] = useState([]), [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState(""), [page, setPage] = useState(1);
  const [form, setForm] = useState(blank), [editing, setEditing] = useState(null), [confirming, setConfirming] = useState(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get("/admin/categories", { params: { includeInactive: true, search: query, page }, sessionProtected: true });
      setItems(data.data.categories); setPagination(data.data.pagination); setError("");
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải danh mục."); }
    finally { setLoading(false); }
  }, [query, page]);
  useEffect(() => { load(); }, [load]);
  const save = async event => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try {
      if (editing) await axiosClient.put(`/categories/${editing._id}`, form, { sessionProtected: true });
      else await axiosClient.post("/categories", form, { sessionProtected: true });
      setEditing(null); setForm(blank); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể lưu danh mục."); }
    finally { setSaving(false); }
  };
  const toggle = async () => {
    if (!confirming || saving) return;
    setSaving(true); setError("");
    try {
      await axiosClient.put(`/categories/${confirming._id}`, { isActive: !confirming.isActive }, { sessionProtected: true });
      setConfirming(null); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể cập nhật danh mục."); }
    finally { setSaving(false); }
  };
  return <section className="admin-table-card">
    <div className="table-title"><h3>Danh mục</h3></div>
    <form className="admin-editor" onSubmit={save}>
      <strong>{editing ? `Sửa ${editing.name}` : "Thêm danh mục"}</strong>
      <label>Tên<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Slug<input required value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} /></label>
      <label>Mô tả<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <div className="admin-editor-actions"><button className="btn btn-dark btn-small" disabled={saving}>{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm danh mục"}</button>{editing && <button type="button" className="btn btn-light btn-small" onClick={() => { setEditing(null); setForm(blank); }}>Hủy sửa</button>}</div>
    </form>
    <input className="admin-filter-input" placeholder="Tìm danh mục" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
    {error && <div className="admin-state error" role="alert">{error} <button onClick={load}>Thử lại</button></div>}
    {loading ? <div className="admin-state">Đang tải...</div> : items.length ? <table className="admin-catalog-table admin-responsive-table"><thead><tr><th>Danh mục</th><th>Sản phẩm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map(item => <tr key={item._id}><td data-label="Danh mục"><strong>{item.name}</strong><small>{item.slug}</small></td><td data-label="Sản phẩm">{item.productCount}{item.productCount === 0 && <small className="admin-empty-category-hint">Chưa có sản phẩm</small>}</td><td data-label="Trạng thái">{item.isActive ? "Đang hoạt động" : "Tạm ẩn"}</td><td data-label="Thao tác"><div className="admin-action-row"><button className="admin-row-button" onClick={() => { setEditing(item); setForm({ name: item.name, slug: item.slug, description: item.description || "" }); }}>Sửa</button><button className="admin-row-button" onClick={() => setConfirming(item)}>{item.isActive ? "Vô hiệu hóa" : "Kích hoạt"}</button></div></td></tr>)}</tbody></table> : <div className="empty">Chưa có danh mục.</div>}
    <AdminPager pagination={pagination} onPage={setPage} />
    {confirming && <ConfirmActionModal title={`${confirming.isActive ? "Vô hiệu hóa" : "Kích hoạt"} danh mục?`} description={`Danh mục ${confirming.name} sẽ ${confirming.isActive ? "không còn active" : "được kích hoạt lại"}. Không xóa sản phẩm.`} confirmLabel="Xác nhận" danger={confirming.isActive} busy={saving} error={error} onConfirm={toggle} onClose={() => setConfirming(null)} />}
  </section>;
}
