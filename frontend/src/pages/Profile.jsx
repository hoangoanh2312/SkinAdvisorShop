import { LayoutDashboard, LockKeyhole, LogOut, Mail, MailCheck, Package, Phone, UserRound } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { requestGoogleCode } from "../utils/googleCodePopup";
import axiosClient, { apiErrorMessage } from "../api/axiosClient";
import PasswordRules from "../components/common/PasswordRules";
import { NAME_MESSAGE, PHONE_MESSAGE, normalizeFullName, normalizeVnPhone, passwordMessage, passwordProblems } from "../utils/inputPolicy";

function EmailBanner({ user }) {
  const [state, setState] = useState({ busy: false, message: "", error: "" });
  // Tài khoản quản trị do hệ thống cấp, không cần bước xác minh email như khách hàng.
  if (user.emailVerified || user.role === "admin") return null;
  const resend = async () => {
    setState({ busy: true, message: "", error: "" });
    try { const { data } = await axiosClient.post("/auth/resend-verification", {}, { sessionProtected: true }); setState({ busy: false, message: data.message, error: "" }); }
    catch (error) { setState({ busy: false, message: "", error: apiErrorMessage(error, "Chưa gửi được email xác minh") }); }
  };
  return <section className="profile-section profile-verify" aria-live="polite"><MailCheck /><div><strong>Email chưa được xác minh</strong><p>Xác minh để bảo vệ tài khoản và lấy lại mật khẩu khi cần</p>{state.message && <p className="form-success">{state.message}</p>}{state.error && <p className="form-error">{state.error}</p>}</div><button type="button" className="btn btn-light" disabled={state.busy} onClick={resend}>{state.busy ? "Đang gửi..." : "Gửi email xác minh"}</button></section>;
}

function ProfileForm({ user, updateProfile }) {
  const [form, setForm] = useState({ fullName: user.fullName || "", phone: user.phone || "" });
  const [state, setState] = useState({ busy: false, message: "", error: "" });
  const submit = async (event) => {
    event.preventDefault();
    if (!normalizeFullName(form.fullName)) return setState({ busy: false, message: "", error: `${NAME_MESSAGE}.` });
    if (form.phone && !normalizeVnPhone(form.phone)) return setState({ busy: false, message: "", error: `${PHONE_MESSAGE}.` });
    setState({ busy: true, message: "", error: "" });
    try { await updateProfile(form); setState({ busy: false, message: "Đã lưu thông tin", error: "" }); }
    catch (error) { setState({ busy: false, message: "", error: apiErrorMessage(error, "Không thể cập nhật hồ sơ") }); }
  };
  return <form className="profile-section" onSubmit={submit}><h2>Thông tin cá nhân</h2>
    <label>Họ và tên<div className="input-icon"><UserRound /><input required maxLength="60" autoComplete="name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div></label>
    <label>Số điện thoại<div className="input-icon"><Phone /><input type="tel" inputMode="numeric" maxLength="10" placeholder="VD: 0912345678" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })} aria-invalid={Boolean(form.phone) && !normalizeVnPhone(form.phone)} /></div>{form.phone && !normalizeVnPhone(form.phone) && <small className="field-error">{PHONE_MESSAGE}</small>}</label>
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.message && <p className="form-success" role="status">{state.message}</p>}
    <button className="btn btn-dark" disabled={state.busy}>{state.busy ? "Đang lưu..." : "Lưu thông tin"}</button>
  </form>;
}

function PasswordForm({ changePassword, hasGoogle }) {
  const empty = { currentPassword: "", newPassword: "", confirm: "" };
  const [form, setForm] = useState(empty);
  const [state, setState] = useState({ busy: false, message: "", error: "" });
  const submit = async (event) => {
    event.preventDefault();
    const problems = passwordProblems(form.newPassword);
    if (problems.length) return setState({ busy: false, message: "", error: `${passwordMessage(problems)}.` });
    if (form.newPassword !== form.confirm) return setState({ busy: false, message: "", error: "Mật khẩu xác nhận chưa khớp" });
    setState({ busy: true, message: "", error: "" });
    try { await changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword }); setForm(empty); setState({ busy: false, message: "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.", error: "" }); }
    catch (error) { setState({ busy: false, message: "", error: apiErrorMessage(error, "Không thể đổi mật khẩu") }); }
  };
  const field = (name, label, auto) => <label>{label}<div className="input-icon"><LockKeyhole /><input type="password" required maxLength="72" autoComplete={auto} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} /></div></label>;
  return <form className="profile-section" onSubmit={submit}><h2>Đổi mật khẩu</h2>
    {hasGoogle && <p className="profile-hint">Nếu bạn tạo tài khoản bằng Google và chưa có mật khẩu, hãy dùng <Link to="/forgot-password">Quên mật khẩu</Link> để tạo mật khẩu</p>}
    {field("currentPassword", "Mật khẩu hiện tại", "current-password")}
    {field("newPassword", "Mật khẩu mới", "new-password")}
    <PasswordRules value={form.newPassword} id="new-password-rules" />
    {field("confirm", "Nhập lại mật khẩu mới", "new-password")}
    {state.error && <p className="form-error" role="alert">{state.error}</p>}{state.message && <p className="form-success" role="status">{state.message}</p>}
    <button className="btn btn-dark" disabled={state.busy}>{state.busy ? "Đang lưu..." : "Đổi mật khẩu"}</button>
  </form>;
}

export default function Profile() {
  const { user, logout, linkGoogle, updateProfile, changePassword } = useAuth(); const navigate = useNavigate(); const isAdmin = user.role === "admin";
  const [googleBusy, setGoogleBusy] = useState(false), [googleMessage, setGoogleMessage] = useState("");
  const connectGoogle = async () => { if (googleBusy) return; setGoogleBusy(true); setGoogleMessage(""); try { await linkGoogle(await requestGoogleCode()); setGoogleMessage("Đã liên kết tài khoản Google"); } catch (error) { setGoogleMessage(error.response?.data?.message || "Không thể liên kết Google. Vui lòng thử lại."); } finally { setGoogleBusy(false); } };
  return <div className="container profile-page"><div className="profile-card"><div className="profile-avatar">{user.fullName?.[0] || "S"}</div><h1>{user.fullName}</h1><p><Mail /> {user.email}</p><p>{isAdmin ? "Quản trị viên" : <>Khách hàng, {user.phone ? `SĐT ${user.phone}` : "chưa cập nhật số điện thoại"}</>}</p>{!isAdmin && user.skinProfile?.skinType && <p>Loại da: {user.skinProfile.skinType}</p>}{googleMessage && <p role="status">{googleMessage}</p>}<div>{isAdmin ? <Link className="btn btn-light" to="/admin"><LayoutDashboard /> Trang quản trị</Link> : <Link className="btn btn-light" to="/orders"><Package /> Đơn hàng của tôi</Link>}{!isAdmin && <button className="btn btn-light" disabled={googleBusy} onClick={connectGoogle}>{googleBusy ? "Đang liên kết..." : "Liên kết Google"}</button>}<button className="btn btn-dark" onClick={() => { logout(); navigate("/"); }}><LogOut /> Đăng xuất</button></div></div><div className="profile-sections"><EmailBanner user={user} /><ProfileForm key={user._id} user={user} updateProfile={updateProfile} /><PasswordForm changePassword={changePassword} hasGoogle={user.hasGoogle} /></div></div>;
}
