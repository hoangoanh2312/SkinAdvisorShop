import { useEffect, useMemo, useState } from "react";
import "./addressAdministrativePicker.css";
import { Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { PHONE_MESSAGE, normalizeVnPhone } from "../../utils/inputPolicy";
import { VIETNAM_PROVINCES, loadProvinceWards, provinceByName, normalizeAdministrativeText, ADMINISTRATIVE_DATA_SOURCE } from "../../utils/vietnamAdministrativeUnits";

const LABELS = ["Nhà", "Công ty", "Khác"];
const addressText = (address) => [address.address || address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(", ");

export default function AddressBookModal({ addresses, selectedId, mode, draft, saving, error, onClose, onSelect, onAdd, onEdit, onDelete, onDefault, onDraftChange, onSave, onBack }) {
  const [wards, setWards] = useState([]);
  const [wardState, setWardState] = useState("idle");
  const [wardError, setWardError] = useState("");
  const [wardSearch, setWardSearch] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const province = provinceByName(draft.province);

  useEffect(() => {
    if (mode === "list" || !province) {
      setWards([]);
      setWardState("idle");
      return;
    }
    const controller = new AbortController();
    setWards([]);
    setWardSearch("");
    setWardError("");
    setWardState("loading");
    loadProvinceWards(province.code, controller.signal)
      .then((items) => { if (!controller.signal.aborted) { setWards(items); setWardState("ready"); } })
      .catch((error) => { if (!controller.signal.aborted) { setWardError(error.message); setWardState("error"); } });
    return () => controller.abort();
  }, [mode, province?.code, retryCount]);

  const filteredWards = useMemo(() => {
    const q = normalizeAdministrativeText(wardSearch);
    if (!q) return wards;
    return wards.filter((item) => normalizeAdministrativeText(item.name).includes(q));
  }, [wards, wardSearch]);
  const isExistingCustomWard = Boolean(draft.ward && !wards.some((item) => item.name === draft.ward));
  const wardIsFilteredOut = Boolean(draft.ward && !filteredWards.some((item) => item.name === draft.ward));
  const isExistingProvince = Boolean(draft.province && !province);
  const isSavedProvinceLabel = Boolean(draft.province && !VIETNAM_PROVINCES.some((p) => p.name === draft.province));
  const isUnknownProvince = Boolean(draft.province && !province);

  return <div className="address-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
      <header><div><span className="eyebrow">ĐỊA CHỈ GIAO HÀNG</span><h2 id="address-modal-title">{mode === "list" ? "Địa chỉ của tôi" : mode === "add" ? "Thêm địa chỉ mới" : "Cập nhật địa chỉ"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X /></button></header>
      {mode === "list" ? <>
        <div className="address-list">{addresses.map((address) => <article className={`address-option ${selectedId === address._id ? "selected" : ""}`} key={address._id}>
          <label><input type="radio" name="checkoutAddress" checked={selectedId === address._id} onChange={() => onSelect(address._id)} /><span><strong>{address.fullName} <i>|</i> {address.phone}</strong>{!normalizeVnPhone(address.phone) && <small className="field-error">Số điện thoại chưa hợp lệ — bấm Sửa để cập nhật</small>}<small>{addressText(address)}</small><span className="address-tags">{address.label && <em>{address.label}</em>}{address.isDefault && <b>Mặc định</b>}</span></span></label>
          <div className="address-actions"><button type="button" onClick={() => onEdit(address)}><Pencil /> Sửa</button><button type="button" onClick={() => onDelete(address)}><Trash2 /> Xóa</button>{!address.isDefault && <button type="button" onClick={() => onDefault(address._id)}><Star /> Đặt mặc định</button>}</div>
        </article>)}</div>
        {error && <p className="form-error">{error}</p>}
        <footer><button type="button" className="btn address-add-button" onClick={onAdd}><Plus /> Thêm địa chỉ mới</button><button type="button" className="btn btn-dark" disabled={!selectedId} onClick={onClose}>Dùng địa chỉ này</button></footer>
      </> : <form className="address-form" onSubmit={onSave}>
        <div className="form-grid">
          <label>Họ và tên<input required name="fullName" maxLength={60} autoComplete="name" value={draft.fullName} onChange={onDraftChange} /></label>
          <label>Số điện thoại<input required name="phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} pattern="0[35789][0-9]{8}" title={PHONE_MESSAGE} placeholder="VD: 0912345678" value={draft.phone} onChange={(event) => onDraftChange({ target: { name: "phone", value: event.target.value.replace(/\D/g, "").slice(0, 10), type: "tel" } })} aria-invalid={Boolean(draft.phone) && !normalizeVnPhone(draft.phone)} />{draft.phone && !normalizeVnPhone(draft.phone) && <small className="field-error">{PHONE_MESSAGE}</small>}</label>
          <label>Tỉnh / Thành phố
            <select required name="province" value={draft.province} onChange={onDraftChange} aria-label="Chọn tỉnh hoặc thành phố">
              <option value="">-- Chọn tỉnh / thành phố --</option>
              {isSavedProvinceLabel && <option value={draft.province}>{draft.province} (địa chỉ đã lưu)</option>}
              {VIETNAM_PROVINCES.map((p) => <option key={p.code} value={p.name}>{p.name}</option>)}
            </select>
          </label>
          <label>Phường / Xã
            {wardState === "error" || isExistingProvince ? (
              <>
                <input required name="ward" value={draft.ward} onChange={onDraftChange} placeholder="Nhập phường / xã nếu đang không tải được danh sách" />
                <small className="address-ward-hint">{isExistingProvince ? "Địa chỉ cũ: vui lòng chọn một tỉnh trong danh sách mới để cập nhật" : wardError}</small>
                {wardState === "error" && <button type="button" className="address-ward-retry" onClick={() => setRetryCount((n) => n + 1)}>Tải lại danh sách chuẩn</button>}
              </>
            ) : (
              <>
                {wardState === "ready" && <input type="search" className="address-ward-search" autoComplete="off" value={wardSearch} onChange={(event) => setWardSearch(event.target.value)} placeholder="Tìm phường / xã, ví dụ: Song Lộc" aria-label="Tìm phường hoặc xã" />}
                <select required name="ward" value={draft.ward} disabled={!province || wardState === "loading"} onChange={onDraftChange} aria-label="Chọn phường hoặc xã">
                  <option value="">{!province ? "-- Chọn tỉnh trước --" : wardState === "loading" ? "Đang tải danh mục..." : "-- Chọn phường / xã --"}</option>
                  {isExistingCustomWard && <option value={draft.ward}>{draft.ward} (địa chỉ đã lưu)</option>}
                  {wardIsFilteredOut && !isExistingCustomWard && <option value={draft.ward}>{draft.ward} (đang chọn)</option>}
                  {filteredWards.map((unit) => <option value={unit.name} key={unit.code}>{unit.name}</option>)}
                </select>
                {wardState === "ready" && <small className="address-ward-complete">Đã tải {wards.length}/{province.expectedWards} đơn vị cấp xã, {filteredWards.length} kết quả phù hợp. <a href={ADMINISTRATIVE_DATA_SOURCE.url} target="_blank" rel="noreferrer">Nguồn dữ liệu hành chính</a></small>}
                {wardState === "ready" && wardSearch && filteredWards.length === 0 && <small className="address-ward-hint">Không tìm thấy. Hãy thử viết không dấu hoặc nhập tên khác.</small>}
              </>
            )}
          </label>
          <label className="wide">Địa chỉ chi tiết<input required name="address" maxLength={200} autoComplete="street-address" value={draft.address} onChange={onDraftChange} placeholder="Số nhà, tên đường, ấp/khu phố..." /></label>
          <label className="wide">Loại địa chỉ<select name="label" value={draft.label} onChange={onDraftChange}>{LABELS.map((label) => <option value={label} key={label}>{label}</option>)}</select></label>
          <label className="wide default-checkbox"><input type="checkbox" name="isDefault" checked={draft.isDefault} onChange={onDraftChange} /> Đặt làm địa chỉ mặc định</label>
        </div>
        {error && <p className="form-error">{error}</p>}
        <footer><button type="button" className="btn address-add-button" onClick={onBack}>Quay lại</button><button type="submit" className="btn btn-dark" disabled={saving}>{saving ? "Đang lưu..." : "Lưu địa chỉ"}</button></footer>
      </form>}
    </section>
  </div>;
}
