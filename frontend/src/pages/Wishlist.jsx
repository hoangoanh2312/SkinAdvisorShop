import { Link } from "react-router-dom";
import ProductCard from "../components/product/ProductCard";
import { useWishlist } from "../contexts/wishlistState";
import { useAuth } from "../contexts/AuthContext";
import { normalizeProduct } from "../utils/productAdapter";

export default function Wishlist() {
  const { products, status, refresh } = useWishlist();
  const auth = useAuth();
  const guest = !auth?.loading && !auth?.user;
  const admin = !auth?.loading && auth?.user?.role === "admin";
  return <main className="container wishlist-page"><div className="wishlist-heading"><span className="eyebrow">DANH SÁCH CỦA BẠN</span><h1>Sản phẩm yêu thích</h1><p>Sản phẩm đã lưu trong tài khoản; giá và tồn kho được lấy từ mã hàng hiện tại</p></div>
    {auth?.loading && <p role="status">Đang kiểm tra tài khoản…</p>}
    {guest && <div className="empty"><h2>Đăng nhập để xem sản phẩm yêu thích</h2><p>Danh sách yêu thích được lưu riêng trong tài khoản của bạn, nên bạn có thể xem lại trên mọi thiết bị</p><Link to="/login" state={{ from: "/wishlist" }} className="btn btn-dark">Đăng nhập</Link></div>}
    {admin && <div className="empty"><h2>Tài khoản quản trị không dùng danh sách yêu thích</h2><p>Hãy đăng nhập bằng tài khoản khách hàng để lưu sản phẩm</p></div>}
    {status === "loading" && <p role="status">Đang tải sản phẩm yêu thích…</p>}
    {status === "error" && <div role="alert">Không thể tải danh sách <button type="button" onClick={refresh}>Thử lại</button></div>}
    {status === "ready" && (products.length ? <div className="product-grid three">{products.map((product) => <ProductCard key={product._id} product={normalizeProduct(product)} showAvailability />)}</div> : <div className="empty"><h2>Chưa có sản phẩm yêu thích</h2><p>Chọn biểu tượng trái tim ở sản phẩm bạn muốn lưu</p><Link to="/products" className="btn btn-dark">Khám phá sản phẩm</Link></div>)}
  </main>;
}
