import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

let authState;
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => authState }));
vi.mock("../contexts/CartContext", () => ({ useCart: () => ({ count: 2 }) }));

import Header from "../components/layout/Header";
import Profile from "../pages/Profile";
import AdminLayout from "../layouts/AdminLayout";

const admin = { fullName: "SKINORA Admin", email: "admin@example.com", role: "admin", isActive: true };
const customer = { fullName: "Skin Customer", email: "customer@example.com", role: "customer", isActive: true };
const renderAt = (component, path = "/") => render(<MemoryRouter initialEntries={[path]}>{component}</MemoryRouter>);

describe("role-based profile", () => {
  beforeEach(() => { authState = { user: customer, loading: false, isAuthenticated: true, logout: vi.fn() }; });
  it("shows the admin dashboard action and hides personal orders for admin", () => {
    authState = { ...authState, user: admin };
    renderAt(<Profile />, "/profile");
    expect(screen.getByText("Quản trị viên")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trang quản trị/i })).toHaveAttribute("href", "/admin");
    expect(screen.queryByText("Đơn hàng của tôi")).not.toBeInTheDocument();
  });
  it("keeps personal orders and hides administration for customer", () => {
    renderAt(<Profile />, "/profile");
    expect(screen.getByRole("link", { name: /Đơn hàng của tôi/i })).toHaveAttribute("href", "/orders");
    expect(screen.queryByText("Trang quản trị")).not.toBeInTheDocument();
  });
});

describe("role-based header", () => {
  beforeEach(() => { authState = { user: customer, loading: false, isAuthenticated: true, logout: vi.fn() }; });
  it("shows admin navigation without cart or personal shopping actions", () => {
    authState = { ...authState, user: admin };
    renderAt(<Header />);
    expect(screen.getByRole("link", { name: "Trang quản trị" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByLabelText("Giỏ hàng")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Yêu thích")).not.toBeInTheDocument();
  });
  it("keeps customer shopping actions and hides admin navigation", () => {
    renderAt(<Header />);
    expect(screen.getByLabelText("Giỏ hàng")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Trang quản trị" })).not.toBeInTheDocument();
  });
  it("does not flash role-specific actions while authentication is loading", () => {
    authState = { user: null, loading: true, isAuthenticated: false, logout: vi.fn() };
    renderAt(<Header />);
    expect(screen.queryByRole("link", { name: "Trang quản trị" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Giỏ hàng")).not.toBeInTheDocument();
  });
  it("uses the same admin links in the mobile drawer and closes it after navigation", async () => {
    authState = { ...authState, user: admin };
    renderAt(<Header />);
    const toggle = screen.getByRole("button", { name: /Mở menu/i });
    await userEvent.click(toggle);
    const adminLink = screen.getByRole("link", { name: "Trang quản trị" });
    expect(adminLink.closest("nav")).toHaveClass("open");
    fireEvent.click(adminLink);
    expect(adminLink.closest("nav")).not.toHaveClass("open");
  });
});

it("uses the authenticated admin identity and keeps the current sidebar item active", () => {
  authState = { user: admin, loading: false, isAuthenticated: true, logout: vi.fn() };
  renderAt(<AdminLayout />, "/admin/orders");
  expect(screen.getByText("Xin chào, SKINORA Admin")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Đơn hàng" })).toHaveClass("active");
});
