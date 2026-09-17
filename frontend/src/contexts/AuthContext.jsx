import { createContext, useContext, useMemo, useState } from "react";
const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("skinora_user"));
    } catch {
      return null;
    }
  });
  const login = ({ email }) => {
    const value = { name: "Khách hàng SKINORA", email };
    setUser(value);
    localStorage.setItem("skinora_user", JSON.stringify(value));
    return value;
  };
  const register = ({ fullName, email }) => {
    const value = { name: fullName, email };
    setUser(value);
    localStorage.setItem("skinora_user", JSON.stringify(value));
    return value;
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("skinora_user");
    localStorage.removeItem("skinora_token");
  };
  return (
    <AuthContext.Provider
      value={useMemo(() => ({ user, login, register, logout }), [user])}
    >
      {children}
    </AuthContext.Provider>
  );
}
