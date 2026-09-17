import { Banknote, CreditCard, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { formatPrice } from "../data/mockData";
import { useCart } from "../contexts/CartContext";
export default function Checkout() {
  const { items, total } = useCart(),
    [payment, setPayment] = useState("cod"),
    [done, setDone] = useState(false);
  const submit = (e) => {
    e.preventDefault();
    setDone(true);
  };
  if (done)
    return (
      <div className="container success-page">
        <span>✓</span>
        <h1>Đã ghi nhận đơn hàng minh họa</h1>
        <p>
          Đây là giao diện thử nghiệm. Chưa có giao dịch hoặc đơn hàng thật nào
          được tạo.
        </p>
        <button className="btn btn-dark" onClick={() => setDone(false)}>
          Quay lại thanh toán
        </button>
      </div>
    );
  return (
    <div className="container checkout-page">
      <div className="page-intro compact">
          <span className="eyebrow">THANH TOÁN AN TOÀN</span>
        <h1>Thanh toán</h1>
      </div>
      <form className="checkout-grid" onSubmit={submit}>
        <section className="checkout-form">
          <h2>Thông tin nhận hàng</h2>
          <div className="form-grid">
            <label className="wide">
              Họ và tên
              <input required placeholder="Nguyễn Minh Anh" />
            </label>
            <label>
              Email
              <input required type="email" placeholder="email@example.com" />
            </label>
            <label>
              Số điện thoại
              <input required placeholder="09xx xxx xxx" />
            </label>
            <label>
              Tỉnh / thành
              <select required>
                <option value="">Chọn tỉnh / thành</option>
                <option>TP. Hồ Chí Minh</option>
                <option>Hà Nội</option>
                <option>Đà Nẵng</option>
              </select>
            </label>
            <label>
              Quận / huyện
              <input required placeholder="Quận / huyện" />
            </label>
            <label>
              Phường / xã
              <input required placeholder="Phường / xã" />
            </label>
            <label className="wide">
              Địa chỉ
              <input required placeholder="Số nhà, tên đường" />
            </label>
          </div>
          <h2>Phương thức thanh toán</h2>
          <label
            className={`payment-option ${payment === "cod" ? "active" : ""}`}
          >
            <input
              type="radio"
              name="payment"
              checked={payment === "cod"}
              onChange={() => setPayment("cod")}
            />
            <Banknote />
            <span>
              <strong>Thanh toán khi nhận hàng (COD)</strong>
              <small>
                Thanh toán bằng tiền mặt khi đơn hàng được giao tới.
              </small>
            </span>
          </label>
          <label
            className={`payment-option ${payment === "vnpay" ? "active" : ""}`}
          >
            <input
              type="radio"
              name="payment"
              checked={payment === "vnpay"}
              onChange={() => setPayment("vnpay")}
            />
            <CreditCard />
            <span>
              <strong>VNPay</strong>
              <small>Giao diện minh họa — chưa tích hợp thanh toán thật.</small>
            </span>
          </label>
        </section>
        <aside className="order-summary">
          <h2>Tóm tắt đơn hàng</h2>
          {items.map((i) => (
            <div className="checkout-item" key={i.key}>
              <img src={i.product.images[0]} />
              <span>
                {i.product.name}
                <small>
                  {i.variant.size} × {i.quantity}
                </small>
              </span>
              <strong>{formatPrice(i.variant.price * i.quantity)}</strong>
            </div>
          ))}
          <div>
            <span>Tạm tính</span>
            <strong>{formatPrice(total)}</strong>
          </div>
          <div>
            <span>Vận chuyển</span>
            <strong>{total >= 500000 ? "Miễn phí" : formatPrice(30000)}</strong>
          </div>
          <div className="summary-total">
            <span>Tổng cộng</span>
            <strong>
              {formatPrice(total + (total && total < 500000 ? 30000 : 0))}
            </strong>
          </div>
          <button className="btn btn-dark full" disabled={!items.length}>
            Đặt hàng
          </button>
          <small>
            <LockKeyhole /> Thông tin của bạn được bảo mật an toàn.
          </small>
        </aside>
      </form>
    </div>
  );
}
