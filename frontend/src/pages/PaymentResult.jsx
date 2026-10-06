import { CircleCheck, CircleX, Clock3 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axiosClient from "../api/axiosClient";
import { useCart } from "../contexts/CartContext";

export default function PaymentResult() {
  const location = useLocation();
  const { clearCart } = useCart();
  const [result, setResult] = useState({ loading: true, status: "pending", orderId: "", message: "" });

  useEffect(() => {
    let active = true;
    axiosClient.get(`/payments/vnpay/return${location.search}`)
      .then(({ data }) => {
        if (!active) return;
        const status = data.data.result;
        if (data.data.paymentStatus === "paid") clearCart();
        setResult({ loading: false, status, orderId: data.data.orderId, message: "" });
      })
      .catch((error) => {
        if (active) setResult({ loading: false, status: "failed", orderId: "", message: error.response?.data?.message || "Không thể xác minh kết quả thanh toán." });
      });
    return () => { active = false; };
  }, [location.search, clearCart]);

  if (result.loading) return <div className="container success-page"><Clock3 /><h1>Đang xác minh thanh toán</h1><p>Vui lòng chờ trong giây lát.</p></div>;
  const success = result.status === "success";
  const pending = result.status === "pending";
  return <div className="container success-page payment-result"><span>{success ? <CircleCheck /> : pending ? <Clock3 /> : <CircleX />}</span><h1>{success ? "Thanh toán thành công" : pending ? "Đang xác nhận thanh toán" : "Thanh toán chưa thành công"}</h1><p>{result.message || (pending ? "VNPay đã trả kết quả và hệ thống đang chờ xác nhận giao dịch." : success ? "Đơn hàng đã được thanh toán và ghi nhận." : "Giao dịch không thành công hoặc thông tin xác minh không hợp lệ.")}</p>{result.orderId && <p>Mã đơn: #{result.orderId.slice(-8).toUpperCase()}</p>}<div className="payment-result-actions">{result.orderId && <Link className="btn btn-dark" to={`/orders/${result.orderId}`}>Xem đơn hàng</Link>}<Link className="btn btn-primary" to="/products">Tiếp tục mua sắm</Link></div></div>;
}
