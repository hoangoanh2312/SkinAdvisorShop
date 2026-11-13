import EditorialHero from "../components/layout/EditorialHero";
import HomeSections from "./HomeContentVi";
import { useEffect, useState } from "react";
import axiosClient from "../api/axiosClient";
import { normalizeProduct } from "../utils/productAdapter";
import { fetchHomeProducts } from "../utils/homeProductLoader.mjs";
import "../home-featured-fix.css";

const values = [
  ["01", "CẢM HỨNG DA LIỄU"],
  ["02", "THÀNH PHẦN MINH BẠCH"],
  ["03", "AI CÁ NHÂN HÓA"],
  ["04", "SẢN PHẨM CHỌN LỌC"],
];

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productSource, setProductSource] = useState("featured");
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetchHomeProducts((url, options) => axiosClient.get(url, options))
      .then(({ products: items, source }) => {
        if (!active) return;
        setProducts(items.map(normalizeProduct));
        setProductSource(source);
      })
      .catch(() => {
        if (!active) return;
        setProducts([]);
        setError("Không kết nối được danh sách sản phẩm. Kiểm tra backend rồi thử lại.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retryKey]);

  useEffect(() => {
    let active = true;
    axiosClient.get("/brands")
      .then(({ data }) => { if (active) setBrands(Array.isArray(data?.data?.brands) ? data.data.brands : []); })
      .catch(() => { if (active) setBrands([]); });
    return () => { active = false; };
  }, []);

  return (
    <>
      <EditorialHero />
      <section className="hero-transition" aria-label="Giá trị của sandwich">
        <div>
          {values.map(([number, label]) => (
            <span key={label}>
              <small>{number}</small>
              {label}
            </span>
          ))}
        </div>
      </section>
      <HomeSections
        products={products}
        brands={brands}
        loading={loading}
        error={error}
        productSource={productSource}
        onRetry={() => setRetryKey((value) => value + 1)}
      />
    </>
  );
}
