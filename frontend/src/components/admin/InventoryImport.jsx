import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import axiosClient from "../../api/axiosClient";
import { formatCurrency } from "../../utils/formatters";

const errorText = (error, fallback) => error.response?.data?.message || fallback;
const ACTION = { update: "Cập nhật", create: "Mã mới", skip: "Bỏ qua" };
const money = (value) => (value == null ? "—" : formatCurrency(value));

// Nhập kho bằng file Excel: tải file mẫu (kèm mã hàng hiện có) → chọn file → xem trước → ghi vào kho
export default function InventoryImport({ onDone }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null), [result, setResult] = useState(null);
  const [busy, setBusy] = useState(""), [message, setMessage] = useState(""), [error, setError] = useState("");
  const inputRef = useRef(null);

  const reset = () => { setFile(null); setResult(null); setMessage(""); setError(""); if (inputRef.current) inputRef.current.value = ""; };
  const downloadTemplate = async () => {
    setBusy("template"); setError("");
    try {
      const { data } = await axiosClient.get("/admin/inventory/import-template", { responseType: "blob", sessionProtected: true });
      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url; link.download = `mau-nhap-kho-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) { setError("Không tải được file mẫu"); }
    finally { setBusy(""); }
  };
  const send = async (mode, chosen = file) => {
    if (!chosen) return;
    setBusy(mode); setError(""); setMessage("");
    try {
      const body = new FormData(); body.append("file", chosen);
      const { data } = await axiosClient.post("/admin/inventory/import", body, { params: { mode }, sessionProtected: true });
      setResult(data.data); setMessage(data.message);
      if (mode === "apply") onDone?.();
    } catch (requestError) {
      if (requestError.response?.data?.data) setResult(requestError.response.data.data);
      setError(errorText(requestError, "Không đọc được file"));
    } finally { setBusy(""); }
  };
  const choose = (chosen) => {
    if (!chosen) return;
    if (!/\.(xlsx|csv)$/i.test(chosen.name)) { setError("Chỉ nhận file .xlsx hoặc .csv"); return; }
    if (chosen.size > 2 * 1024 * 1024) { setError("File tối đa 2 MB"); return; }
    setFile(chosen); setResult(null); send("preview", chosen);
  };

  if (!open) return <button type="button" className="btn btn-light btn-small inventory-import-toggle" onClick={() => setOpen(true)}><FileSpreadsheet size={16} /> Nhập từ Excel</button>;
  const totals = result?.totals;
  const canApply = result && !result.applied && totals && !totals.errors && (totals.updates + totals.creates) > 0;
  return <section className="admin-table-card inventory-import">
    <div className="table-title"><div><h3>Nhập kho từ file Excel</h3><p>Cộng số lượng nhập, đổi giá hoặc thêm dung tích mới cho nhiều mã hàng một lần</p></div>
      <button type="button" className="admin-row-button" onClick={() => { reset(); setOpen(false); }} aria-label="Đóng"><X size={16} /></button></div>
    <ol className="inventory-import-steps">
      <li><span>Tải file mẫu, trong đó có sẵn toàn bộ mã hàng và tồn kho hiện tại</span><button type="button" className="btn btn-light btn-small" disabled={!!busy} onClick={downloadTemplate}><Download size={15} /> {busy === "template" ? "Đang tạo..." : "Tải file mẫu"}</button></li>
      <li><span>Điền cột Số lượng nhập (và Giá bán, Giá giảm nếu muốn đổi), lưu file .xlsx</span></li>
      <li><span>Chọn file để xem trước</span>
        <input ref={inputRef} type="file" accept=".xlsx,.csv" hidden onChange={(event) => choose(event.target.files?.[0])} />
        <button type="button" className="btn btn-light btn-small" disabled={!!busy} onClick={() => inputRef.current?.click()}><Upload size={15} /> {file ? "Chọn file khác" : "Chọn file"}</button></li>
    </ol>
    {file && <p className="inventory-import-file">File: <b>{file.name}</b></p>}
    {busy === "preview" && <div className="admin-state">Đang đọc file...</div>}
    {error && <div className="admin-state error" role="alert">{error}</div>}
    {message && !error && <div className={`admin-state ${result?.applied ? "newsletter-ok" : ""}`} role="status">{message}</div>}
    {totals && <div className="inventory-import-totals">
      <span><b>{totals.rows}</b> dòng</span><span><b>{totals.updates}</b> cập nhật</span><span><b>{totals.creates}</b> mã mới</span><span><b>{totals.quantity}</b> sản phẩm nhập</span>{totals.skips > 0 && <span><b>{totals.skips}</b> không đổi</span>}<span className={totals.errors ? "bad" : ""}><b>{totals.errors}</b> lỗi</span>
    </div>}
    {result?.items?.length > 0 && <div className="inventory-import-table"><table><thead><tr><th>Dòng</th><th>Mã hàng</th><th>Việc sẽ làm</th><th>Tồn kho</th><th>Giá bán</th><th>Giá giảm</th><th>Ghi chú / lỗi</th></tr></thead><tbody>
      {result.items.map((item) => <tr key={item.line} className={item.errors.length ? "bad" : item.action}>
        <td>{item.line}</td>
        <td><strong>{item.sku}</strong>{item.productName && <small>{item.productName} {item.name}</small>}</td>
        <td>{ACTION[item.action] || "—"}</td>
        <td>{item.before ? `${item.before.stock} → ${item.after.stock}` : item.after ? item.after.stock : "—"}</td>
        <td>{item.after ? money(item.after.price) : "—"}</td>
        <td>{item.after ? money(item.after.salePrice) : "—"}</td>
        <td>{item.errors.length ? <span className="error-text">{item.errors.join("; ")}</span> : item.summary}</td>
      </tr>)}
    </tbody></table></div>}
    {result && !result.applied && <div className="inventory-import-actions">
      {totals?.errors > 0 && <small>Sửa các dòng lỗi trong file rồi chọn lại file. Có dòng lỗi thì không ghi dòng nào</small>}
      <button type="button" className="btn btn-dark btn-small" disabled={!canApply || !!busy} onClick={() => send("apply")}>{busy === "apply" ? "Đang ghi..." : "Ghi vào kho"}</button>
    </div>}
    {result?.applied && <div className="inventory-import-actions"><button type="button" className="btn btn-light btn-small" onClick={reset}>Nhập file khác</button></div>}
  </section>;
}
