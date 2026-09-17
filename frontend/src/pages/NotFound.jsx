import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>Trang này không tồn tại</h1>
      <p>Có vẻ đường dẫn bạn tìm kiếm đã thay đổi hoặc không còn khả dụng.</p>
      <Link className="btn btn-dark" to="/">
        <ArrowLeft /> Về trang chủ
      </Link>
    </div>
  );
}
