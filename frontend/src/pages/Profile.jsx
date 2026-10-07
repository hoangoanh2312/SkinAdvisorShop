import { LayoutDashboard, LogOut, Mail, Package } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Profile() {
  const { user, logout } = useAuth(); const navigate = useNavigate(); const isAdmin = user.role === "admin";
  return <div className="container profile-page"><div className="profile-card"><div className="profile-avatar">{user.fullName?.[0] || "S"}</div><h1>{user.fullName}</h1><p><Mail /> {user.email}</p><p>{isAdmin ? "Quản trị viên" : <>{user.phone || "Chưa cập nhật số điện thoại"} · Khách hàng</>}</p>{!isAdmin && user.skinProfile?.skinType && <p>Loại da: {user.skinProfile.skinType}</p>}<div>{isAdmin ? <Link className="btn btn-light" to="/admin"><LayoutDashboard /> Trang quản trị</Link> : <Link className="btn btn-light" to="/orders"><Package /> Đơn hàng của tôi</Link>}<button className="btn btn-dark" onClick={() => { logout(); navigate("/"); }}><LogOut /> Đăng xuất</button></div></div></div>;
}
