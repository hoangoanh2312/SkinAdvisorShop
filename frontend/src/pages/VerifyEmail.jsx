import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axiosClient, { apiErrorMessage } from "../api/axiosClient";
import { useAuth } from "../contexts/AuthContext";
import { AuthShell } from "./Login";

export default function VerifyEmail() {
  const [params] = useSearchParams(); const token = params.get("token") || "";
  const { user, refreshUser } = useAuth();
  const [state, setState] = useState({ status: "loading", message: "" });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return; started.current = true; // StrictMode runs effects twice; the token is single-use
    axiosClient.post("/auth/verify-email", { token })
      .then(({ data }) => { setState({ status: "ok", message: data.message }); if (user) refreshUser({ ...user, emailVerified: true }); })
      .catch((error) => setState({ status: "error", message: apiErrorMessage(error, "Liên kết xác minh không hợp lệ hoặc đã hết hạn") }));
  }, [token, user, refreshUser]);
  const title = state.status === "loading" ? "Đang xác minh email..." : state.status === "ok" ? "Email đã được xác minh" : "Chưa xác minh được email";
  return <AuthShell title={title} text={state.message || "Vui lòng chờ trong giây lát"}>
    {state.status !== "loading" && <Link className="btn btn-dark full" to={user ? "/profile" : "/login"}>{user ? "Về trang hồ sơ" : "Đăng nhập"}</Link>}
    {state.status === "error" && <p className="auth-switch">Bạn có thể gửi lại email xác minh trong trang Hồ sơ</p>}
  </AuthShell>;
}
