// Three safe reads: curated sellable products, other sellable products, then public catalog.
// A temporary failure in the curated endpoint must not hide an otherwise healthy catalog.
const REQUESTS = [
  { params: { featured: true, sellableOnly: true, limit: 4 }, source: "featured" },
  { params: { sellableOnly: true, limit: 4 }, source: "sellable" },
  { params: { limit: 4 }, source: "catalog" },
];

export async function fetchHomeProducts(get) {
  let lastError;
  for (const request of REQUESTS) {
    try {
      const response = await get("/products", { params: request.params });
      const items = response?.data?.data?.products;
      if (response?.data?.success === false || !Array.isArray(items)) {
        throw new Error("Phản hồi API sản phẩm không hợp lệ");
      }
      if (items.length) return { products: items, source: request.source };
    } catch (error) {
      lastError = error;
    }
  }
  // If an endpoint failed, we cannot confidently call the whole catalog empty.
  if (lastError) throw lastError;
  return { products: [], source: "empty" };
}
