import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WishlistProvider } from "../contexts/WishlistContext";
import WishlistButton from "../components/product/WishlistButton";
import Wishlist from "../pages/Wishlist";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("../api/axiosClient", () => ({ default: api, apiErrorMessage: (_error, fallback) => fallback }));
let auth;
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => auth }));

const product = { _id: "507f1f77bcf86cd799439011", name: "Serum thật", slug: "serum-that", images: ["https://example.test/image.jpg"], brand: "Brand", catalogPrice: 120000, catalogSalePrice: 110000, inStock: true, isActive: true, displayVariant: { name: "50 ml", sku: "SERUM-50", size: "50", unit: "ml" } };
const wishlistTree = () => <MemoryRouter initialEntries={["/wishlist"]}><WishlistProvider><Wishlist /><WishlistButton productId={product._id} /></WishlistProvider></MemoryRouter>;
const renderWishlist = () => render(wishlistTree());

describe("wishlist interface", () => {
  beforeEach(() => { vi.clearAllMocks(); auth = { user: { _id: "customer-a", role: "customer" }, loading: false }; api.get.mockResolvedValue({ data: { data: { products: [] } } }); api.post.mockResolvedValue({ data: { success: true } }); api.delete.mockResolvedValue({ data: { success: true } }); });
  it("loads account items and uses current SKU pricing", async () => {
    api.get.mockResolvedValue({ data: { data: { products: [product] } } });
    renderWishlist();
    expect(await screen.findByText("Serum thật")).toBeInTheDocument();
    expect(screen.getByText("110.000 ₫")).toBeInTheDocument();
    expect(screen.getByText("Còn hàng")).toBeInTheDocument();
    expect(screen.getByText(/SKU SERUM-50/)).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/wishlist", { sessionProtected: true });
  });
  it("adds then removes via backend with an accessible heart", async () => {
    api.get.mockResolvedValueOnce({ data: { data: { products: [] } } }).mockResolvedValueOnce({ data: { data: { products: [product] } } }).mockResolvedValueOnce({ data: { data: { products: [] } } });
    renderWishlist();
    await screen.findByText("Chưa có sản phẩm yêu thích");
    fireEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm yêu thích" }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(`/wishlist/${product._id}`, {}, { sessionProtected: true }));
    await screen.findByText("Serum thật");
    const buttons = screen.getAllByRole("button", { name: "Bỏ sản phẩm yêu thích" });
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(api.delete).toHaveBeenCalledWith(`/wishlist/${product._id}`, { sessionProtected: true }));
  });
  it("takes signed-out users to login and returns to the original page", async () => {
    auth = { user: null, loading: false };
    render(<MemoryRouter initialEntries={["/products/serum-that"]}><WishlistProvider><Routes><Route path="/products/:id" element={<WishlistButton productId={product._id} />} /><Route path="/login" element={<p>Đăng nhập</p>} /></Routes></WishlistProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Lưu sản phẩm yêu thích" }));
    expect(await screen.findByText("Đăng nhập")).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });
  it("clears the previous account's items when the signed-in account changes", async () => {
    api.get.mockResolvedValueOnce({ data: { data: { products: [product] } } }).mockResolvedValueOnce({ data: { data: { products: [] } } });
    const view = renderWishlist();
    expect(await screen.findByText("Serum thật")).toBeInTheDocument();
    auth = { user: { _id: "customer-b", role: "customer" }, loading: false };
    view.rerender(wishlistTree());
    expect(await screen.findByText("Chưa có sản phẩm yêu thích")).toBeInTheDocument();
    expect(screen.queryByText("Serum thật")).not.toBeInTheDocument();
  });
  it("prevents a double click from sending duplicate add requests", async () => {
    let finish;
    api.post.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    renderWishlist();
    await screen.findByText("Chưa có sản phẩm yêu thích");
    const heart = screen.getByRole("button", { name: "Lưu sản phẩm yêu thích" });
    fireEvent.click(heart);
    fireEvent.click(heart);
    expect(api.post).toHaveBeenCalledTimes(1);
    finish({ data: { success: true } });
    await waitFor(() => expect(heart).not.toBeDisabled());
  });
});
