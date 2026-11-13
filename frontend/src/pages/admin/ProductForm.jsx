import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import ProductImageManager from "../../components/admin/ProductImageManager";
import ConfirmActionModal from "../../components/admin/ConfirmActionModal";

const empty = { name: "", slug: "", brand: "", brandRef: "", category: "", description: "", basePrice: 0, salePrice: "", skinTypes: [], skinConcerns: [], ingredientsText: "", isActive: false };
const skinTypes = ["normal", "dry", "oily", "combination", "sensitive"];
const concerns = ["acne", "dryness", "sensitivity", "aging", "pigmentation", "pores", "dullness", "oiliness"];
const skinTypeLabels = { normal: "Da thường", dry: "Da khô", oily: "Da dầu", combination: "Da hỗn hợp", sensitive: "Da nhạy cảm" };
const concernLabels = { acne: "Mụn", dryness: "Khô da", sensitivity: "Dễ kích ứng", aging: "Lão hóa", pigmentation: "Thâm sạm", pores: "Lỗ chân lông", dullness: "Xỉn màu", oiliness: "Tiết dầu" };
const variantCompare = item => JSON.stringify({
  name: item.name?.trim() || "", sku: item.sku?.trim() || "", size: String(item.size ?? ""), unit: item.unit?.trim() || "",
  price: Number(item.price), salePrice: item.salePrice === "" || item.salePrice == null ? null : Number(item.salePrice),
  stock: Number(item.stock), isActive: item.isActive !== false,
});
const newVariant = basePrice => ({ name: "", sku: "", size: "", unit: "ml", price: basePrice || 0, salePrice: "", stock: 0, isActive: true, stockChangeNote: "" });
const apiError = (error, fallback) => error.response?.data?.message || fallback;
const variantPayload = item => ({ ...item, price: Number(item.price), salePrice: item.salePrice === "" || item.salePrice == null ? null : Number(item.salePrice), stock: Number(item.stock) });
const variantError = item => {
  if (!item.name?.trim() || !item.sku?.trim()) return "Tên phiên bản và SKU là bắt buộc.";
  const price = Number(item.price), stock = Number(item.stock);
  if (item.price === "" || !Number.isFinite(price) || price < 0) return "Giá phiên bản phải là số không âm.";
  if (item.stock === "" || !Number.isInteger(stock) || stock < 0) return "Tồn kho phải là số nguyên không âm.";
  if (Number(stock) > 0 && !item._id && (item.stockChangeNote || "").trim().length < 6) return "Cần nhập lý do tồn kho ban đầu tối thiểu 6 ký tự.";
  if (item.salePrice !== "" && item.salePrice != null && (!Number.isFinite(Number(item.salePrice)) || Number(item.salePrice) < 0 || Number(item.salePrice) > price)) return "Giá giảm của phiên bản phải từ 0 đến giá gốc.";
  return "";
};

function VariantFields({ item, onChange, prefix }) {
  return <div className="variant-fields">
    <label>Tên phiên bản<input aria-label={`${prefix} tên phiên bản`} value={item.name} onChange={event => onChange("name", event.target.value)} /></label>
    <label>SKU<input aria-label={`${prefix} SKU`} value={item.sku} onChange={event => onChange("sku", event.target.value)} /></label>
    <label>Dung tích/quy cách<input aria-label={`${prefix} dung tích`} value={item.size || ""} onChange={event => onChange("size", event.target.value)} /></label>
    <label>Đơn vị<input aria-label={`${prefix} đơn vị`} value={item.unit || ""} onChange={event => onChange("unit", event.target.value)} /></label>
    <label>Giá<input aria-label={`${prefix} giá`} type="number" min="0" value={item.price} onChange={event => onChange("price", event.target.value)} /></label>
    <label>Giá giảm<input aria-label={`${prefix} giá giảm`} type="number" min="0" value={item.salePrice ?? ""} onChange={event => onChange("salePrice", event.target.value)} /></label>
    <label>Tồn kho<input aria-label={`${prefix} tồn kho`} type="number" min="0" step="1" value={item.stock} onChange={event => onChange("stock", event.target.value)} /></label>
    <label>Lý do điều chỉnh kho (bắt buộc khi thay đổi số lượng)<input aria-label={`${prefix} lý do tồn kho`} maxLength="500" value={item.stockChangeNote || ""} onChange={event => onChange("stockChangeNote", event.target.value)} placeholder="Nhập kho, phiếu kiểm kê, lỗi hỏng..." /></label>
    <label className="check-inline"><input type="checkbox" checked={item.isActive !== false} onChange={event => onChange("isActive", event.target.checked)} />Phiên bản đang hoạt động</label>

  </div>;
}

export default function ProductForm() {
  const { id } = useParams(), navigate = useNavigate();
  const [form, setForm] = useState(empty), [originallyActive, setOriginallyActive] = useState(false), [categories, setCategories] = useState([]), [brands, setBrands] = useState([]);
  const [savedForm, setSavedForm] = useState(empty);
  const [variants, setVariants] = useState([]), [savedVariants, setSavedVariants] = useState([]), [draft, setDraft] = useState(newVariant(0)), [draftBaseline, setDraftBaseline] = useState(newVariant(0));
  const [error, setError] = useState(""), [saving, setSaving] = useState(false), [variantBusy, setVariantBusy] = useState(false);
  const [confirmingSave, setConfirmingSave] = useState(false);
  const [imageBusy, setImageBusy] = useState(false), [imageCount, setImageCount] = useState(0), [createdProduct, setCreatedProduct] = useState(null);
  const submittingRef = useRef(false), variantSubmittingRef = useRef(false), imageManagerRef = useRef(null);
  const originalBrandRef = useRef("");
  const dirtyVariants = variants.filter(item => savedVariants.some(saved => saved._id === item._id && variantCompare(saved) !== variantCompare(item)));
  const draftStarted = variantCompare(draft) !== variantCompare(draftBaseline);
  const hasUnsavedChanges = JSON.stringify(form) !== JSON.stringify(savedForm) || dirtyVariants.length > 0 || draftStarted;
  useEffect(() => {
    if (!hasUnsavedChanges || saving) return undefined;
    const onBeforeUnload = event => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges, saving]);
  const readyToSell = imageCount > 0 && variants.some(item => item.isActive !== false && Number(item.stock) > 0 && Number(item.price) > 0);

  useEffect(() => {
    axiosClient.get("/categories").then(({ data }) => setCategories(data.data.categories)).catch(requestError => setError(apiError(requestError, "Không thể tải danh mục.")));
    axiosClient.get("/admin/brands", { params: { includeInactive: false, limit: 100 }, sessionProtected: true }).then(({ data }) => setBrands(data.data.brands || [])).catch(() => setError("Không thể tải danh sách thương hiệu. Vui lòng thử tải lại trang."));
    if (!id) return;
    axiosClient.get(`/admin/products/${id}`, { sessionProtected: true }).then(({ data }) => {
      const product = data.data.product;
      setOriginallyActive(product.isActive !== false);
      originalBrandRef.current = product.brand || "";
      setVariants(data.data.variants || []);
      setSavedVariants(data.data.variants || []);
      const loadedForm = { ...empty, name: product.name, slug: product.slug, brand: product.brand, brandRef: product.brandRef?._id || product.brandRef || "", category: product.category?._id || "", description: product.description || "", basePrice: product.basePrice, salePrice: product.salePrice ?? "", skinTypes: product.skinTypes || [], skinConcerns: product.skinConcerns || [], ingredientsText: (product.ingredients || []).map(item => item.name).join("\n"), isActive: product.isActive !== false };
      setForm(loadedForm);
      setSavedForm(loadedForm);
      setDraft(newVariant(product.basePrice));
      setDraftBaseline(newVariant(product.basePrice));
    }).catch(() => axiosClient.get(`/products/${id}`).then(({ data }) => {
      const product = data.data.product;
      const fallbackFields = { name: product.name, slug: product.slug, brand: product.brand, category: product.category?._id || "", description: product.description || "", basePrice: product.basePrice, salePrice: product.salePrice ?? "" };
      originalBrandRef.current = product.brand || "";
      setForm(current => ({ ...current, ...fallbackFields }));
      setSavedForm(current => ({ ...current, ...fallbackFields }));
    }).catch(requestError => setError(apiError(requestError, "Không thể tải sản phẩm."))));
  }, [id]);

  const change = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const toggle = (field, value) => setForm(current => ({ ...current, [field]: current[field].includes(value) ? current[field].filter(item => item !== value) : [...current[field], value] }));
  const uploadCreatedImages = async product => {
    if (!imageManagerRef.current?.hasPending()) return true;
    try { await imageManagerRef.current.uploadPending(product._id, product.__v ?? 0); return true; }
    catch { setError("Sản phẩm đã được tạo nhưng một số ảnh tải lên thất bại"); return false; }
  };
  const submit = async event => {
    event.preventDefault();
    if (submittingRef.current || saving || imageBusy || variantBusy || confirmingSave) return;
    setError("");
    if (form.salePrice !== "" && (Number(form.salePrice) < 0 || Number(form.salePrice) > Number(form.basePrice))) {
      setError("Giá khuyến mãi phải từ 0 đến giá cơ bản.");
      return;
    }
    if (!id && !createdProduct && !form.brandRef) {
      setError("Vui lòng chọn một thương hiệu có sẵn trong mục Thương hiệu.");
      return;
    }
    if (id && form.brand !== originalBrandRef.current && !form.brandRef) {
      setError("Hãy chọn thương hiệu hợp lệ trong danh sách trước khi lưu.");
      return;
    }
    if (id && draftStarted) {
      setError("Bạn đang nhập phiên bản mới nhưng chưa bấm “Thêm phiên bản”. Hãy thêm phiên bản hoặc xóa thông tin nháp trước khi lưu sản phẩm.");
      return;
    }
    if (id && dirtyVariants.length) {
      for (const item of dirtyVariants) {
        const validation = variantError(item);
        if (validation) { setError(`SKU ${item.sku || item.name}: ${validation}`); return; }
        const original = savedVariants.find(value => value._id === item._id);
        if (original && Number(original.stock) !== Number(item.stock) && (item.stockChangeNote || "").trim().length < 6) { setError(`SKU ${item.sku}: cần nhập lý do điều chỉnh kho tối thiểu 6 ký tự.`); return; }
      }
    }
    if (id && form.isActive && !originallyActive && !readyToSell) {
      setError("Chưa thể bật bán: cần ít nhất 1 ảnh đã lưu và 1 phiên bản có giá, active, còn hàng.");
      return;
    }
    // Sau khi tạo thành công, chỉ thử tải lại ảnh; tuyệt đối không POST tạo sản phẩm lần nữa.
    if (createdProduct) { await persistProduct(); return; }
    setConfirmingSave(true);
  };
  const persistProduct = async () => {
    // Ref ngăn bấm liên tiếp trước cả khi React kịp render disabled.
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);
    setError("");
    try {
      if (createdProduct) {
        if (await uploadCreatedImages(createdProduct)) {
          // Sau khi ảnh đã tải xong, không giữ chế độ "Thử tải ảnh lại" ở trang sửa.
          setCreatedProduct(null);
          navigate(`/admin/products/${createdProduct._id}/edit`);
        }
        return;
      }
      const payload = { ...form, isActive: id ? form.isActive : false, basePrice: Number(form.basePrice), salePrice: form.salePrice === "" ? null : Number(form.salePrice), ingredients: form.ingredientsText.split("\n").map(name => name.trim()).filter(Boolean).map(name => ({ name, normalizedName: name.toLowerCase() })) };
      delete payload.ingredientsText;
      if (!payload.brandRef) delete payload.brandRef;
      if (id) {
        // Lưu SKU chỉnh sửa trước: backend cần tồn kho đã lưu khi kích hoạt sản phẩm.
        // Nếu API lỗi, giữ nguyên trang và các SKU chưa được lưu để quản trị thử lại.
        for (const item of dirtyVariants) {
          let saved;
          try {
            const { data } = await axiosClient.put(`/variants/${item._id}`, variantPayload(item), { sessionProtected: true });
            saved = data.data.variant;
          } catch (variantRequestError) {
            throw new Error(`Chưa lưu được SKU ${item.sku || item.name}. Những SKU lưu thành công trước đó vẫn được giữ. ${apiError(variantRequestError, "Kiểm tra kết nối và thử lại.")}`);
          }
          setSavedVariants(current => current.map(value => value._id === item._id ? saved : value));
          setVariants(current => current.map(value => value._id === item._id ? saved : value));
        }
        await axiosClient.put(`/products/${id}`, payload, { sessionProtected: true });
        setConfirmingSave(false);
        navigate("/admin/products");
        return;
      }
      const { data } = await axiosClient.post("/products", payload, { sessionProtected: true });
      const product = data.data.product;
      setCreatedProduct(product);
      const uploaded = await uploadCreatedImages(product);
      setConfirmingSave(false);
      if (uploaded) {
        // Cùng một ProductForm được React Router tái sử dụng khi chuyển từ /new sang /:id/edit.
        // Xóa cờ retry để nút ở trang sửa hiện "Lưu sản phẩm", không phải "Thử tải ảnh lại".
        setCreatedProduct(null);
        navigate(`/admin/products/${product._id}/edit`);
      }
    } catch (requestError) {
      // Mạng có thể ngắt sau khi server đã tạo xong sản phẩm.
      // Không tự POST lại; yêu cầu quản trị kiểm tra danh sách trước để tránh tạo trùng.
      const uncertain = !id && !createdProduct && !requestError.response;
      setError(uncertain
        ? "Không xác định được sản phẩm đã tạo hay chưa. Hãy kiểm tra danh sách sản phẩm hoặc tìm theo slug trước khi thử tạo lại."
        : (requestError.message && !requestError.response ? requestError.message : apiError(requestError, "Không thể lưu sản phẩm.")));
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };
  const addVariant = async () => {
    if (variantSubmittingRef.current) return;
    variantSubmittingRef.current = true;
    const validation = variantError(draft);
    if (validation) { variantSubmittingRef.current = false; setError(validation); return; }
    setVariantBusy(true); setError("");
    try {
      const { data } = await axiosClient.post(`/products/${id}/variants`, variantPayload(draft), { sessionProtected: true });
      setVariants(current => [...current, data.data.variant]);
      setSavedVariants(current => [...current, data.data.variant]);
      setDraft(newVariant(form.basePrice));
      setDraftBaseline(newVariant(form.basePrice));
    } catch (requestError) { setError(apiError(requestError, "Không thể tạo phiên bản.")); }
    finally { variantSubmittingRef.current = false; setVariantBusy(false); }
  };
  const saveVariant = async item => {
    if (variantBusy) return;
    const validation = variantError(item);
    if (validation) { setError(validation); return; }
    const original = savedVariants.find(value => value._id === item._id);
    if (original && Number(original.stock) !== Number(item.stock) && (item.stockChangeNote || "").trim().length < 6) { setError("Nhập lý do thay đổi tồn kho (tối thiểu 6 ký tự)."); return; }
    setVariantBusy(true); setError("");
    try {
      const { data } = await axiosClient.put(`/variants/${item._id}`, variantPayload(item), { sessionProtected: true });
      setVariants(current => current.map(value => value._id === item._id ? data.data.variant : value));
      setSavedVariants(current => current.map(value => value._id === item._id ? data.data.variant : value));
    } catch (requestError) { setError(apiError(requestError, "Không thể lưu phiên bản.")); }
    finally { setVariantBusy(false); }
  };
  const updateVariant = (index, field, value) => setVariants(current => current.map((item, position) => position === index ? { ...item, [field]: value } : item));

  return <div className="admin-form-page"><form id="skinora-product-editor" className="admin-product-main" onSubmit={submit}>
    <Link to="/admin/products" className="text-link" onClick={event => { if (hasUnsavedChanges && !window.confirm("Có thay đổi chưa lưu. Bạn muốn rời trang và bỏ các thay đổi này?")) event.preventDefault(); }}><ArrowLeft /> Quay lại</Link>
    <div className="table-title"><div><h3>{id ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h3><p>{id ? "Kiểm tra ảnh, phiên bản và tồn kho trước khi bật bán." : "Sản phẩm mới được tạo ở trạng thái chưa bán; thêm ảnh, SKU và tồn kho rồi kích hoạt."}</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="admin-form-grid"><section className="form-card">
      <label>Tên sản phẩm<input required name="name" value={form.name} onChange={change} /></label>
      <label>Slug<input required name="slug" value={form.slug} onChange={change} /></label>
      <div className="form-grid"><label>Thương hiệu<input required name="brand" list="brand-options" value={form.brand} onChange={event => { const match = brands.find(item => item.name === event.target.value); setForm({ ...form, brand: event.target.value, brandRef: match?._id || "" }); }} /><datalist id="brand-options">{brands.map(item => <option key={item._id} value={item.name} />)}</datalist></label><label>Danh mục<select required name="category" value={form.category} onChange={change}><option value="">Chọn danh mục</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label></div>
      <label>Mô tả<textarea rows="6" name="description" value={form.description} onChange={change} /></label>
      <label>Thành phần (mỗi dòng)<textarea rows="5" name="ingredientsText" value={form.ingredientsText} onChange={change} /></label>
      <fieldset><legend>Loại da phù hợp</legend>{skinTypes.map(value => <label className="check-inline" key={value}><input type="checkbox" checked={form.skinTypes.includes(value)} onChange={() => toggle("skinTypes", value)} />{skinTypeLabels[value]}</label>)}</fieldset>
      <fieldset><legend>Vấn đề da phù hợp</legend>{concerns.map(value => <label className="check-inline" key={value}><input type="checkbox" checked={form.skinConcerns.includes(value)} onChange={() => toggle("skinConcerns", value)} />{concernLabels[value]}</label>)}</fieldset>
    </section><aside className="form-card">
      <label>Giá cơ bản<input required min="0" type="number" name="basePrice" value={form.basePrice} onChange={change} /></label>
      <label>Giá khuyến mãi<input min="0" type="number" name="salePrice" value={form.salePrice} onChange={change} /></label>
      <label className="check-inline"><input type="checkbox" checked={form.isActive} disabled={!id || saving || (!form.isActive && !readyToSell)} onChange={event => setForm(current => ({ ...current, isActive: event.target.checked }))} />Đang bán (chỉ bật khi có hàng và giá thực tế)</label>
      <p className="admin-form-hint">{!id
        ? "Sản phẩm mới luôn được tạo ở trạng thái nháp. Hãy thêm SKU, tồn kho và ảnh rồi kích hoạt ở trang chỉnh sửa."
        : !readyToSell ? "Chưa thể kích hoạt: cần ảnh đã tải lên và ít nhất một phiên bản có giá, đang hoạt động, còn hàng." : "Đã có ảnh và phiên bản còn hàng. Hãy kiểm tra thông tin trước khi mở bán."}</p>
      <p>{id ? "Ảnh mới được tự động tải lên khi chọn." : "Chọn ảnh bên dưới; hệ thống sẽ tự tải lên sau khi tạo sản phẩm."}</p>
    </aside></div>
    <ProductImageManager ref={imageManagerRef} productId={id} onBusyChange={setImageBusy} onImageCountChange={setImageCount} />
  </form>
    {id && <section className="form-card variant-admin"><div className="table-title"><h3>Phiên bản, SKU và tồn kho</h3></div>
      <p className="admin-form-hint">SKU mới cần bấm “Thêm phiên bản”. Mọi lần thay đổi tồn kho phải có lý do và sẽ ghi lịch sử giao dịch kho. Có thể nhập/xuất nhanh tại mục Kho hàng.</p>
      <div className="admin-editor"><strong>Thêm phiên bản</strong><VariantFields item={draft} prefix="Mới" onChange={(field, value) => setDraft(current => ({ ...current, [field]: value }))} /><button type="button" className="btn btn-dark btn-small" disabled={variantBusy} onClick={addVariant}>{variantBusy ? "Đang lưu..." : "Thêm phiên bản"}</button></div>
      {variants.map((item, index) => <div className="admin-editor" key={item._id}><strong>{item.name || item.sku}{dirtyVariants.some(value => value._id === item._id) && <span className="admin-variant-unsaved"> · Chưa lưu</span>}</strong><VariantFields item={item} prefix={item.sku} onChange={(field, value) => updateVariant(index, field, value)} /><button type="button" className="btn btn-light btn-small" disabled={variantBusy} onClick={() => saveVariant(item)}>{variantBusy ? "Đang lưu..." : "Lưu phiên bản"}</button></div>)}
    </section>}
    <div className="form-card admin-product-save-actions">
      <div className="admin-product-save-copy">
        {hasUnsavedChanges && <p className="admin-unsaved-notice" role="status">Có thay đổi chưa lưu{dirtyVariants.length ? ` (${dirtyVariants.length} SKU đã chỉnh sửa)` : ""}. Kiểm tra trước khi xác nhận.</p>}
        <strong>{id ? "Hoàn tất chỉnh sửa sản phẩm" : "Xác nhận thông tin sản phẩm"}</strong>
        <p>{id ? `Lưu thông tin sản phẩm và ${dirtyVariants.length} phiên bản đã chỉnh sửa. SKU mới vẫn cần bấm “Thêm phiên bản” trước.` : "Sản phẩm sẽ được tạo ở trạng thái chưa bán. Bạn có thể bổ sung SKU và tồn kho sau khi tạo."}</p>
        {error && <p className="admin-product-save-error" aria-hidden="true">{error}</p>}
      </div>
      <button type="submit" form="skinora-product-editor" className="btn btn-dark" disabled={saving || imageBusy || variantBusy || confirmingSave}>
        <Save />{saving ? "Đang lưu..." : createdProduct ? "Thử tải ảnh lại" : "Lưu sản phẩm"}
      </button>
    </div>
    {confirmingSave && <ConfirmActionModal
      title={id ? "Bạn chắc chắn muốn lưu thay đổi?" : "Bạn chắc chắn muốn tạo sản phẩm?"}
      description={id
        ? `Xác nhận cập nhật “${form.name}”${dirtyVariants.length ? ` và lưu ${dirtyVariants.length} SKU đã sửa` : ""}. Hãy kiểm tra giá, tồn kho và trạng thái bán.`
        : `Hệ thống sẽ tạo một sản phẩm “${form.name}” ở trạng thái ${form.isActive ? "đang bán" : "chưa bán"}. Chỉ nhấn xác nhận một lần và chờ hệ thống xử lý.`}
      confirmLabel={id ? "Xác nhận lưu" : "Xác nhận tạo sản phẩm"}
      busy={saving}
      error={error}
      onConfirm={persistProduct}
      onClose={() => { if (!saving) { setConfirmingSave(false); setError(""); } }}
    />}
  </div>;
}
