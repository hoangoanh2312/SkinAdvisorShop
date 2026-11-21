import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/axiosClient", () => ({ default: { get }, apiErrorMessage: (_error, fallback) => fallback }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: { fullName: "Admin", email: "admin@example.com", role: "admin" } }) }));

import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/admin/Dashboard";
import ProductsAdmin from "../pages/admin/ProductsAdmin";

describe("production admin UI", () => {
  it("exposes brand management in the admin sidebar", () => {
    render(<MemoryRouter><AdminLayout /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "Thương hiệu" })).toHaveAttribute("href", "/admin/brands");
  });
  it("renders real dashboard metrics returned by the backend", async () => {
    get.mockResolvedValueOnce({ data: { data: { activeProducts: 12, activeCategories: 10, activeBrands: 4, activeCustomers: 8, totalOrders: 7, pendingOrders: 2, revenue: 1250000, lowStock: [], recentOrders: [] } } });
    render(<MemoryRouter><Dashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/1\.250\.000/)).toBeInTheDocument());
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Thương hiệu active")).toBeInTheDocument();
    expect(screen.queryByText(/Chưa có API/i)).not.toBeInTheDocument();
  });
  it("shows a compact five-column product table with correct SKU price and safe admin links", async () => {
    get.mockResolvedValueOnce({ data: { data: { products: [{ _id: "p1", name: "Serum Test", brand: "Test", category: { name: "Serum" }, images: [], basePrice: 999999, isActive: false, isCatalogVisible: false, totalStock: 0, variantCount: 1, variants: [{ _id: "v1", sku: "SERUM-30", size: "30", unit: "ml", price: 120000, stock: 0, isActive: true }] }], pagination: { page: 1, total: 1, totalPages: 1 } } } });
    render(<MemoryRouter><ProductsAdmin /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText("SERUM-30")).toBeInTheDocument());
    expect(screen.getAllByRole("columnheader")).toHaveLength(5);
    expect(screen.getByText(/120\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/999\.999/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sửa Serum Test" })).toHaveAttribute("href", "/admin/products/p1/edit");
    expect(screen.queryByRole("link", { name: /Xem Serum Test trên cửa hàng/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hiện Serum Test" })).toBeEnabled();
  });
  it("shows an inactive SKU's saved price instead of misleading 'Chưa có giá'", async () => {
    get.mockResolvedValueOnce({ data: { data: { products: [{
      _id: "cocoon-1", name: "Cocoon Dầu tẩy trang hoa hồng", brand: "Cocoon",
      category: { name: "Tẩy trang" }, images: [], basePrice: 1,
      isActive: false, isCatalogVisible: false, totalStock: 0, variantCount: 0,
      variants: [{ sku: "COCOON-310ML", price: 339000, stock: 0, isActive: false }],
    }], pagination: { page: 1, total: 1, totalPages: 1 } } } });
    render(<MemoryRouter><ProductsAdmin /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/339\.000/)).toBeInTheDocument());
    expect(screen.getByText("Giá đã lưu, mã hàng đang tắt")).toBeInTheDocument();
    expect(screen.getByText("0/1 SKU đang bật")).toBeInTheDocument();
    expect(screen.queryByText("Chưa có giá")).not.toBeInTheDocument();
  });
  it("passes status filtering and 10-row pagination to the backend before rendering", async () => {
    get.mockResolvedValue({ data: { data: { products: [], pagination: { page: 1, total: 0, totalPages: 0 } } } });
    render(<MemoryRouter><ProductsAdmin /></MemoryRouter>);
    await waitFor(() => expect(get).toHaveBeenCalledWith("/admin/products", expect.objectContaining({ params: expect.objectContaining({ limit: 10, status: "all" }) })));
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), { target: { value: "preview" } });
    await waitFor(() => expect(get).toHaveBeenCalledWith("/admin/products", expect.objectContaining({ params: expect.objectContaining({ limit: 10, status: "preview", page: 1 }) })));
  });
});
