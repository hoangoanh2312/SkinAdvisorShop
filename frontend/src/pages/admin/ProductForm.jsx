import { ArrowLeft, ImagePlus, Save } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { productData } from "../../data/mockData";
export default function ProductForm() {
  const { id } = useParams(),
    product = productData.find((p) => p.id === id),
    editing = Boolean(product);
  return (
    <div className="admin-form-page">
      <Link to="/admin/products" className="text-link">
        <ArrowLeft /> Quay lại
      </Link>
      <div className="table-title">
        <div>
          <h3>{editing ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h3>
          <p>Thông tin đang dùng cho giao diện minh họa.</p>
        </div>
        <button className="btn btn-dark">
          <Save /> Lưu sản phẩm
        </button>
      </div>
      <div className="admin-form-grid">
        <section className="form-card">
          <h3>Thông tin cơ bản</h3>
          <label>
            Tên sản phẩm
            <input defaultValue={product?.name} />
          </label>
          <div className="form-grid">
            <label>
              Thương hiệu
              <input defaultValue={product?.brand} />
            </label>
            <label>
              Danh mục
              <select defaultValue={product?.category}>
                <option>Serum</option>
                <option>Kem dưỡng</option>
                <option>Sữa rửa mặt</option>
              </select>
            </label>
          </div>
          <label>
            Mô tả
            <textarea rows="6" defaultValue={product?.description} />
          </label>
        </section>
        <aside className="form-card">
          <h3>Hình ảnh</h3>
          <div className="image-upload">
            {product ? (
              <img src={product.images[0]} />
            ) : (
              <>
                <ImagePlus />
                <span>Tải ảnh sản phẩm</span>
              </>
            )}
          </div>
          <label>
            Giá bán
            <input type="number" defaultValue={product?.salePrice} />
          </label>
          <label>
            Tồn kho
            <input type="number" defaultValue={product?.variants[0].stock} />
          </label>
        </aside>
      </div>
    </div>
  );
}
