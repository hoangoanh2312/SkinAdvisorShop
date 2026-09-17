import { Edit3, Plus, Search, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { formatPrice, productData } from "../../data/mockData";
export default function ProductsAdmin() {
  return (
    <section className="admin-table-card">
      <div className="table-title">
        <div>
          <h3>Quản lý sản phẩm</h3>
          <p>{productData.length} sản phẩm trong cửa hàng</p>
        </div>
        <Link className="btn btn-dark btn-small" to="/admin/products/new">
          <Plus /> Thêm sản phẩm
        </Link>
      </div>
      <div className="admin-search">
        <Search />
        <input placeholder="Tìm tên hoặc thương hiệu..." />
      </div>
      <table>
        <thead>
          <tr>
            <th>Sản phẩm</th>
            <th>Danh mục</th>
            <th>Giá</th>
            <th>Tồn kho</th>
            <th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {productData.slice(0, 8).map((p) => (
            <tr key={p.id}>
              <td>
                <div className="table-product">
                  <img src={p.images[0]} />
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.brand}</small>
                  </span>
                </div>
              </td>
              <td>{p.category}</td>
              <td>{formatPrice(p.salePrice)}</td>
              <td>{p.variants.reduce((n, v) => n + v.stock, 0)}</td>
              <td>
                <div className="row-actions">
                  <Link to={`/admin/products/${p.id}/edit`}>
                    <Edit3 />
                  </Link>
                  <button>
                    <Trash2 />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
