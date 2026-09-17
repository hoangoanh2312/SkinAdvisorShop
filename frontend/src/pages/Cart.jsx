import { ArrowLeft, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart } from "../contexts/CartContext";
import { formatPrice } from "../data/mockData";
export default function Cart() {
  const { items, total, updateQuantity, removeItem } = useCart(),
    shipping = total >= 500000 || !total ? 0 : 30000;
  return (
    <div className="container cart-page">
      <div className="page-intro compact">
        <span className="eyebrow">GIỎ HÀNG</span>
        <h1>Giỏ hàng của bạn</h1>
        <p>
          {items.length
            ? `${items.length} sản phẩm đang chờ bạn`
            : "Giỏ hàng đang trống"}
        </p>
      </div>
      {!items.length ? (
        <div className="empty cart-empty">
          <ShoppingBag />
          <h2>Chưa có sản phẩm nào</h2>
          <p>Khám phá các sản phẩm được tuyển chọn cho làn da của bạn.</p>
          <Link className="btn btn-dark" to="/products">
            Khám phá sản phẩm
          </Link>
        </div>
      ) : (
        <div className="cart-layout">
          <section className="cart-list">
            <div className="cart-head">
              <span>Sản phẩm</span>
              <span>Số lượng</span>
              <span>Thành tiền</span>
            </div>
            {items.map((i) => (
              <article className="cart-item" key={i.key}>
                <img src={i.product.images[0]} alt={i.product.name} />
                <div className="cart-product">
                  <span className="brand">{i.product.brand}</span>
                  <Link to={`/products/${i.product.id}`}>{i.product.name}</Link>
                  <small>Dung tích: {i.variant.size}</small>
                  <button onClick={() => removeItem(i.key)}>
                    <Trash2 /> Xóa
                  </button>
                </div>
                <div className="qty">
                  <button onClick={() => updateQuantity(i.key, i.quantity - 1)}>
                    <Minus />
                  </button>
                  <span>{i.quantity}</span>
                  <button onClick={() => updateQuantity(i.key, i.quantity + 1)}>
                    <Plus />
                  </button>
                </div>
                <strong>{formatPrice(i.variant.price * i.quantity)}</strong>
              </article>
            ))}
            <Link to="/products" className="text-link">
              <ArrowLeft /> Tiếp tục mua sắm
            </Link>
          </section>
          <aside className="order-summary">
            <h2>Tóm tắt đơn hàng</h2>
            <div>
              <span>Tạm tính</span>
              <strong>{formatPrice(total)}</strong>
            </div>
            <div>
              <span>Giảm giá</span>
              <strong>0đ</strong>
            </div>
            <div>
              <span>Phí vận chuyển</span>
              <strong>{shipping ? formatPrice(shipping) : "Miễn phí"}</strong>
            </div>
            <label>Mã giảm giá</label>
            <div className="voucher">
              <input placeholder="Nhập mã giảm giá" />
              <button>Áp dụng mã</button>
            </div>
            <div className="summary-total">
              <span>Tổng cộng</span>
              <strong>{formatPrice(total + shipping)}</strong>
            </div>
            <Link to="/checkout" className="btn btn-dark full">
              Tiến hành thanh toán
            </Link>
            <small>Thuế đã được bao gồm trong giá sản phẩm.</small>
          </aside>
        </div>
      )}
    </div>
  );
}
