import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AuthShell } from "./Login";
export default function Register() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" }); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false); const { register } = useAuth(); const navigate = useNavigate();
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => { event.preventDefault(); setError(""); if (form.password.length < 6) return setError("Mật khẩu phải có ít nhất 6 ký tự."); if (form.password !== form.confirmPassword) return setError("Mật khẩu xác nhận chưa khớp."); setSubmitting(true); try { await register(form); navigate("/profile"); } catch (requestError) { setError(requestError.response?.data?.message || "Không thể đăng ký. Vui lòng thử lại."); } finally { setSubmitting(false); } };
  return <AuthShell title="Tạo tài khoản mới" text="Gia nhập SKINORA để lưu chu trình chăm sóc và theo dõi đơn hàng."><form onSubmit={submit}>
    <label>Họ và tên<div className="input-icon"><UserRound /><input required name="fullName" value={form.fullName} onChange={change} /></div></label>
    <label>Email<div className="input-icon"><Mail /><input required type="email" name="email" value={form.email} onChange={change} /></div></label>
    <label>Mật khẩu<div className="input-icon"><LockKeyhole /><input required minLength="6" type="password" name="password" value={form.password} onChange={change} /></div></label>
    <label>Xác nhận mật khẩu<div className="input-icon"><LockKeyhole /><input required type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} /></div></label>
    {error && <p className="form-error">{error}</p>}<button className="btn btn-dark full" disabled={submitting}>{submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}</button><p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
  </form></AuthShell>;
}
