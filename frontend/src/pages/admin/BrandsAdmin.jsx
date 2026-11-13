import { useCallback, useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import AdminPager from "../../components/admin/AdminPager";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";

const blank = { name: "", slug: "", description: "" };
const message = error => error.response?.data?.message || "Không thể lưu thương hiệu.";

export default function BrandsAdmin() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get("/admin/brands", { params: { includeInactive: true, search: query, page }, sessionProtected: true });
      setItems(data.data.brands);
      setPagination(data.data.pagination);
      setError("");
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải thương hiệu."); }
    finally { setLoading(false); }
  }, [query, page]);
  useEffect(() => { load(); }, [load]);

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError("");
    try {
      if (editing) await axiosClient.patch(`/admin/brands/${editing._id}`, form, { sessionProtected: true });
      else await axiosClient.post("/admin/brands", form, { sessionProtected: true });
      setForm(blank); setEditing(null); await load();
    } catch (requestError) { setError(message(requestError)); }
    finally { setSaving(false); }
  };
  const toggle = async () => {
    if (!confirming || saving) return;
    setSaving(true); setError("");
    try {
      await axiosClient.patch(`/admin/brands/${confirming._id}`, { isActive: !confirming.isActive }, { sessionProtected: true });
      setConfirming(null); await load();
    } catch (requestError) { setError(message(requestError)); }
    finally { setSaving(false); }
  };

  return <section className="admin-table-card">
    <div className="table-title"><div><h3>Thương hiệu</h3><p>Hồ sơ thương hiệu và số sản phẩm đang sử dụng</p></div></div>
    <form className="admin-editor" onSubmit={save}>
      <strong>{editing ? `Sửa ${editing.name}` : "Thêm thương hiệu"}</strong>
      <label>Tên<input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
      <label>Slug<input required value={form.slug} onChange={event => setForm({ ...form, slug: event.target.value })} /></label>
      <label>Mô tả<textarea value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} /></label>
      <div className="admin-editor-actions"><button className="btn btn-dark btn-small" disabled={saving}>{saving ? "Đang lưu..." : editing ? "Lưu thay đổi" : "Thêm thương hiệu"}</button>{editing && <button type="button" className="btn btn-light btn-small" onClick={() => { setEditing(null); setForm(blank); }}>Hủy sửa</button>}</div>
    </form>
    <input className="admin-filter-input" placeholder="Tìm thương hiệu" value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} />
    {error && <div className="admin-state error" role="alert">{error} <button onClick={load}>Thử lại</button></div>}
    {loading ? <div className="admin-state">Đang tải...</div> : items.length ? <table className="admin-catalog-table admin-responsive-table"><thead><tr><th>Thương hiệu</th><th>Sản phẩm</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.map(item => <tr key={item._id}><td data-label="Thương hiệu"><strong>{item.name}</strong><small>{item.slug}</small></td><td data-label="Sản phẩm">{item.productCount}{item.productCount === 0 && <small className="admin-empty-category-hint">Chưa có sản phẩm</small>}</td><td data-label="Trạng thái">{item.isActive ? "Đang hoạt động" : "Tạm ẩn"}</td><td data-label="Thao tác"><div className="admin-action-row"><button className="admin-row-button" onClick={() => { setEditing(item); setForm({ name: item.name, slug: item.slug, description: item.description || "" }); }}>Sửa</button><button className="admin-row-button" onClick={() => setConfirming(item)}>{item.isActive ? "Vô hiệu hóa" : "Kích hoạt"}</button></div></td></tr>)}</tbody></table> : <div className="empty">Chưa có thương hiệu.</div>}
    <AdminPager pagination={pagination} onPage={setPage} />
    {confirming && <ConfirmActionModal title={`${confirming.isActive ? "Vô hiệu hóa" : "Kích hoạt"} thương hiệu?`} description={`Thương hiệu ${confirming.name} sẽ ${confirming.isActive ? "không còn ở trạng thái active" : "được kích hoạt lại"}. Sản phẩm hiện có không bị xóa.`} confirmLabel="Xác nhận" danger={confirming.isActive} busy={saving} error={error} onConfirm={toggle} onClose={() => setConfirming(null)} />}
  </section>;
}
