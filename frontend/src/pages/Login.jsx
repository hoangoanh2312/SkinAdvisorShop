import { Eye, LockKeyhole, Mail } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
export default function Login() {
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    { login } = useAuth(),
    navigate = useNavigate();
  const submit = (e) => {
    e.preventDefault();
    login({ email, password });
    navigate("/profile");
  };
  return (
    <AuthShell
      title="Chào mừng bạn trở lại"
      text="Đăng nhập để tiếp tục hành trình chăm sóc làn da."
    >
      <form onSubmit={submit}>
        <label>
          Email
          <div className="input-icon">
            <Mail />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>
        </label>
        <label>
          Mật khẩu
          <div className="input-icon">
            <LockKeyhole />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <Eye />
          </div>
        </label>
        <div className="form-row">
          <label className="check">
            <input type="checkbox" /> Ghi nhớ đăng nhập
          </label>
          <a href="#">Quên mật khẩu?</a>
        </div>
        <button className="btn btn-dark full">Đăng nhập</button>
        <p className="auth-switch">
          Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
        </p>
      </form>
    </AuthShell>
  );
}
export function AuthShell({ title, text, children }) {
  return (
    <div className="auth-page">
      <div className="auth-visual">
        <div>
          <span className="logo logo-light">SKINORA.</span>
          <blockquote>
            “Hiểu làn da,
            <br />
            yêu chính mình.”
          </blockquote>
          <p>
            Khám phá vẻ đẹp tự nhiên cùng những lựa chọn chăm sóc được thiết kế
            riêng.
          </p>
        </div>
      </div>
      <div className="auth-form">
        <span className="eyebrow">THÀNH VIÊN SKINORA</span>
        <h1>{title}</h1>
        <p>{text}</p>
        {children}
      </div>
    </div>
  );
}
