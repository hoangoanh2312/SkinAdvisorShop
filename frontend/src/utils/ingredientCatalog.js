export function catalogIngredients(products) {
  const byName = new Map();
  for (const product of products) for (const item of product.ingredients || []) {
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    if (!name) continue;
    const key = (item.normalizedName || name).trim().toLowerCase();
    const current = byName.get(key);
    const description = typeof item.description === "string" ? item.description.trim() : "";
    const benefits = Array.isArray(item.benefits) ? item.benefits.filter(value => typeof value === "string" && value.trim()).map(value => value.trim()) : [];
    const sourceUrl = typeof item.sourceUrl === "string" && /^https:\/\/[^\s]+$/i.test(item.sourceUrl) ? item.sourceUrl : "";
    const detail = sourceUrl ? (description || benefits.join(", ")) : "";
    if (!current || (!current.detail && detail)) byName.set(key, { key, name, detail, sourceUrl, image: typeof item.image === "string" ? item.image : "" });
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "vi"));
}
