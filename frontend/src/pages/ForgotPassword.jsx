import { Mail } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import axiosClient, { apiErrorMessage } from "../api/axiosClient";
import { AuthShell } from "./Login";

export default function ForgotPassword() {
  const [email, setEmail] = useState(""); const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setError(""); setMessage(""); setSending(true);
    try { const { data } = await axiosClient.post("/auth/forgot-password", { email: email.trim() }); setMessage(data.message); }
    catch (requestError) { setError(apiErrorMessage(requestError, "Chưa gửi được email. Vui lòng thử lại.")); }
    finally { setSending(false); }
  };
  return <AuthShell title="Quên mật khẩu" text="Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu (hiệu lực 30 phút)">
    <form onSubmit={submit}>
      <label>Email<div className="input-icon"><Mail /><input type="email" required maxLength="120" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tenban@gmail.com" /></div></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <button className="btn btn-dark full" disabled={sending}>{sending ? "Đang gửi..." : "Gửi liên kết đặt lại"}</button>
      <p className="auth-switch"><Link to="/login">Quay lại đăng nhập</Link></p>
    </form>
  </AuthShell>;
}
