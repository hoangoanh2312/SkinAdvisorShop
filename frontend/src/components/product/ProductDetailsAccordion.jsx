const listOf = items => <ul>{items.map(item => <li key={item}>{item}</li>)}</ul>;

const sectionsFor = product => [
  { title: "Công dụng được công bố", content: product.benefitClaims?.length && product.contentSourceUrl ? <>{listOf(product.benefitClaims)}<a href={product.contentSourceUrl} target="_blank" rel="noopener noreferrer">Xem thông tin từ trang chính hãng</a></> : "Thông tin đang cập nhật" },
  {
    title: "Thành phần nổi bật",
    content: product.ingredients?.length ? <ul>{product.ingredients.map(item => <li key={item.normalizedName || item.name}><strong>{item.name}</strong>{item.description && item.sourceUrl && <span> — {item.description} <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Nguồn</a></span>}</li>)}</ul> : "Thông tin đang cập nhật",
  },
  { title: "Hướng dẫn sử dụng", content: product.usage?.trim() || "Thông tin đang cập nhật" },
  { title: "Lưu ý", content: product.warnings?.length ? listOf(product.warnings) : "Thông tin đang cập nhật" },
  { title: "Vận chuyển", content: product.shippingPolicy?.trim() || null },
  { title: "Chính sách đổi trả", content: product.returnPolicy?.trim() || null },
].filter(section => section.content);

export default function ProductDetailsAccordion({ product }) {
  const sections = sectionsFor(product);
  if (!sections.length) return null;
  return <section className="product-detail-accordion" aria-label="Thông tin sản phẩm">
    <p>Bảng thành phần đầy đủ xem trên bao bì sản phẩm</p>
    {sections.map((section, index) => <details key={section.title} open={index < 3}><summary>{section.title}</summary><div>{section.content}</div></details>)}
  </section>;
}
