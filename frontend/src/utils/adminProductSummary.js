import { formatCurrency } from "./formatters.js";
import { variantDisplayPrice } from "./productAdapter.js";

/** Prices stored against disabled SKU remain visible to administrators only.
 * A stored price does not mean the SKU is sellable. This function never uses
 * Product.basePrice, which may not have been verified. */
export function summarizeAdminSkuPrice(variants = []) {
  const priced = variants.filter((variant) => Number(variant.price) > 0);
  const missing = variants.length - priced.length;
  if (!priced.length) return {
    main: "Chưa có giá",
    detail: variants.length ? `${missing}/${variants.length} SKU chưa có giá` : "Chưa có SKU",
  };
  const amounts = priced.map(variantDisplayPrice);
  const minimum = Math.min(...amounts);
  const maximum = Math.max(...amounts);
  const active = priced.filter((variant) => variant.isActive !== false).length;
  return {
    main: `${minimum < maximum ? "Từ " : ""}${formatCurrency(minimum)}`,
    detail: missing
      ? `${missing}/${variants.length} SKU chưa có giá`
      : active === 0 ? "Giá đã lưu · SKU đang tắt"
        : active < priced.length ? `${priced.length - active} SKU có giá đang tắt`
          : priced.length > 1 ? `${priced.length} mức giá SKU` : "Giá SKU",
  };
}
