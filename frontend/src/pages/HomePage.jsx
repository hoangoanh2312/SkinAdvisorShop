import EditorialHero from "../components/layout/EditorialHero";
import HomeSections from "./HomeContentVi";
import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { normalizeProduct } from "../utils/productAdapter";
const values = [
  ["01", "CẢM HỨNG DA LIỄU"],
  ["02", "THÀNH PHẦN MINH BẠCH"],
  ["03", "AI CÁ NHÂN HÓA"],
  ["04", "SẢN PHẨM CHỌN LỌC"],
];
export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { axiosClient.get("/products", { params: { featured: true, limit: 4 } }).then(({ data }) => setProducts(data.data.products.map(normalizeProduct))).catch(() => setError("Không thể tải sản phẩm nổi bật lúc này.")).finally(() => setLoading(false)); }, []);
  return (
    <>
      <EditorialHero />
      <section className="hero-transition" aria-label="Giá trị của SKINORA">
        <div>
          {values.map(([number, label]) => (
            <span key={label}>
              <small>{number}</small>
              {label}
            </span>
          ))}
        </div>
      </section>
      <HomeSections products={products} loading={loading} error={error} />
    </>
  );
}
