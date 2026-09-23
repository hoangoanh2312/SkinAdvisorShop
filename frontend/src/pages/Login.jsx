import { Eye, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
export default function Login() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth(); const navigate = useNavigate(); const location = useLocation();
  const submit = async (event) => { event.preventDefault(); setError(""); setSubmitting(true); try { await login({ email, password }); navigate(location.state?.from || "/profile", { replace: true }); } catch (requestError) { setError(requestError.response?.data?.message || "Không thể đăng nhập. Vui lòng thử lại."); } finally { setSubmitting(false); } };
  return <AuthShell title="Chào mừng bạn trở lại" text="Đăng nhập để tiếp tục hành trình chăm sóc làn da.">
    <form onSubmit={submit}>
      <label>Email<div className="input-icon"><Mail /><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></div></label>
      <label>Mật khẩu<div className="input-icon"><LockKeyhole /><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" /><Eye /></div></label>
      {error && <p className="form-error">{error}</p>}
      <button className="btn btn-dark full" disabled={submitting}>{submitting ? "Đang đăng nhập..." : "Đăng nhập"}</button>
      <p className="auth-switch">Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link></p>
    </form>
  </AuthShell>;
}
export function AuthShell({ title, text, children }) { return <div className="auth-page"><div className="auth-visual"><div><span className="logo logo-light">SKINORA.</span><blockquote>“Hiểu làn da,<br />yêu chính mình.”</blockquote><p>Khám phá vẻ đẹp tự nhiên cùng những lựa chọn chăm sóc được thiết kế riêng.</p></div></div><div className="auth-form"><span className="eyebrow">THÀNH VIÊN SKINORA</span><h1>{title}</h1><p>{text}</p>{children}</div></div>; }
