import { CheckCircle2, Clipboard, Landmark, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { formatCurrency } from "../utils/formatters";

export default function BankTransfer() {
  const { orderId } = useParams();
  const [payment, setPayment] = useState(null);
  const [status, setStatus] = useState("unpaid");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      axiosClient.get(`/payments/bank-transfer/${orderId}`, { sessionProtected: true }),
      axiosClient.get(`/orders/${orderId}`, { sessionProtected: true }),
    ]).then(([instructions, orderResult]) => {
      if (!active) return;
      setPayment(instructions.data.data);
      setStatus(orderResult.data.data.order.paymentStatus);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.message || "Không thể tải thông tin chuyển khoản.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [orderId, reloadKey]);

  const retry = () => {
    setLoading(true);
    setError("");
    setReloadKey((value) => value + 1);
  };

  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1800);
    } catch { setError("Trình duyệt không cho phép sao chép tự động. Vui lòng sao chép thủ công."); }
  };

  const confirm = async () => {
    if (confirming || status === "pending_verification") return;
    setConfirming(true);
    setError("");
    try {
      const { data } = await axiosClient.post(`/payments/bank-transfer/${orderId}/confirm`, {}, { sessionProtected: true });
      setStatus(data.data.order.paymentStatus);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể xác nhận chuyển khoản.");
    } finally { setConfirming(false); }
  };

  if (loading) return <div className="container bank-transfer-page"><div className="bank-transfer-card bank-transfer-skeleton"><i /><i /><i /><i /></div></div>;
  if (!payment) return <div className="container bank-transfer-page"><div className="bank-transfer-card bank-transfer-error"><Landmark /><h1>Không thể tải VietQR</h1><p>{error}</p><button className="btn btn-dark" onClick={retry}><RefreshCw /> Thử lại</button></div></div>;

  const pending = status === "pending_verification";
  return <div className="container bank-transfer-page">
    <section className="bank-transfer-card">
      <div className="bank-transfer-heading"><span><Landmark /></span><div><small>CHUYỂN KHOẢN NGÂN HÀNG</small><h1>{pending ? "Chờ xác minh thanh toán" : "Quét mã để chuyển khoản"}</h1></div></div>
      {pending && <div className="bank-transfer-pending"><CheckCircle2 /><span><strong>Đã ghi nhận thông báo của bạn</strong><small>Đơn hàng sẽ được quản trị viên xác minh thủ công.</small></span></div>}
      <div className="bank-transfer-layout">
        <div className="vietqr"><img src={payment.qrUrl} alt={`VietQR cho đơn hàng ${payment.orderCode}`} /><small>Quét bằng ứng dụng ngân hàng hỗ trợ VietQR</small></div>
        <dl className="bank-transfer-details">
          <div><dt>Ngân hàng</dt><dd>{payment.bankCode}</dd></div>
          <div><dt>Người nhận</dt><dd>{payment.accountName}</dd></div>
          <div><dt>Số tài khoản</dt><dd><strong>{payment.accountNo}</strong><button type="button" onClick={() => copy(payment.accountNo, "account")}>{copied === "account" ? "Đã sao chép" : <><Clipboard /> Copy</>}</button></dd></div>
          <div><dt>Số tiền</dt><dd className="bank-transfer-amount">{formatCurrency(payment.amount)}</dd></div>
          <div><dt>Nội dung chuyển khoản</dt><dd><strong>{payment.orderCode}</strong><button type="button" onClick={() => copy(payment.orderCode, "content")}>{copied === "content" ? "Đã sao chép" : <><Clipboard /> Copy</>}</button></dd></div>
        </dl>
      </div>
      {error && <p className="form-error">{error}</p>}
      <p className="bank-transfer-note">Vui lòng chuyển đúng số tiền và nội dung để đơn hàng được đối soát chính xác.</p>
      <div className="bank-transfer-actions">
        <button className="btn btn-dark" disabled={confirming || pending} onClick={confirm}>{confirming ? "Đang ghi nhận..." : pending ? "Đã gửi xác nhận" : "Tôi đã chuyển khoản"}</button>
        <Link className="btn btn-light" to={`/orders/${orderId}`}>Xem đơn hàng</Link>
      </div>
    </section>
  </div>;
}
