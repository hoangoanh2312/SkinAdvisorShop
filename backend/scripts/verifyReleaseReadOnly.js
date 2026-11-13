/* Kiểm tra việc chạy thật KHÔNG ghi dữ liệu vào MongoDB. */
const base = (process.env.SKINORA_API_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
async function read(path) {
  const timer = AbortSignal.timeout(8000);
  const response = await fetch(`${base}${path}`, { signal: timer, headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(`${path}: HTTP ${response.status} ${result.message || ""}`);
  return result.data || result;
}
async function run() {
  console.log("SKINORA READ-ONLY VERIFY (không thay đổi database)");
  const health = await read("/api/health");
  console.log(`PASS API + MongoDB: ${health.database}`);
  const products = await read("/api/products?page=1&limit=12");
  const categories = await read("/api/categories");
  const brands = await read("/api/brands");
  console.log(`PASS Catalog: ${products.pagination?.total ?? "?"} sản phẩm công khai`);
  console.log(`PASS Categories: ${categories.categories?.length ?? "?"} | Brands: ${brands.brands?.length ?? "?"}`);
  if ((products.pagination?.total || 0) === 0) {
    console.error("CHƯA ĐẠT NGHIỆM THU: Catalog công khai còn 0 sản phẩm. Kiểm tra duyệt hiển thị trong Admin.");
    process.exitCode = 2;
  } else {
    console.log("Catalog có sản phẩm. Cần tiếp tục nghiệm thu giỏ, đặt đơn COD và Gemini trên DB kiểm thử riêng.");
  }
}
run().catch(error => { console.error(`CHƯA ĐẠT: ${error.message}`); process.exitCode = 1; });
