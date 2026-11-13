import { Edit3, Eye, EyeOff, ExternalLink, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import AdminPager from "../../components/admin/AdminPager";
import { normalizeProduct } from "../../utils/productAdapter";
import { summarizeAdminSkuPrice } from "../../utils/adminProductSummary";

const actionError = (error) => error.response?.data?.message || "Thao tác thất bại. Vui lòng thử lại.";

const getBusinessStatus = (product) => {
  if (!product.isActive) return product.isCatalogVisible ? "Sắp mở bán" : "Nháp · đang ẩn";
  const available = product.variants.some((v) => v.isActive !== false && Number(v.stock) > 0 && Number(v.price) > 0);
  return available ? "Đang bán" : "Hết hàng";
};

const getBusinessStatusClass = (product) => {
  if (!product.isActive) return product.isCatalogVisible ? "preview" : "draft";
  return product.variants.some((v) => v.isActive !== false && Number(v.stock) > 0 && Number(v.price) > 0) ? "selling" : "out-of-stock";
};


const statuses = [
  { value: "all", label: "Mọi trạng thái" },
  { value: "draft", label: "Nháp · đang ẩn" },
  { value: "preview", label: "Sắp mở bán" },
  { value: "selling", label: "Đang bán" },
  { value: "out-of-stock", label: "Hết hàng" },
];

export default function ProductsAdmin() {
  const [products, setProducts] = useState([]), [pagination, setPagination] = useState(null);
  const [query, setQuery] = useState(""), [imageStatus, setImageStatus] = useState("all"), [status, setStatus] = useState("all"), [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [busyId, setBusyId] = useState(""), [notice, setNotice] = useState("");
  const latestRequest = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++latestRequest.current;
    setLoading(true);
    try {
      const { data } = await axiosClient.get("/admin/products", {
        params: { includeInactive: true, search: query, imageStatus, status, page, limit: 10 },
        sessionProtected: true,
      });
      if (requestId !== latestRequest.current) return;
      setProducts(data.data.products.map((item) => ({
        ...normalizeProduct(item),
        totalStock: item.totalStock,
        variantCount: item.variantCount,
        isActive: item.isActive,
        isCatalogVisible: item.isCatalogVisible === true,
      })));
      setPagination(data.data.pagination);
      setError("");
    } catch (requestError) {
      if (requestId === latestRequest.current) setError(actionError(requestError));
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  }, [query, imageStatus, status, page]);

  useEffect(() => { const timer = setTimeout(load, 250); return () => { clearTimeout(timer); latestRequest.current++; }; }, [load]);

  const changeVisibility = async (product) => {
    const visible = !product.isCatalogVisible;
    if (!visible && product.isActive) {
      setError("Hãy tắt bán trong trang chỉnh sửa trước khi ẩn sản phẩm.");
      return;
    }
    if (!window.confirm(`${visible ? "Hiển thị" : "Ẩn"} sản phẩm “${product.name}” trên cửa hàng? Thao tác này không sửa tồn kho hoặc giá.`)) return;
    setBusyId(product.id); setError(""); setNotice("");
    try {
      await axiosClient.patch(`/admin/products/${product.id}/catalog-visibility`, { visible }, { sessionProtected: true });
      setNotice(`Đã ${visible ? "hiển thị" : "ẩn"} sản phẩm “${product.name}”.`);
      await load();
    } catch (requestError) { setError(actionError(requestError)); }
    finally { setBusyId(""); }
  };

  const showEligible = async () => {
    setBusyId("bulk"); setError(""); setNotice("");
    try {
      const { data } = await axiosClient.get("/admin/products/catalog-visibility/preview", { sessionProtected: true });
      const { eligible, skipped } = data.data;
      if (!eligible) {
        setNotice(`Chưa có sản phẩm nháp đủ điều kiện để hiển thị (${skipped} sản phẩm cần bổ sung thông tin/ảnh/SKU có giá).`);
        return;
      }
      if (!window.confirm(`Có ${eligible} sản phẩm đủ thông tin (có SKU đã lưu giá, không nhất thiết đang bật) và ${skipped} sản phẩm chưa đủ điều kiện.\n\nHiển thị ${eligible} sản phẩm trên Catalog ở trạng thái “Sắp mở bán”? Không cập nhật giá, không tạo tồn kho giả và không cho khách đặt hàng.`)) return;
      const result = await axiosClient.patch("/admin/products/catalog-visibility/bulk", {
        action: "show-eligible", confirm: "SHOW_ELIGIBLE_CATALOG",
      }, { sessionProtected: true });
      setNotice(`Đã hiển thị ${result.data.data.updated} sản phẩm; ${result.data.data.skipped} sản phẩm cần bổ sung thông tin.`);
      await load();
    } catch (requestError) { setError(actionError(requestError)); }
    finally { setBusyId(""); }
  };

  return <section className="admin-table-card admin-products-page">
    <div className="table-title">
      <div><h3>Quản lý sản phẩm</h3><p>{pagination?.total ?? 0} sản phẩm phù hợp</p></div>
      <div className="admin-catalog-actions">
        <button type="button" className="btn btn-light btn-small" disabled={!!busyId || loading} onClick={showEligible}>
          <Eye size={16} /> {busyId === "bulk" ? "Đang cập nhật..." : "Hiển thị sản phẩm hợp lệ"}
        </button>
        <Link className="btn btn-dark btn-small" to="/admin/products/new">Thêm sản phẩm</Link>
      </div>
    </div>
    <p className="admin-products-help"><strong>Lưu ý:</strong> Hiển thị chỉ để khách xem. Muốn nhận đơn hàng, cần xác minh giá, nhập tồn kho thực tế và bật bán trong trang Sửa.</p>
    <div className="admin-products-toolbar">
      <label className="admin-search"><Search size={17} /><input aria-label="Tìm sản phẩm" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Tìm tên, slug hoặc thương hiệu" /></label>
      <label className="admin-image-filter">Trạng thái
        <select aria-label="Lọc theo trạng thái" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          {statuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <label className="admin-image-filter">Ảnh sản phẩm
        <select aria-label="Lọc theo hình ảnh" value={imageStatus} onChange={(event) => { setImageStatus(event.target.value); setPage(1); }}>
          <option value="all">Tất cả hình ảnh</option>
          <option value="missing">Chưa có ảnh</option>
          <option value="present">Đã có ảnh</option>
        </select>
      </label>
    </div>
    {error && <div className="admin-state error" role="alert">{error} <button type="button" onClick={load}>Tải lại</button></div>}
    {notice && <div className="admin-state" role="status">{notice}</div>}
    {loading ? <div className="admin-state">Đang tải...</div> : products.length ? <div className="admin-product-table-viewport"><table className="admin-products-table admin-compact-table">
      <thead><tr><th>Sản phẩm</th><th>Giá bán</th><th>Tồn kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
      <tbody>{products.map((product) => {
        const summary = summarizeAdminSkuPrice(product.variants);
        const canView = product.isCatalogVisible || product.isActive;
        const primary = product.variants[0];
        return <tr key={product.id}>
          <td data-label="Sản phẩm"><div className="admin-compact-product">
            {product.images[0] ? <img src={product.images[0]} alt="" loading="lazy" /> : <span className="admin-compact-no-image">Chưa có ảnh</span>}
            <div className="admin-compact-product-info">
              <Link to={`/admin/products/${product.id}/edit`} title={product.name} className="admin-compact-name">{product.name}</Link>
              <small>{[product.brand, product.categoryName].filter(Boolean).join(" · ")}</small>
              <small title={primary?.sku || ""}>{primary?.sku ? `${primary.sku.length > 24 ? `${primary.sku.slice(0, 24)}…` : primary.sku}${product.variants.length > 1 ? ` (+${product.variants.length - 1} SKU)` : ""}` : "Chưa có SKU"}</small>
            </div>
          </div></td>
          <td data-label="Giá bán"><div className="admin-compact-price"><strong>{summary.main}</strong><small>{summary.detail}</small></div></td>
          <td data-label="Tồn kho"><div className="admin-compact-stock"><strong>{product.totalStock ?? 0}</strong><small>{product.variantCount ?? product.variants.filter((variant) => variant.isActive !== false).length}/{product.variants.length} SKU đang bật</small></div></td>
          <td data-label="Trạng thái"><span className={`admin-product-status ${getBusinessStatusClass(product)}`}>{getBusinessStatus(product)}</span></td>
          <td data-label="Thao tác"><div className="admin-compact-actions">
            <Link className="admin-icon-action" to={`/admin/products/${product.id}/edit`} title={`Sửa ${product.name}`} aria-label={`Sửa ${product.name}`}><Edit3 size={15}/><span>Sửa</span></Link>
            {canView && <Link className="admin-icon-action" to={`/products/${product.id}`} target="_blank" rel="noopener noreferrer" title={`Xem ${product.name} trên cửa hàng`} aria-label={`Xem ${product.name} trên cửa hàng`}><ExternalLink size={15}/><span>Xem</span></Link>}
            <button type="button" className="admin-icon-action" disabled={!!busyId || (product.isActive && !product.isCatalogVisible)} onClick={() => changeVisibility(product)} aria-label={`${product.isCatalogVisible || product.isActive ? "Ẩn" : "Hiện"} ${product.name}`} title={product.isActive ? "Tắt bán trong trang Sửa trước khi ẩn" : "Không thay đổi tồn kho hoặc giá"}>
              {product.isCatalogVisible || product.isActive ? <EyeOff size={15}/> : <Eye size={15}/>}
              <span>{busyId === product.id ? "Đang lưu" : product.isCatalogVisible || product.isActive ? "Ẩn" : "Hiện"}</span>
            </button>
          </div></td>
        </tr>;
      })}</tbody>
    </table></div> : <div className="empty">Không có sản phẩm phù hợp bộ lọc. Hãy thử từ khóa hoặc trạng thái khác.</div>}
    <AdminPager pagination={pagination} onPage={setPage}/>
  </section>;
}
