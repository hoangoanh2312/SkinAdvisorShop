import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

let authState;
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => authState }));
import { AdminRoute, CustomerRoute } from "../components/common/RouteGuards";

const renderRoutes = (path) => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/" element={<div>Store</div>} /><Route path="/login" element={<div>Login</div>} /><Route path="/admin" element={<div>Admin home</div>} /><Route path="/admin/orders" element={<div>Admin orders</div>} /><Route element={<AdminRoute />}><Route path="/admin/secure" element={<div>Admin secure</div>} /></Route><Route element={<CustomerRoute />}><Route path="/orders" element={<div>Customer orders</div>} /></Route></Routes></MemoryRouter>);

describe("role route guards", () => {
  beforeEach(() => { authState = { user: null, loading: false, isAuthenticated: false }; });
  it("allows an authenticated admin into admin routes", () => {
    authState = { user: { role: "admin" }, loading: false, isAuthenticated: true };
    renderRoutes("/admin/secure");
    expect(screen.getByText("Admin secure")).toBeInTheDocument();
  });
  it("blocks a customer from admin routes", () => {
    authState = { user: { role: "customer" }, loading: false, isAuthenticated: true };
    renderRoutes("/admin/secure");
    expect(screen.getByText("Store")).toBeInTheDocument();
  });
  it("redirects an unauthenticated admin-route request to login", () => {
    renderRoutes("/admin/secure");
    expect(screen.getByText("Login")).toBeInTheDocument();
  });
  it("redirects admin personal-order access to admin orders", () => {
    authState = { user: { role: "admin" }, loading: false, isAuthenticated: true };
    renderRoutes("/orders");
    expect(screen.getByText("Admin orders")).toBeInTheDocument();
  });
  it("allows customer personal-order access", () => {
    authState = { user: { role: "customer" }, loading: false, isAuthenticated: true };
    renderRoutes("/orders");
    expect(screen.getByText("Customer orders")).toBeInTheDocument();
  });
  it("renders only a loading state while role is unresolved", () => {
    authState = { user: null, loading: true, isAuthenticated: false };
    renderRoutes("/admin/secure");
    expect(screen.getByText(/Đang kiểm tra quyền truy cập/i)).toBeInTheDocument();
    expect(screen.queryByText("Admin secure")).not.toBeInTheDocument();
  });
});
