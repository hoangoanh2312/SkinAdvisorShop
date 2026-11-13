import { beforeEach, describe, expect, it } from "vitest";
import { getCheckoutAttemptKey, clearCheckoutAttempt } from "../utils/checkoutAttempt";

const order = { items: [{ variantId: "variant-1", quantity: 1 }], shippingAddress: { fullName: "Customer" }, paymentMethod: "COD" };

beforeEach(() => { clearCheckoutAttempt(); });

describe("checkout idempotency key", () => {
  it("reuses the same attempt ID after a network timeout/retry", () => {
    const first = getCheckoutAttemptKey(order);
    expect(first).toMatch(/^skn_/);
    expect(getCheckoutAttemptKey(order)).toBe(first);
  });
  it("starts a new attempt after cart or payment changes", () => {
    const original = getCheckoutAttemptKey(order);
    expect(getCheckoutAttemptKey({ ...order, paymentMethod: "VNPAY" })).not.toBe(original);
  });
  it("clears the completed attempt", () => {
    const previous = getCheckoutAttemptKey(order);
    clearCheckoutAttempt();
    expect(getCheckoutAttemptKey(order)).not.toBe(previous);
  });
});
