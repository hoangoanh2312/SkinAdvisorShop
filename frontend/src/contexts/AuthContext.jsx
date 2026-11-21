import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axiosClient from "../api/axiosClient";
import { clearCheckoutAttempt } from "../utils/checkoutAttempt";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("skinora_token"));
  const [loading, setLoading] = useState(Boolean(token));
  const logout = useCallback(() => { clearCheckoutAttempt(); setUser(null); setToken(null); localStorage.removeItem("skinora_user"); localStorage.removeItem("skinora_token"); }, []);
  const saveSession = ({ user: value, token: jwt }) => { clearCheckoutAttempt(); setUser(value); setToken(jwt); localStorage.setItem("skinora_user", JSON.stringify(value)); localStorage.setItem("skinora_token", jwt); return value; };
  useEffect(() => {
    const restore = async () => {
      if (!token) return setLoading(false);
      try { const { data } = await axiosClient.get("/auth/me", { sessionProtected: true }); setUser(data.data.user); localStorage.setItem("skinora_user", JSON.stringify(data.data.user)); }
      catch { logout(); } finally { setLoading(false); }
    };
    restore();
  }, [token, logout]);
  useEffect(() => { window.addEventListener("skinora:session-expired", logout); return () => window.removeEventListener("skinora:session-expired", logout); }, [logout]);
  const login = async ({ email, password }) => saveSession((await axiosClient.post("/auth/login", { email: email.trim(), password })).data.data);
  const register = async ({ fullName, email, password }) => saveSession((await axiosClient.post("/auth/register", { fullName: fullName.trim(), email: email.trim(), password })).data.data);
  const loginWithGoogle = async (code) => saveSession((await axiosClient.post("/auth/google", { code })).data.data);
  // Profile edits keep the session; a password change returns a new token (other devices are signed out).
  const refreshUser = (value) => { setUser(value); localStorage.setItem("skinora_user", JSON.stringify(value)); return value; };
  const updateProfile = async (payload) => refreshUser((await axiosClient.put("/auth/me", payload, { sessionProtected: true })).data.data.user);
  const changePassword = async (payload) => saveSession((await axiosClient.put("/auth/me/password", payload, { sessionProtected: true })).data.data);
  const linkGoogle = async (code) => saveSession((await axiosClient.post("/auth/google/link", { code }, { sessionProtected: true })).data.data);
  const value = useMemo(() => ({ user, token, loading, isAuthenticated: Boolean(user && token), login, register, loginWithGoogle, linkGoogle, logout, updateProfile, changePassword, refreshUser }), [user, token, loading, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
