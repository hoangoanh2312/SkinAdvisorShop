import { Pencil, Plus, Star, Trash2, X } from "lucide-react";

const LABELS = ["Nhà", "Công ty", "Khác"];
const addressText = (address) => [address.address || address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(", ");

export default function AddressBookModal({ addresses, selectedId, mode, draft, saving, error, onClose, onSelect, onAdd, onEdit, onDelete, onDefault, onDraftChange, onSave, onBack }) {
  return <div className="address-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="address-modal" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
      <header><div><span className="eyebrow">SKINORA DELIVERY</span><h2 id="address-modal-title">{mode === "list" ? "Địa chỉ của tôi" : mode === "add" ? "Thêm địa chỉ mới" : "Cập nhật địa chỉ"}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Đóng"><X /></button></header>
      {mode === "list" ? <>
        <div className="address-list">{addresses.map((address) => <article className={`address-option ${selectedId === address._id ? "selected" : ""}`} key={address._id}>
          <label><input type="radio" name="checkoutAddress" checked={selectedId === address._id} onChange={() => onSelect(address._id)} /><span><strong>{address.fullName} <i>|</i> {address.phone}</strong><small>{addressText(address)}</small><span className="address-tags">{address.label && <em>{address.label}</em>}{address.isDefault && <b>Mặc định</b>}</span></span></label>
          <div className="address-actions"><button type="button" onClick={() => onEdit(address)}><Pencil /> Sửa</button><button type="button" onClick={() => onDelete(address)}><Trash2 /> Xóa</button>{!address.isDefault && <button type="button" onClick={() => onDefault(address._id)}><Star /> Đặt mặc định</button>}</div>
        </article>)}</div>
        {error && <p className="form-error">{error}</p>}
        <footer><button type="button" className="btn address-add-button" onClick={onAdd}><Plus /> Thêm địa chỉ mới</button><button type="button" className="btn btn-dark" disabled={!selectedId} onClick={onClose}>Dùng địa chỉ này</button></footer>
      </> : <form className="address-form" onSubmit={onSave}>
        <div className="form-grid">{[["fullName", "Họ và tên"], ["phone", "Số điện thoại"], ["province", "Tỉnh / Thành phố"], ["ward", "Phường / Xã"], ["address", "Địa chỉ chi tiết"]].map(([name, label]) => <label className={name === "address" ? "wide" : ""} key={name}>{label}<input required name={name} value={draft[name]} onChange={onDraftChange} /></label>)}<label className="wide">Loại địa chỉ<select name="label" value={draft.label} onChange={onDraftChange}>{LABELS.map((label) => <option value={label} key={label}>{label}</option>)}</select></label><label className="wide default-checkbox"><input type="checkbox" name="isDefault" checked={draft.isDefault} onChange={onDraftChange} /> Đặt làm địa chỉ mặc định</label></div>
        {error && <p className="form-error">{error}</p>}
        <footer><button type="button" className="btn address-add-button" onClick={onBack}>Quay lại</button><button type="submit" className="btn btn-dark" disabled={saving}>{saving ? "Đang lưu..." : "Lưu địa chỉ"}</button></footer>
      </form>}
    </section>
  </div>;
}
