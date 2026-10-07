import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import axiosClient from "../../api/axiosClient";
import ProductImageManager from "../../components/admin/ProductImageManager";

const empty = { name: "", slug: "", brand: "", category: "", description: "", basePrice: 0, salePrice: "" };
export default function ProductForm() {
  const { id } = useParams(), navigate = useNavigate();
  const [form, setForm] = useState(empty), [categories, setCategories] = useState([]), [error, setError] = useState(""), [saving, setSaving] = useState(false), [imageBusy, setImageBusy] = useState(false), [createdProduct, setCreatedProduct] = useState(null);
  const submittingRef = useRef(false), imageManagerRef = useRef(null);
  useEffect(() => {
    axiosClient.get("/categories").then(({ data }) => setCategories(data.data.categories));
    if (id) axiosClient.get(`/products/${id}`).then(({ data }) => { const product = data.data.product; setForm({ name: product.name, slug: product.slug, brand: product.brand, category: product.category?._id || "", description: product.description || "", basePrice: product.basePrice, salePrice: product.salePrice ?? "" }); }).catch(requestError => setError(requestError.response?.data?.message || "Không thể tải sản phẩm."));
  }, [id]);
  const change = event => setForm({ ...form, [event.target.name]: event.target.value });
  const uploadCreatedImages = async product => {
    if (!imageManagerRef.current?.hasPending()) return true;
    try { await imageManagerRef.current.uploadPending(product._id, product.__v ?? 0); return true; }
    catch { setError("Sản phẩm đã được tạo nhưng một số ảnh tải lên thất bại"); return false; }
  };
  const submit = async event => {
    event.preventDefault(); if (submittingRef.current) return; submittingRef.current = true; setSaving(true); setError("");
    try {
      if (createdProduct) { if (await uploadCreatedImages(createdProduct)) navigate(`/admin/products/${createdProduct._id}/edit`); return; }
      const payload = { ...form, basePrice: Number(form.basePrice), salePrice: form.salePrice === "" ? null : Number(form.salePrice) };
      if (id) { await axiosClient.put(`/products/${id}`, payload, { sessionProtected: true }); navigate("/admin/products"); return; }
      const { data } = await axiosClient.post("/products", payload, { sessionProtected: true });
      const product = data.data.product; setCreatedProduct(product);
      if (await uploadCreatedImages(product)) navigate(`/admin/products/${product._id}/edit`);
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể lưu sản phẩm."); }
    finally { submittingRef.current = false; setSaving(false); }
  };
  return <form className="admin-form-page" onSubmit={submit}><Link to="/admin/products" className="text-link"><ArrowLeft /> Quay lại</Link><div className="table-title"><div><h3>{id ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h3><p>Dữ liệu được lưu qua backend API.</p></div><button className="btn btn-dark" disabled={saving || imageBusy}><Save /> {saving ? "Đang lưu..." : createdProduct ? "Thử tải ảnh lại" : "Lưu sản phẩm"}</button></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-form-grid"><section className="form-card"><label>Tên sản phẩm<input required name="name" value={form.name} onChange={change} /></label><label>Slug<input required name="slug" value={form.slug} onChange={change} /></label><div className="form-grid"><label>Thương hiệu<input required name="brand" value={form.brand} onChange={change} /></label><label>Danh mục<select required name="category" value={form.category} onChange={change}><option value="">Chọn danh mục</option>{categories.map(item => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label></div><label>Mô tả<textarea rows="6" name="description" value={form.description} onChange={change} /></label></section><aside className="form-card"><label>Giá cơ bản<input required min="0" type="number" name="basePrice" value={form.basePrice} onChange={change} /></label><label>Giá khuyến mãi<input min="0" type="number" name="salePrice" value={form.salePrice} onChange={change} /></label><p>{id ? "Ảnh mới được tự động tải lên khi chọn." : "Chọn ảnh bên dưới; hệ thống sẽ tự tải lên sau khi tạo sản phẩm."}</p></aside></div><ProductImageManager ref={imageManagerRef} productId={id} onBusyChange={setImageBusy} /></form>;
}
