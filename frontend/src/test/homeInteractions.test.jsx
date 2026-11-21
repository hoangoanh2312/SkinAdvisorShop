import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ProductCarousel from "../components/product/ProductCarousel";
import ProductCard from "../components/product/ProductCard";
import ProductDetailsAccordion from "../components/product/ProductDetailsAccordion";
import { catalogIngredients } from "../utils/ingredientCatalog";
import IngredientExplorer from "../components/product/IngredientExplorer";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/axiosClient", () => ({ default: api, apiErrorMessage: (_error, fallback) => fallback }));

const product = { id: "p1", slug: "serum-test", name: "Serum test", brand: "Test", images: ["https://example.test/main.jpg", "https://example.test/other.jpg"], ingredients: [{ name: "Glycerin", normalizedName: "glycerin", description: "Mô tả từ hồ sơ sản phẩm", sourceUrl: "https://example.test/source" }], price: 100000, salePrice: 90000, inStock: true };

describe("home product interactions", () => {
  it("derives ingredient copy only from existing catalog fields", () => {
    const result = catalogIngredients([product, { ...product, ingredients: [{ name: "Unknown" }] }]);
    expect(result.find(item => item.name === "Glycerin").detail).toBe("Mô tả từ hồ sơ sản phẩm");
    expect(result.find(item => item.name === "Unknown").detail).toBe("");
  });
  it("switches the ingredient panel using only API fields", async () => {
    api.get.mockResolvedValueOnce({ data: { data: { products: [{ ...product, ingredients: [{ name: "Glycerin", description: "Mô tả từ hồ sơ sản phẩm", sourceUrl: "https://example.test/source" }, { name: "Panthenol", description: "Thông tin đã nhập", sourceUrl: "https://example.test/panthenol" }] }] } } });
    render(<MemoryRouter><IngredientExplorer /></MemoryRouter>);
    await screen.findByRole("button", { name: "Panthenol" });
    fireEvent.click(screen.getByRole("button", { name: "Panthenol" }));
    expect(screen.getByText("Thông tin đã nhập")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/products", { params: { limit: 100 } });
  });
  it("offers arrows and native scroll track without changing product data", () => {
    render(<MemoryRouter><ProductCarousel products={[product]} /></MemoryRouter>);
    const track = screen.getByLabelText("Sản phẩm nổi bật");
    track.scrollBy = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Sản phẩm tiếp theo" }));
    expect(track.scrollBy).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Serum test")).toBeInTheDocument();
  });
  it("uses only a real secondary product image for hover", () => {
    const { rerender, container } = render(<MemoryRouter><ProductCard product={product} /></MemoryRouter>);
    expect(container.querySelector(".product-image > a:first-child")).toBeInTheDocument();
    expect(container.querySelectorAll(".product-secondary-image")).toHaveLength(1);
    rerender(<MemoryRouter><ProductCard product={{ ...product, images: [product.images[0]] }} /></MemoryRouter>);
    expect(container.querySelectorAll(".product-secondary-image")).toHaveLength(0);
  });
  it("omits unverified shipping and return policies from the accordion", () => {
    render(<ProductDetailsAccordion product={{ ...product, usage: "Dùng theo nhãn sản phẩm" }} />);
    expect(screen.getByText("Thành phần nổi bật")).toBeInTheDocument();
    expect(screen.getByText("Hướng dẫn sử dụng")).toBeInTheDocument();
    expect(screen.queryByText("Vận chuyển")).not.toBeInTheDocument();
    expect(screen.queryByText("Chính sách đổi trả")).not.toBeInTheDocument();
  });
  it("shows a benefit claim only with a supplied HTTPS source", () => {
    const { rerender } = render(<ProductDetailsAccordion product={{ ...product, benefitClaims: ["Cấp ẩm theo công bố"], contentSourceUrl: "" }} />);
    fireEvent.click(screen.getByText("Công dụng được công bố"));
    expect(screen.queryByText("Cấp ẩm theo công bố")).not.toBeInTheDocument();
    rerender(<ProductDetailsAccordion product={{ ...product, benefitClaims: ["Cấp ẩm theo công bố"], contentSourceUrl: "https://example.test/official" }} />);
    expect(screen.getByText("Cấp ẩm theo công bố")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Xem thông tin từ trang chính hãng" })).toHaveAttribute("href", "https://example.test/official");
  });
});
