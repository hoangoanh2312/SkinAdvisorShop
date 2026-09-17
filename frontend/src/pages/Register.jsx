import { LockKeyhole, Mail, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { AuthShell } from "./Login";
export default function Register() {
  const [form, setForm] = useState({
      fullName: "",
      email: "",
      password: "",
      confirm: "",
    }),
    [error, setError] = useState(""),
    { register } = useAuth(),
    navigate = useNavigate();
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    register(form);
    navigate("/profile");
  };
  return (
    <AuthShell
      title="Tạo tài khoản mới"
      text="Gia nhập SKINORA để lưu chu trình chăm sóc và theo dõi đơn hàng."
    >
      <form onSubmit={submit}>
        <label>
          Họ và tên
          <div className="input-icon">
            <UserRound />
            <input
              required
              name="fullName"
              value={form.fullName}
              onChange={change}
              placeholder="Nguyễn Minh Anh"
            />
          </div>
        </label>
        <label>
          Email
          <div className="input-icon">
            <Mail />
            <input
              required
              type="email"
              name="email"
              value={form.email}
              onChange={change}
              placeholder="you@example.com"
            />
          </div>
        </label>
        <label>
          Mật khẩu
          <div className="input-icon">
            <LockKeyhole />
            <input
              required
              minLength="6"
              type="password"
              name="password"
              value={form.password}
              onChange={change}
              placeholder="Ít nhất 6 ký tự"
            />
          </div>
        </label>
        <label>
          Xác nhận mật khẩu
          <div className="input-icon">
            <LockKeyhole />
            <input
              required
              type="password"
              name="confirm"
              value={form.confirm}
              onChange={change}
            />
          </div>
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-dark full">Tạo tài khoản</button>
        <p className="auth-switch">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </form>
    </AuthShell>
  );
}
