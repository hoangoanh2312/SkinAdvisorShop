import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
export function ProtectedRoute() { const { isAuthenticated, loading } = useAuth(); const location = useLocation(); if (loading) return <div className="container empty"><p>Đang kiểm tra phiên đăng nhập...</p></div>; return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location.pathname }} />; }
export function AdminRoute() { const { user, loading } = useAuth(); if (loading) return <div className="container empty"><p>Đang kiểm tra quyền truy cập...</p></div>; return user?.role === "admin" ? <Outlet /> : <Navigate to="/" replace />; }
