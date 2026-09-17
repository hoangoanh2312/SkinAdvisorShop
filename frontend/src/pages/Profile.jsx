import { LogOut, Mail, Package, UserRound } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
export default function Profile() {
  const { user, logout } = useAuth(),
    navigate = useNavigate();
  if (!user)
    return (
      <div className="container empty profile-empty">
        <UserRound />
        <h1>Bạn chưa đăng nhập</h1>
        <Link className="btn btn-dark" to="/login">
          Đăng nhập
        </Link>
      </div>
    );
  return (
    <div className="container profile-page">
      <div className="profile-card">
        <div className="profile-avatar">{user.name[0]}</div>
        <h1>{user.name}</h1>
        <p>
          <Mail /> {user.email}
        </p>
        <div>
          <Link className="btn btn-light" to="/orders">
            <Package /> Đơn hàng của tôi
          </Link>
          <button
            className="btn btn-dark"
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            <LogOut /> Đăng xuất
          </button>
        </div>
      </div>
    </div>
  );
}
