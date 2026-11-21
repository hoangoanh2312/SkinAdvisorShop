import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axiosClient, { apiErrorMessage } from "../api/axiosClient";
import PasswordRules from "../components/common/PasswordRules";
import { passwordMessage, passwordProblems } from "../utils/inputPolicy";
import { AuthShell } from "./Login";

export default function ResetPassword() {
  const [params] = useSearchParams(); const token = params.get("token") || ""; const navigate = useNavigate();
  const [form, setForm] = useState({ password: "", confirm: "" }); const [saving, setSaving] = useState(false);
  const [error, setError] = useState(""); const [done, setDone] = useState("");
  const submit = async (event) => {
    event.preventDefault(); setError("");
    const problems = passwordProblems(form.password);
    if (problems.length) return setError(`${passwordMessage(problems)}.`);
    if (form.password !== form.confirm) return setError("Mật khẩu xác nhận chưa khớp");
    setSaving(true);
    try { const { data } = await axiosClient.post("/auth/reset-password", { token, password: form.password }); setDone(data.message); setTimeout(() => navigate("/login"), 2500); }
    catch (requestError) { setError(apiErrorMessage(requestError, "Không thể đặt lại mật khẩu")); }
    finally { setSaving(false); }
  };
  if (!/^[a-f0-9]{64}$/.test(token)) return <AuthShell title="Liên kết không hợp lệ" text="Liên kết đặt lại mật khẩu bị thiếu hoặc sai. Hãy yêu cầu liên kết mới."><Link className="btn btn-dark full" to="/forgot-password">Gửi lại liên kết</Link></AuthShell>;
  return <AuthShell title="Đặt mật khẩu mới" text="Mật khẩu mới sẽ áp dụng ngay; các thiết bị khác đang đăng nhập sẽ bị đăng xuất">
    <form onSubmit={submit}>
      <label>Mật khẩu mới<div className="input-icon"><LockKeyhole /><input type="password" required minLength="8" maxLength="72" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div></label>
      <PasswordRules value={form.password} />
      <label>Nhập lại mật khẩu mới<div className="input-icon"><LockKeyhole /><input type="password" required autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} /></div></label>
      {error && <p className="form-error" role="alert">{error}{/hết hạn|không hợp lệ/.test(error) && <> <Link to="/forgot-password">Gửi lại liên kết</Link></>}</p>}
      {done && <p className="form-success" role="status">{done}</p>}
      <button className="btn btn-dark full" disabled={saving || Boolean(done)}>{saving ? "Đang lưu..." : "Đặt lại mật khẩu"}</button>
    </form>
  </AuthShell>;
}
