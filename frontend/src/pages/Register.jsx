import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AuthShell } from "./Login";
import PasswordRules from "../components/common/PasswordRules";
import { apiErrorMessage } from "../api/axiosClient";
import { NAME_MESSAGE, normalizeFullName, passwordMessage, passwordProblems } from "../utils/inputPolicy";
export default function Register() {
  const [form, setForm] = useState({ fullName: "", email: "", password: "", confirmPassword: "" }); const [error, setError] = useState(""); const [submitting, setSubmitting] = useState(false); const { register } = useAuth(); const navigate = useNavigate();
  const change = (event) => setForm({ ...form, [event.target.name]: event.target.value });
  const submit = async (event) => { event.preventDefault(); setError(""); if (!normalizeFullName(form.fullName)) return setError(`${NAME_MESSAGE}.`); const problems = passwordProblems(form.password); if (problems.length) return setError(`${passwordMessage(problems)}.`); if (form.password !== form.confirmPassword) return setError("Mật khẩu xác nhận chưa khớp"); setSubmitting(true); try { await register(form); navigate("/profile"); } catch (requestError) { setError(apiErrorMessage(requestError, "Không thể đăng ký. Vui lòng thử lại.")); } finally { setSubmitting(false); } };
  return <AuthShell title="Tạo tài khoản mới" text="Gia nhập sandwich beauty để lưu chu trình chăm sóc và theo dõi đơn hàng"><form onSubmit={submit}>
    <label>Họ và tên<div className="input-icon"><UserRound /><input required name="fullName" maxLength="60" autoComplete="name" value={form.fullName} onChange={change} /></div></label>
    <label>Email<div className="input-icon"><Mail /><input required type="email" name="email" value={form.email} onChange={change} /></div></label>
    <label>Mật khẩu<div className="input-icon"><LockKeyhole /><input required minLength="8" maxLength="72" type="password" name="password" autoComplete="new-password" value={form.password} onChange={change} aria-describedby="password-rules" /></div></label>
    <PasswordRules value={form.password} />
    <label>Xác nhận mật khẩu<div className="input-icon"><LockKeyhole /><input required type="password" name="confirmPassword" value={form.confirmPassword} onChange={change} /></div></label>
    {error && <p className="form-error">{error}</p>}<button className="btn btn-dark full" disabled={submitting}>{submitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}</button><p className="auth-switch">Đã có tài khoản? <Link to="/login">Đăng nhập</Link></p>
  </form></AuthShell>;
}
