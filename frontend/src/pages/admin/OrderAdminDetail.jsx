import { ArrowLeft, CheckCircle2, MapPin, Package, ShieldCheck, UserRound } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";
import { displayOrderCode, formatCurrency, formatDate, orderStatusLabel, paymentStatusLabel } from "../../utils/formatters";

const nextStatus = { pending: "confirmed", confirmed: "shipping", shipping: "completed" };
const actionLabel = { confirmed: "Xác nhận đơn", shipping: "Bắt đầu giao", completed: "Hoàn thành đơn" };
const methodLabel = { COD: "Thanh toán khi nhận hàng", VNPAY: "VNPay", BANK_TRANSFER: "Chuyển khoản ngân hàng" };

export default function OrderAdminDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState("");
  const [modal, setModal] = useState(null); const [busy, setBusy] = useState(false); const [actionError, setActionError] = useState("");
  const load = useCallback(async () => { try { const { data } = await axiosClient.get(`/admin/orders/${id}`, { sessionProtected: true }); setOrder(data.data.order); } catch (requestError) { setError(requestError.response?.data?.message || "Không thể tải chi tiết đơn hàng."); } finally { setLoading(false); } }, [id]);
  // The effect starts an external API synchronization; state updates occur after the request settles.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => { load(); }, [load]);
  const closeModal = useCallback(() => { if (!busy) { setModal(null); setActionError(""); } }, [busy]);
  const runAction = async () => {
    if (busy || !modal) return; setBusy(true); setActionError("");
    try {
      const response = modal.type === "verify" ? await axiosClient.put(`/admin/orders/${id}/payment/verify`, {}, { sessionProtected: true }) : await axiosClient.put(`/admin/orders/${id}/status`, { orderStatus: modal.status }, { sessionProtected: true });
      setOrder(response.data.data.order); setModal(null);
    } catch (requestError) { setActionError(requestError.response?.data?.message || "Không thể thực hiện thao tác."); }
    finally { setBusy(false); }
  };
  if (loading) return <div className="admin-detail-state">Đang tải chi tiết đơn hàng...</div>;
  if (!order) return <div className="admin-detail-state error"><p>{error}</p><button className="btn btn-small" onClick={() => { setLoading(true); setError(""); load(); }}>Thử lại</button></div>;
  const address = order.shippingAddress || {}; const addressLine = [address.address || address.addressLine, address.ward, address.district, address.province].filter(Boolean).join(", ");
  const canConfirm = order.orderStatus !== "pending" || order.paymentMethod === "COD" || order.paymentStatus === "paid"; const following = nextStatus[order.orderStatus];
  return <div className="admin-order-detail"><Link className="text-link" to="/admin/orders"><ArrowLeft /> Danh sách đơn hàng</Link><header className="admin-detail-heading"><div><span className="eyebrow">CHI TIẾT ĐƠN HÀNG</span><h1>{displayOrderCode(order)}</h1><p>Tạo lúc {formatDate(order.createdAt)}</p></div><div><span className={`admin-badge payment-${order.paymentStatus}`}>{paymentStatusLabel[order.paymentStatus]}</span><span className={`admin-badge order-${order.orderStatus}`}>{orderStatusLabel[order.orderStatus]}</span></div></header>
    <div className="admin-detail-grid"><main><section className="admin-detail-card"><h2><UserRound /> Khách hàng</h2><strong>{order.user?.fullName || address.fullName}</strong><p>{order.user?.email || "—"}</p></section><section className="admin-detail-card"><h2><MapPin /> Địa chỉ giao hàng (snapshot)</h2><strong>{address.fullName} · {address.phone}</strong><p>{addressLine}</p></section><section className="admin-detail-card"><h2><Package /> Sản phẩm</h2><div className="admin-detail-items">{order.items.map((item) => <article key={item.variant}><img src={item.image} alt="" /><div><strong>{item.productName}</strong><small>{item.variantName} · SKU {item.sku}</small><span>{formatCurrency(item.unitPrice)} × {item.quantity}</span></div><b>{formatCurrency(item.subtotal)}</b></article>)}</div></section></main>
      <aside><section className="admin-detail-card admin-payment-card"><h2><ShieldCheck /> Thanh toán</h2><dl><div><dt>Phương thức</dt><dd>{methodLabel[order.paymentMethod]}</dd></div><div><dt>Trạng thái</dt><dd>{paymentStatusLabel[order.paymentStatus]}</dd></div><div><dt>Tạm tính</dt><dd>{formatCurrency(order.subtotal)}</dd></div><div><dt>Giảm giá {order.voucherCode && `(${order.voucherCode})`}</dt><dd>-{formatCurrency(order.discount)}</dd></div><div><dt>Phí vận chuyển</dt><dd>{formatCurrency(order.shippingFee)}</dd></div><div className="total"><dt>Tổng cộng</dt><dd>{formatCurrency(order.total)}</dd></div></dl></section><section className="admin-detail-card"><h2>Thao tác</h2><div className="admin-detail-actions">{order.paymentMethod === "BANK_TRANSFER" && order.paymentStatus === "pending_verification" && !["cancelled", "completed"].includes(order.orderStatus) && <button className="btn btn-dark full" onClick={() => setModal({ type: "verify" })}><CheckCircle2 /> Xác minh thanh toán</button>}{following && (following !== "confirmed" || canConfirm) && <button className="btn btn-dark full" onClick={() => setModal({ type: "status", status: following })}>{actionLabel[following]}</button>}{order.orderStatus === "pending" && !canConfirm && <p className="admin-action-note">Đơn online phải được thanh toán trước khi xác nhận.</p>}{["pending", "confirmed"].includes(order.orderStatus) && <button className="btn admin-btn-danger full" onClick={() => setModal({ type: "status", status: "cancelled" })}>Hủy đơn hàng</button>}</div></section></aside></div>
    {modal && <ConfirmActionModal busy={busy} error={actionError} danger={modal.status === "cancelled"} onClose={closeModal} onConfirm={runAction} title={modal.type === "verify" ? "Xác minh đã nhận chuyển khoản?" : `${actionLabel[modal.status] || "Hủy đơn hàng"}?`} description={modal.type === "verify" ? `Hệ thống sẽ trừ tồn kho và đánh dấu ${displayOrderCode(order)} đã thanh toán. Thao tác chỉ thành công khi đủ tồn kho.` : `Xác nhận chuyển trạng thái đơn ${displayOrderCode(order)} sang “${orderStatusLabel[modal.status]}”.`} confirmLabel={modal.type === "verify" ? "Xác minh thanh toán" : actionLabel[modal.status] || "Hủy đơn"} />}
  </div>;
}
