import { LayoutDashboard, LogOut, Mail, Package } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { requestGoogleCode } from "../utils/googleCodePopup";

export default function Profile() {
  const { user, logout, linkGoogle } = useAuth(); const navigate = useNavigate(); const isAdmin = user.role === "admin";
  const [googleBusy, setGoogleBusy] = useState(false), [googleMessage, setGoogleMessage] = useState("");
  const connectGoogle = async () => { if (googleBusy) return; setGoogleBusy(true); setGoogleMessage(""); try { await linkGoogle(await requestGoogleCode()); setGoogleMessage("Đã liên kết tài khoản Google."); } catch (error) { setGoogleMessage(error.response?.data?.message || "Không thể liên kết Google. Vui lòng thử lại."); } finally { setGoogleBusy(false); } };
  return <div className="container profile-page"><div className="profile-card"><div className="profile-avatar">{user.fullName?.[0] || "S"}</div><h1>{user.fullName}</h1><p><Mail /> {user.email}</p><p>{isAdmin ? "Quản trị viên" : <>{user.phone || "Chưa cập nhật số điện thoại"} · Khách hàng</>}</p>{!isAdmin && user.skinProfile?.skinType && <p>Loại da: {user.skinProfile.skinType}</p>}{googleMessage && <p role="status">{googleMessage}</p>}<div>{isAdmin ? <Link className="btn btn-light" to="/admin"><LayoutDashboard /> Trang quản trị</Link> : <Link className="btn btn-light" to="/orders"><Package /> Đơn hàng của tôi</Link>}{!isAdmin && <button className="btn btn-light" disabled={googleBusy} onClick={connectGoogle}>{googleBusy ? "Đang liên kết..." : "Liên kết Google"}</button>}<button className="btn btn-dark" onClick={() => { logout(); navigate("/"); }}><LogOut /> Đăng xuất</button></div></div></div>;
}
