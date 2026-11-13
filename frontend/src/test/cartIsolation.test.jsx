import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { CartProvider, useCart } from "../contexts/CartContext";
import { cartStorageKey, readCart } from "../utils/cartStorage";

const auth = vi.hoisted(() => ({ value: { user: null, loading: false } }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => auth.value }));

const product = { id: "p-1", name: "Serum", brand: "Test", images: [], isActive: true };
const variant = { _id: "v-1", price: 100000, stock: 5, name: "50ml", isActive: true };

function Probe() {
  const { items, addToCart } = useCart();
  return <><output data-testid="quantity">{items[0]?.quantity || 0}</output>
    <button onClick={() => addToCart(product, variant)}>Thêm giỏ</button></>;
}

beforeEach(() => { localStorage.clear(); auth.value = { user: null, loading: false }; });

describe("giỏ hàng tách theo tài khoản", () => {
  it("không dùng lại giỏ cũ không có thông tin chủ sở hữu", () => {
    localStorage.setItem("skinora_cart", JSON.stringify([{ productId: "p-1", variantId: "v-1", quantity: 1, stock: 2, displayPrice: 1 }]));
    expect(readCart(cartStorageKey({ _id: "customer-a" }))).toEqual([]);
  });
  it("không hiển thị giỏ của tài khoản A cho tài khoản B và khách", async () => {
    auth.value = { user: { _id: "customer-a" }, loading: false };
    const app = render(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId("quantity").textContent).toBe("0"));
    act(() => screen.getByText("Thêm giỏ").click());
    await waitFor(() => expect(screen.getByTestId("quantity").textContent).toBe("1"));
    expect(readCart(cartStorageKey({ _id: "customer-a" })).length).toBe(1);
    auth.value = { user: { _id: "customer-b" }, loading: false };
    app.rerender(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId("quantity").textContent).toBe("0"));
    auth.value = { user: null, loading: false };
    app.rerender(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId("quantity").textContent).toBe("0"));
    auth.value = { user: { _id: "customer-a" }, loading: false };
    app.rerender(<CartProvider><Probe /></CartProvider>);
    await waitFor(() => expect(screen.getByTestId("quantity").textContent).toBe("1"));
  });
});
