import { Banknote, CreditCard, Landmark, LockKeyhole, MapPin, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import AddressBookModal from "../components/checkout/AddressBookModal";
import { useCart } from "../contexts/CartContext";
import { formatCurrency } from "../utils/formatters";

const SHIPPING_FIELDS = ["fullName", "phone", "province", "ward", "address"];
const EMPTY_ADDRESS = { fullName: "", phone: "", province: "", ward: "", address: "", label: "Nhà", isDefault: false };
const addressLine = (value) => [value.address || value.addressLine, value.ward, value.district, value.province].filter(Boolean).join(", ");

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const [addresses, setAddresses] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [addressLoading, setAddressLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("list");
  const [draft, setDraft] = useState(EMPTY_ADDRESS);
  const [editingId, setEditingId] = useState("");
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [voucher, setVoucher] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [pendingVnpayOrderId, setPendingVnpayOrderId] = useState("");

  const selectedAddress = addresses.find((value) => value._id === selectedId);

  useEffect(() => {
    const loadAddresses = async () => {
      try {
        const { data } = await axiosClient.get("/users/me/addresses", { sessionProtected: true });
        const values = data.data.addresses;
        setAddresses(values);
        setSelectedId(values.find((value) => value.isDefault)?._id || values[0]?._id || "");
      } catch (requestError) {
        setError(requestError.response?.data?.message || "Không thể tải sổ địa chỉ.");
      } finally {
        setAddressLoading(false);
      }
    };
    loadAddresses();
  }, []);

  const refreshAddresses = async (preferredId = selectedId) => {
    const { data } = await axiosClient.get("/users/me/addresses", { sessionProtected: true });
    const values = data.data.addresses;
    setAddresses(values);
    setSelectedId(values.some((value) => value._id === preferredId) ? preferredId : values.find((value) => value.isDefault)?._id || values[0]?._id || "");
  };
  const openAddressList = () => { setAddressError(""); setModalMode("list"); setModalOpen(true); };
  const openAddAddress = () => { setAddressError(""); setEditingId(""); setDraft({ ...EMPTY_ADDRESS, isDefault: addresses.length === 0 }); setModalMode("add"); setModalOpen(true); };
  const openEditAddress = (value) => {
    setAddressError("");
    setEditingId(value._id);
    setDraft({ fullName: value.fullName || "", phone: value.phone || "", province: value.province || "", ward: value.ward || "", address: value.address || value.addressLine || "", label: value.label || "Khác", isDefault: Boolean(value.isDefault) });
    setModalMode("edit");
  };
  const changeDraft = (event) => setDraft((value) => ({ ...value, [event.target.name]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const saveAddress = async (event) => {
    event.preventDefault();
    setAddressSaving(true);
    setAddressError("");
    const payload = { ...Object.fromEntries(SHIPPING_FIELDS.map((field) => [field, draft[field].trim()])), label: draft.label, isDefault: draft.isDefault };
    try {
      if (editingId) {
        await axiosClient.put(`/users/me/addresses/${editingId}`, payload, { sessionProtected: true });
        if (draft.isDefault) await axiosClient.put(`/users/me/addresses/${editingId}/default`, {}, { sessionProtected: true });
        await refreshAddresses(editingId);
      } else {
        const { data } = await axiosClient.post("/users/me/addresses", payload, { sessionProtected: true });
        await refreshAddresses(data.data.address._id);
      }
      setModalMode("list");
    } catch (requestError) {
      setAddressError(requestError.response?.data?.message || "Không thể lưu địa chỉ.");
    } finally {
      setAddressSaving(false);
    }
  };
  const deleteAddress = async (value) => {
    if (!window.confirm(`Xóa địa chỉ của ${value.fullName}?`)) return;
    setAddressError("");
    try {
      await axiosClient.delete(`/users/me/addresses/${value._id}`, { sessionProtected: true });
      await refreshAddresses(value._id === selectedId ? "" : selectedId);
    } catch (requestError) {
      setAddressError(requestError.response?.data?.message || "Không thể xóa địa chỉ.");
    }
  };
  const setDefaultAddress = async (addressId) => {
    setAddressError("");
    try {
      await axiosClient.put(`/users/me/addresses/${addressId}/default`, {}, { sessionProtected: true });
      await refreshAddresses(selectedId);
    } catch (requestError) {
      setAddressError(requestError.response?.data?.message || "Không thể đặt địa chỉ mặc định.");
    }
  };
  const validateVoucher = async () => {
    setError("");
    try {
      const { data } = await axiosClient.post("/vouchers/validate", { code: voucherCode, orderValue: total }, { sessionProtected: true });
      setVoucher(data.data);
    } catch (requestError) {
      setVoucher(null);
      setError(requestError.response?.data?.message || "Không thể kiểm tra voucher.");
    }
  };

  const openVnpay = async (id) => {
    const { data } = await axiosClient.post("/payments/vnpay/create", { orderId: id }, { sessionProtected: true });
    window.location.assign(data.data.paymentUrl);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!items.length || loading) return;
    if (!selectedAddress) {
      setError("Vui lòng thêm và chọn địa chỉ nhận hàng.");
      openAddAddress();
      return;
    }
    const shippingAddress = {
      fullName: selectedAddress.fullName?.trim(),
      phone: selectedAddress.phone?.trim(),
      province: selectedAddress.province?.trim(),
      ward: selectedAddress.ward?.trim(),
      address: (selectedAddress.address || selectedAddress.addressLine || "").trim(),
    };
    if (SHIPPING_FIELDS.some((field) => !shippingAddress[field])) {
      setError("Địa chỉ nhận hàng chưa đầy đủ. Vui lòng cập nhật địa chỉ.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (paymentMethod === "VNPAY" && pendingVnpayOrderId) {
        await openVnpay(pendingVnpayOrderId);
        return;
      }
      const { data } = await axiosClient.post("/orders", {
        items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        shippingAddress,
        voucherCode: voucher?.code || "",
        paymentMethod,
      }, { sessionProtected: true });
      const createdOrderId = data.data.order._id;
      if (paymentMethod === "VNPAY") {
        setPendingVnpayOrderId(createdOrderId);
        await openVnpay(createdOrderId);
      } else if (paymentMethod === "BANK_TRANSFER") {
        clearCart();
        navigate(`/payment/bank-transfer/${createdOrderId}`);
      } else {
        setOrderId(createdOrderId);
        clearCart();
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || (paymentMethod === "VNPAY" ? "Không thể chuyển tới VNPay. Bạn có thể thử lại." : "Không thể tạo đơn hàng."));
    } finally {
      setLoading(false);
    }
  };

  if (orderId) return <div className="container success-page"><span>✓</span><h1>Đặt hàng thành công</h1><p>Đơn hàng của bạn đã được ghi nhận.</p><button className="btn btn-dark" onClick={() => navigate(`/orders/${orderId}`)}>Xem đơn hàng</button></div>;
  if (!items.length) return <div className="container empty"><h2>Giỏ hàng đang trống</h2><Link to="/products">Tiếp tục mua sắm</Link></div>;

  return <>
    <div className="container checkout-page">
      <div className="page-intro compact"><span className="eyebrow">THANH TOÁN AN TOÀN</span><h1>Hoàn tất đơn hàng</h1></div>
      <form className="checkout-grid" onSubmit={submit}>
        <div className="checkout-flow">
          <section className="checkout-section shipping-section">
            <div className="checkout-section-title"><span>01</span><h2>Địa chỉ nhận hàng</h2></div>
            {addressLoading ? <p className="address-loading">Đang tải sổ địa chỉ...</p> : selectedAddress ? <div className="selected-address"><MapPin /><div><strong>{selectedAddress.fullName} <i>|</i> {selectedAddress.phone}</strong><p>{addressLine(selectedAddress)}</p><div>{selectedAddress.label && <em>{selectedAddress.label}</em>}{selectedAddress.isDefault && <b>Mặc định</b>}</div></div><button type="button" onClick={openAddressList}>Thay đổi</button></div> : <button type="button" className="empty-address-cta" onClick={openAddAddress}><Plus /> Thêm địa chỉ nhận hàng</button>}
          </section>
          <section className="checkout-section">
            <div className="checkout-section-title"><span>02</span><h2>Sản phẩm</h2></div>
            {items.map((item) => <div className="checkout-product" key={item.key}><img src={item.image} alt={item.productName} /><span><strong>{item.productName}</strong><small>{item.variantName} × {item.quantity}</small></span><b>{formatCurrency(item.displayPrice * item.quantity)}</b></div>)}
          </section>
          <section className="checkout-section">
            <div className="checkout-section-title"><span>03</span><h2>Voucher</h2></div>
            <div className="voucher checkout-voucher"><input aria-label="Mã giảm giá" placeholder="Nhập mã voucher" value={voucherCode} disabled={Boolean(pendingVnpayOrderId)} onChange={(event) => { setVoucherCode(event.target.value); setVoucher(null); }} /><button type="button" disabled={loading || Boolean(pendingVnpayOrderId)} onClick={validateVoucher}>Áp dụng</button></div>
            {voucher && <p className="voucher-applied">Đã áp dụng {voucher.code}: giảm {formatCurrency(voucher.discount)}</p>}
          </section>
          <section className="checkout-section">
            <div className="checkout-section-title"><span>04</span><h2>Phương thức thanh toán</h2></div>
            <label className={`payment-option ${paymentMethod === "COD" ? "active" : ""}`}><input type="radio" name="paymentMethod" value="COD" checked={paymentMethod === "COD"} disabled={Boolean(pendingVnpayOrderId)} onChange={(event) => setPaymentMethod(event.target.value)} /><Banknote /><span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Thanh toán trực tiếp khi đơn hàng được giao tới bạn.</small></span></label>
            <label className={`payment-option ${paymentMethod === "VNPAY" ? "active" : ""}`}><input type="radio" name="paymentMethod" value="VNPAY" checked={paymentMethod === "VNPAY"} disabled={Boolean(pendingVnpayOrderId)} onChange={(event) => setPaymentMethod(event.target.value)} /><CreditCard /><span><strong>Thanh toán qua VNPay</strong><small>Chuyển tới cổng VNPay Sandbox để thanh toán an toàn.</small></span></label>
            <label className={`payment-option ${paymentMethod === "BANK_TRANSFER" ? "active" : ""}`}><input type="radio" name="paymentMethod" value="BANK_TRANSFER" checked={paymentMethod === "BANK_TRANSFER"} disabled={Boolean(pendingVnpayOrderId)} onChange={(event) => setPaymentMethod(event.target.value)} /><Landmark /><span><strong>Chuyển khoản ngân hàng</strong><small>Quét VietQR với đúng số tiền và nội dung của đơn hàng.</small></span></label>
          </section>
        </div>
        <aside className="order-summary"><span className="summary-step">05</span><h2>Tổng thanh toán</h2><div><span>Tạm tính</span><strong>{formatCurrency(total)}</strong></div>{voucher && <div><span>Giảm giá</span><strong>-{formatCurrency(voucher.discount)}</strong></div>}<div className="summary-total"><span>Tổng cộng</span><strong>{formatCurrency(voucher?.finalValue ?? total)}</strong></div>{error && <p className="form-error">{error}</p>}<button className="btn btn-dark full" disabled={loading || addressLoading}>{loading ? "Đang xử lý..." : pendingVnpayOrderId ? "Thử lại thanh toán VNPay" : paymentMethod === "VNPAY" ? "Thanh toán VNPay" : paymentMethod === "BANK_TRANSFER" ? "Tạo mã VietQR" : "Đặt hàng"}</button><small><LockKeyhole /> Giá, voucher và tồn kho được backend xác nhận lại.</small></aside>
      </form>
    </div>
    {modalOpen && <AddressBookModal addresses={addresses} selectedId={selectedId} mode={modalMode} draft={draft} saving={addressSaving} error={addressError} onClose={() => setModalOpen(false)} onSelect={setSelectedId} onAdd={openAddAddress} onEdit={openEditAddress} onDelete={deleteAddress} onDefault={setDefaultAddress} onDraftChange={changeDraft} onSave={saveAddress} onBack={() => setModalMode("list")} />}
  </>;
}
