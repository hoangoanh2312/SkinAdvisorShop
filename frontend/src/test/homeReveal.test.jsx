import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "../pages/HomePage";

const observed = [];
vi.mock("../components/layout/EditorialHero", () => ({ default: () => <section data-reveal>Hero</section> }));
vi.mock("../pages/HomeContentVi", () => ({ default: ({ products }) => products.length ? <section data-reveal data-testid="late-section">Loaded after API</section> : null }));
vi.mock("../utils/homeProductLoader.mjs", () => ({ fetchHomeProducts: async () => ({ products: [{ _id: "p1", name: "Product" }], source: "featured" }) }));
vi.mock("../api/axiosClient", () => ({ default: { get: async () => ({ data: { data: { brands: [] } } }) }, apiErrorMessage: (_error, fallback) => fallback }));

describe("home reveal", () => {
  afterEach(() => { vi.unstubAllGlobals(); observed.length = 0; });
  it("observes sections inserted after the product request completes", async () => {
    vi.stubGlobal("IntersectionObserver", class { observe(element) { observed.push(element); } unobserve() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(<HomePage />);
    const late = await screen.findByTestId("late-section");
    await waitFor(() => expect(observed).toContain(late));
  });
});
