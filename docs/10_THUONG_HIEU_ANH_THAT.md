# SKINORA – 10 nguồn sản phẩm và ảnh thật cho đồ án

Đây là danh sách trang **chính thức của thương hiệu** để đối chiếu ảnh, tên, quy cách và mô tả. Không phải bản chào hàng hay dữ liệu tồn kho. **Không tự gán giá VND, số lượng, SKU hãng hoặc công dụng y khoa chưa kiểm chứng.**

| Thương hiệu | Trang sản phẩm / website chính thức | Ví dụ để tìm ảnh | Danh mục SKINORA |
|---|---|---|---|
| Hada Labo | https://hadalabo.com.vn/ | Advanced Nourish – chọn đúng mẫu đang bán tại thị trường VN | Toner / Nước cân bằng |
| CeraVe | https://www.cerave.com.vn/ | Hydrating Cleanser | Sữa rửa mặt |
| La Roche-Posay | https://www.larocheposay.vn/effaclar/effaclar-ultra-concentrated-serum | Effaclar Ultra Concentrated Serum | Serum / Tinh chất |
| Bioderma | https://www.bioderma.com.vn/san-pham/sensibio/h2o | Sensibio H2O | Tẩy trang |
| Anessa | https://www.anessa.vn/san-pham | Perfect UV Sunscreen Skincare Milk | Kem chống nắng |
| COSRX | https://www.cosrx.com/products/advanced-snail-96-mucin-power-essence | Advanced Snail 96 Mucin Power Essence | Serum / Tinh chất |
| SKIN1004 | https://www.skin1004.com/products/skin1004-madagascar-centella-ampoule | Madagascar Centella Ampoule | Serum / Tinh chất |
| Paula's Choice | https://paulaschoice.vn/ | Skin Perfecting 2% BHA Liquid Exfoliant | Tẩy tế bào chết |
| The Ordinary | https://theordinary.com/ | Hyaluronic Acid 2% + B5 | Serum / Tinh chất |
| Cocoon | https://cocoonvietnam.com/ | Tinh chất bí đao – xác minh phiên bản trên site hãng | Serum / Tinh chất |

## Cách đưa ảnh thật vào web

1. Vào link chính thức ở trên, mở **đúng SKU/quy cách** và chọn ảnh chai/hộp rõ nét. Kiểm tra quyền sử dụng ảnh; ưu tiên ảnh do hãng/nhà phân phối cho phép dùng, hoặc ảnh do nhóm tự chụp.
2. Lưu ảnh JPEG/PNG/WebP về máy với tên không dấu, ví dụ `cosrx-snail96-100ml.webp` (tên file chỉ là quy ước của đồ án).
3. Admin → Sản phẩm → Thêm sản phẩm. Chọn đúng Brand + Category, nhập giá bán và tồn kho **do bạn quyết định/xác minh**; sản phẩm mới lưu ở trạng thái nháp.
4. Tại trang sửa sản phẩm, upload ảnh bằng Cloudinary, thêm biến thể/SKU và bật bán khi hệ thống cho phép.
5. Kiểm tra trang chủ, catalog, chi tiết, giỏ hàng và đề xuất AI chỉ hiển thị sản phẩm đang bán còn tồn.
6. Ghi lại nguồn ảnh/sản phẩm trong báo cáo đồ án. Việc dùng trong bài học **không mặc nhiên cấp quyền phân phối thương mại** sau này.

## Tình trạng dữ liệu đi kèm ZIP

- Có mã nguồn, mẫu cấu hình `.env.example`, tài liệu và script chuẩn bị 10 danh mục + 10 thương hiệu trong `skinora_prod`.
- **Không có ảnh chụp hãng đã được tải vào Cloudinary** trong ZIP này. Không có sản phẩm/đơn hàng giả được nạp tự động vào `skinora_prod`.
- `backend/assets/demo-products` (nếu giữ để chạy test cũ) chỉ là asset development, tuyệt đối không dùng seed đó vào database kinh doanh.
