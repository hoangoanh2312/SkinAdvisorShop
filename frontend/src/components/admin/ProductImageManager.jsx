import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, RefreshCw, Star, Trash2, X } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import axiosClient from "../../api/axiosClient";

const MAX_BYTES = 5 * 1024 * 1024;
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);

const ProductImageManager = forwardRef(function ProductImageManager({ productId, onBusyChange }, ref) {
  const [images, setImages] = useState([]), [version, setVersion] = useState(0), [pending, setPending] = useState([]);
  const [busy, setBusy] = useState(false), [progress, setProgress] = useState(0), [error, setError] = useState(""), [deleting, setDeleting] = useState(null);
  const inputRef = useRef(null), operationRef = useRef(false), pendingRef = useRef([]);

  const replacePending = useCallback(next => {
    const retained = new Set(next.map(item => item.preview));
    pendingRef.current.forEach(item => { if (!retained.has(item.preview)) URL.revokeObjectURL(item.preview); });
    pendingRef.current = next;
    setPending(next);
  }, []);
  useEffect(() => () => pendingRef.current.forEach(item => URL.revokeObjectURL(item.preview)), []);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);

  const load = useCallback(async () => {
    if (!productId) return undefined;
    try {
      const { data } = await axiosClient.get(`/products/${productId}/images`, { sessionProtected: true });
      setImages(data.data.images); setVersion(data.data.version); setError("");
      return data.data.version;
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể tải hình ảnh sản phẩm.");
      return undefined;
    }
  }, [productId]);
  useEffect(() => { if (!productId) return undefined; const timer = setTimeout(load, 0); return () => clearTimeout(timer); }, [load, productId]);

  const uploadFiles = useCallback(async (items, targetProductId, targetVersion) => {
    if (!items.length || !targetProductId || operationRef.current) return null;
    operationRef.current = true; setBusy(true); setProgress(0); setError("");
    setPending(current => current.map(item => items.includes(item) ? { ...item, status: "uploading" } : item));
    const form = new FormData();
    items.forEach(({ file }) => form.append("images", file));
    form.append("expectedVersion", String(targetVersion));
    try {
      const { data } = await axiosClient.post(`/products/${targetProductId}/images`, form, { sessionProtected: true, onUploadProgress: event => setProgress(event.total ? Math.round(event.loaded * 100 / event.total) : 0) });
      setImages(data.data.images); setVersion(data.data.version);
      replacePending(pendingRef.current.filter(item => !items.includes(item)));
      return data.data;
    } catch (requestError) {
      setPending(current => current.map(item => items.includes(item) ? { ...item, status: "error" } : item));
      setError(requestError.response?.data?.message || "Không thể tải ảnh lên.");
      if (requestError.response?.status === 409 && productId) await load();
      throw requestError;
    } finally { operationRef.current = false; setBusy(false); }
  }, [load, productId, replacePending]);

  useImperativeHandle(ref, () => ({
    hasPending: () => pendingRef.current.length > 0,
    uploadPending: (targetProductId, targetVersion) => uploadFiles(pendingRef.current, targetProductId, targetVersion),
  }), [uploadFiles]);

  const choose = event => {
    const files = [...(event.target.files || [])]; event.target.value = ""; setError("");
    if (files.some(file => !allowed.has(file.type))) return setError("Chỉ hỗ trợ JPEG, PNG và WebP.");
    if (files.some(file => file.size > MAX_BYTES)) return setError("Mỗi ảnh không được vượt quá 5 MB.");
    if (files.length > 6) return setError("Mỗi lần chỉ được chọn tối đa 6 ảnh.");
    const items = files.map(file => ({ file, preview: URL.createObjectURL(file), status: "pending" }));
    replacePending(items);
    if (productId) void uploadFiles(items, productId, version).catch(() => {});
  };
  const retry = () => { if (productId) void uploadFiles(pendingRef.current, productId, version).catch(() => {}); };

  const reorder = async (next, primary = next[0]?.imageKey) => {
    if (operationRef.current) return; operationRef.current = true; setBusy(true); setError("");
    try {
      const { data } = await axiosClient.patch(`/products/${productId}/images/order`, { imageKeys: next.map(item => item.imageKey), primaryImageKey: primary, expectedVersion: version }, { sessionProtected: true });
      setImages(data.data.images); setVersion(data.data.version);
    } catch (requestError) { setError(requestError.response?.data?.message || "Không thể sắp xếp ảnh."); if (requestError.response?.status === 409) await load(); }
    finally { operationRef.current = false; setBusy(false); }
  };
  const move = (index, offset) => { const next = [...images], target = index + offset; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; void reorder(next); };
  const remove = async () => {
    if (!deleting || operationRef.current) return; operationRef.current = true; setBusy(true);
    try { const { data } = await axiosClient.delete(`/products/${productId}/images/${encodeURIComponent(deleting.imageKey)}`, { sessionProtected: true, data: { expectedVersion: version } }); setImages(data.data.images); setVersion(data.data.version); setDeleting(null); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể xóa ảnh."); if (requestError.response?.status === 409) await load(); }
    finally { operationRef.current = false; setBusy(false); }
  };
  const replace = async (image, file) => {
    if (!file || operationRef.current) return;
    if (!allowed.has(file.type) || file.size > MAX_BYTES) return setError("Ảnh thay thế phải là JPEG, PNG hoặc WebP và không quá 5 MB.");
    operationRef.current = true; setBusy(true); const form = new FormData(); form.append("image", file); form.append("expectedVersion", String(version));
    try { const { data } = await axiosClient.put(`/products/${productId}/images/${encodeURIComponent(image.imageKey)}`, form, { sessionProtected: true }); setImages(data.data.images); setVersion(data.data.version); }
    catch (requestError) { setError(requestError.response?.data?.message || "Không thể thay ảnh."); if (requestError.response?.status === 409) await load(); }
    finally { operationRef.current = false; setBusy(false); }
  };

  return <section className="form-card product-images-manager">
    <div className="image-manager-heading"><div><h3>Hình ảnh sản phẩm</h3><p>Ảnh đầu tiên là ảnh đại diện. Tối đa 10 ảnh.</p></div><button type="button" className="btn btn-light" disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus /> Chọn ảnh</button></div>
    <input ref={inputRef} hidden multiple type="file" accept="image/jpeg,image/png,image/webp" onChange={choose} />
    {error && <div className="form-error" role="alert">{error} {productId && <button type="button" onClick={pending.length ? retry : load}><RefreshCw /> {pending.length ? "Thử lại" : "Tải lại"}</button>}</div>}
    {pending.length > 0 && <div className="image-pending"><div className="product-image-grid">{pending.map(item => <article className="pending-image" key={item.preview}><img src={item.preview} alt="Ảnh chờ tải lên" /><span>{item.status === "uploading" ? `Đang tải ${progress}%` : item.status === "error" ? "Tải lên thất bại" : "Chờ tải lên"}</span></article>)}</div><div className="image-upload-actions">{busy && <span className="image-progress"><LoaderCircle className="spin" /> Đang tải {progress}%</span>}<button type="button" className="btn btn-light" disabled={busy} onClick={() => replacePending([])}><X /> Bỏ chọn</button></div></div>}
    <div className="product-image-grid">{images.map((image, index) => <article key={image.imageKey}><img src={image.url} alt={`Ảnh sản phẩm ${index + 1}`} />{image.isPrimary && <span><Star /> Ảnh đại diện</span>}{!image.managed && <small>Ảnh cũ</small>}<div><button type="button" disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label="Đưa ảnh lên"><ArrowUp /></button><button type="button" disabled={busy || index === images.length - 1} onClick={() => move(index, 1)} aria-label="Đưa ảnh xuống"><ArrowDown /></button>{!image.isPrimary && <button type="button" disabled={busy} onClick={() => reorder(images, image.imageKey)} aria-label="Đặt làm ảnh đại diện"><Star /></button>}<label aria-label="Thay ảnh"><RefreshCw /><input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={event => replace(image, event.target.files?.[0])} /></label><button type="button" disabled={busy} onClick={() => setDeleting(image)} aria-label="Xóa ảnh"><Trash2 /></button></div></article>)}</div>
    {!images.length && !pending.length && <p className="image-empty">Sản phẩm chưa có hình ảnh.</p>}
    {deleting && <div className="confirm-backdrop" onMouseDown={event => event.target === event.currentTarget && setDeleting(null)}><div className="confirm-modal" role="dialog" aria-modal="true"><h3>Xóa ảnh sản phẩm?</h3><p>Ảnh sẽ được gỡ khỏi sản phẩm. Cleanup Cloudinary do backend kiểm soát.</p><div><button type="button" className="btn btn-light" disabled={busy} onClick={() => setDeleting(null)}>Hủy</button><button type="button" className="btn btn-danger" disabled={busy} onClick={remove}>{busy ? "Đang xóa..." : "Xóa ảnh"}</button></div></div></div>}
  </section>;
});
export default ProductImageManager;
