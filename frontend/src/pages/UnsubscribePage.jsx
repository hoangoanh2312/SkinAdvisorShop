import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axiosClient from "../api/axiosClient";

// Mở từ link "Hủy nhận bản tin" ở cuối email: tự hủy ngay, không cần đăng nhập
export default function UnsubscribePage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState({ status: "loading", message: "", email: "" });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) { setState({ status: "error", message: "Link hủy nhận bản tin không hợp lệ" }); return; }
    axiosClient.post("/newsletter/unsubscribe", { token })
      .then(({ data }) => setState({ status: "done", message: data.message, email: data.data?.email || "" }))
      .catch((error) => setState({ status: "error", message: error.response?.data?.message || "Chưa hủy được, vui lòng thử lại sau" }));
  }, [token]);
  return <main className="container info-page">
    <nav className="info-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>Hủy nhận bản tin</span></nav>
    <header className="info-head"><span className="eyebrow">BẢN TIN</span><h1>Hủy nhận bản tin</h1></header>
    <div className="info-body">
      {state.status === "loading" && <p>Đang xử lý...</p>}
      {state.status === "done" && <>
        <p><strong>{state.message}</strong></p>
        {state.email && <p>Email {state.email} sẽ không nhận thêm bản tin nào. Email về đơn hàng và tài khoản vẫn được gửi bình thường</p>}
        <p>Nếu đổi ý, bạn có thể đăng ký lại bằng ô "Email của bạn" ở cuối trang</p>
      </>}
      {state.status === "error" && <p role="alert">{state.message}</p>}
      <p><Link className="text-link" to="/">Về trang chủ</Link></p>
    </div>
  </main>;
}
