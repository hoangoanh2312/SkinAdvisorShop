import { useCallback, useEffect, useState } from "react";
import axiosClient from "../../api/axiosClient";
import AdminPager from "../../components/admin/AdminPager";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";
import { formatCurrency, formatDate } from "../../utils/formatters";

const initial = { code: "", description: "", discountType: "percent", discountValue: "", minOrderValue: "0", maxDiscount: "", startDate: "", endDate: "", usageLimit: "", perUserLimit: "" };
const numeric = ["discountValue", "minOrderValue", "maxDiscount", "usageLimit", "perUserLimit"];
const toLocal = value => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
export default function VouchersAdmin() {
  const [items, setItems] = useState([]), [page, setPage] = useState(1);
  const [form, setForm] = useState(initial), [editing, setEditing] = useState(null), [confirming, setConfirming] = useState(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await axiosClient.get("/vouchers", { sessionProtected: true }); setItems(data.data.vouchers); setError(""); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải mã giảm giá"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const change = event => setForm(previous => ({ ...previous, [event.target.name]: event.target.value }));
  const save = async event => {
    event.preventDefault(); if (saving) return;
    if (new Date(form.startDate) >= new Date(form.endDate)) { setError("Thời gian kết thúc phải sau thời gian bắt đầu"); return; }
    setSaving(true); setError("");
    const payload = { ...form, startDate: new Date(form.startDate).toISOString(), endDate: new Date(form.endDate).toISOString() };
    numeric.forEach(key => { payload[key] = payload[key] === "" ? null : Number(payload[key]); });
    try {
      if (editing) await axiosClient.put(`/vouchers/${editing._id}`, payload, { sessionProtected: true });
      else await axiosClient.post("/vouchers", payload, { sessionProtected: true });
      setEditing(null); setForm(initial); await load();
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể lưu mã giảm giá"); }
    finally { setSaving(false); }
  };
  const toggleVoucher = async () => {
    if (!confirming || saving) return;
    setSaving(true); setError("");
    try { await axiosClient.put(`/vouchers/${confirming._id}`, { isActive: !confirming.isActive }, { sessionProtected: true }); setConfirming(null); await load(); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể thay đổi trạng thái mã giảm giá"); }
    finally { setSaving(false); }
  };
  const pageSize = 20, totalPages = Math.ceil(items.length / pageSize);
  return <section className="admin-table-card">
    <div className="table-title"><div><h3>Mã giảm giá</h3><p>Chỉ mã giảm giá trong thời gian hiệu lực mới được áp dụng</p></div></div>
    <form className="admin-voucher-form" onSubmit={save}>
      <input required name="code" placeholder="Mã" aria-label="Mã giảm giá" value={form.code} onChange={change} />
      <input name="description" placeholder="Mô tả" aria-label="Mô tả" value={form.description} onChange={change} />
      <select name="discountType" aria-label="Loại giảm giá" value={form.discountType} onChange={change}><option value="percent">Phần trăm</option><option value="fixed">Số tiền</option></select>
      <input required min="1" type="number" name="discountValue" placeholder="Giá trị" aria-label="Giá trị" value={form.discountValue} onChange={change} />
      <input min="0" type="number" name="minOrderValue" placeholder="Đơn tối thiểu" aria-label="Đơn tối thiểu" value={form.minOrderValue} onChange={change} />
      <input min="0" type="number" name="maxDiscount" placeholder="Giảm tối đa" aria-label="Giảm tối đa" value={form.maxDiscount} onChange={change} />
      <label>Bắt đầu<input required type="datetime-local" name="startDate" value={form.startDate} onChange={change} /></label>
      <label>Kết thúc<input required type="datetime-local" name="endDate" value={form.endDate} onChange={change} /></label>
      <input min="1" type="number" name="usageLimit" placeholder="Tổng lượt" aria-label="Tổng lượt" value={form.usageLimit} onChange={change} />
      <input min="1" type="number" name="perUserLimit" placeholder="Lượt/người" aria-label="Lượt mỗi người" value={form.perUserLimit} onChange={change} />
      <button className="btn btn-dark btn-small" disabled={saving}>{saving ? "Đang lưu..." : editing ? "Lưu mã giảm giá" : "Tạo mã giảm giá"}</button>
      {editing && <button type="button" className="btn btn-light btn-small" onClick={() => { setEditing(null); setForm(initial); }}>Hủy sửa</button>}
    </form>
    {error && <div className="admin-state error" role="alert">{error} <button onClick={load}>Thử lại</button></div>}
    {loading ? <div className="admin-state">Đang tải...</div> : items.length ? <table><thead><tr><th>Mã</th><th>Ưu đãi</th><th>Đơn tối thiểu</th><th>Sử dụng</th><th>Thời gian</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{items.slice((page - 1) * pageSize, page * pageSize).map(item => <tr key={item._id}><td><strong>{item.code}</strong></td><td>{item.discountType === "percent" ? `${item.discountValue}%` : formatCurrency(item.discountValue)}</td><td>{formatCurrency(item.minOrderValue)}</td><td>{item.usedCount}/{item.usageLimit ?? "∞"}<small>Tối đa {item.perUserLimit ?? "∞"}/khách</small></td><td>{formatDate(item.startDate)} – {formatDate(item.endDate)}</td><td>{item.isActive ? "Đang hoạt động" : "Đã tắt"}</td><td><div className="admin-action-row"><button className="admin-row-button" onClick={() => { setEditing(item); setForm({ code: item.code, description: item.description || "", discountType: item.discountType, discountValue: String(item.discountValue), minOrderValue: String(item.minOrderValue ?? 0), maxDiscount: item.maxDiscount == null ? "" : String(item.maxDiscount), startDate: toLocal(item.startDate), endDate: toLocal(item.endDate), usageLimit: item.usageLimit == null ? "" : String(item.usageLimit), perUserLimit: item.perUserLimit == null ? "" : String(item.perUserLimit) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Sửa</button><button className="admin-row-button" onClick={() => setConfirming(item)}>{item.isActive ? "Vô hiệu hóa" : "Kích hoạt"}</button></div></td></tr>)}</tbody></table> : <div className="empty">Chưa có mã giảm giá</div>}
    <AdminPager pagination={{ page, totalPages, total: items.length }} onPage={setPage} />
    {confirming && <ConfirmActionModal title={`${confirming.isActive ? "Vô hiệu hóa" : "Kích hoạt"} mã giảm giá?`} description={confirming.isActive ? `Mã ${confirming.code} sẽ không còn được áp dụng cho đơn mới` : `Mã ${confirming.code} chỉ có thể áp dụng trong thời gian hiệu lực và khi còn lượt sử dụng`} confirmLabel={confirming.isActive ? "Vô hiệu hóa" : "Kích hoạt"} danger={confirming.isActive} busy={saving} error={error} onConfirm={toggleVoucher} onClose={() => setConfirming(null)} />}
  </section>;
}
