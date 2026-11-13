# SKINORA – Tiếp tục hoàn thiện web (19/10/2026)

## Đã thay đổi

- Trang **/products** có bộ lọc thương hiệu lấy từ `/api/brands` và hỗ trợ `?brand=COSRX`.
- Thương hiệu ở trang chủ có liên kết đến danh sách đã lọc; bộ lọc trên mobile có nút xem kết quả.
- API `GET /api/products` bổ sung tình trạng tồn kho và giá từ **các SKU đang hoạt động và còn hàng** trên từng trang (không thay đổi schema).
- Thẻ sản phẩm hiện **HẾT HÀNG** khi không có SKU bán được; giá niêm yết ưu tiên SKU còn hàng giá thấp nhất, không dựa vào Product.basePrice khi có SKU còn hàng.
- Không dựng đánh giá sản phẩm: sản phẩm chưa có review hiển thị **Chưa có đánh giá**.
- Lời giới thiệu “được nhiều khách hàng lựa chọn” ở danh sách nổi bật đổi thành câu trung tính, tránh thể hiện sai số liệu thật.
- Không thay đổi thanh toán, đơn hàng, Gemini, Cloudinary hoặc database. Không seed hàng giả và không xóa bất cứ record nào.

## Kiểm thử đã thực hiện trong môi trường offline

- `node backend/scripts/testCatalogAvailabilityOffline.js`: PASS.
- Kiểm tra cú pháp `node --check` trên tất cả JavaScript backend: PASS.
- Kiểm tra cú pháp 54 file JS/JSX frontend bằng TypeScript parser: PASS.
- Kiểm tra adapter frontend dùng `catalogPrice`/`catalogSalePrice` và đánh dấu hàng hết: PASS.

**Chưa kiểm thử trong môi trường này:** MongoDB Atlas thật, tích hợp React chạy trình duyệt, Vite production build, upload Cloudinary, Gemini, VNPay/VietQR. Không khẳng định website đã nghiệm thu production.

## Chạy trên máy Windows

Sao lưu thư mục `D:\SkinAdvisorShop` trước khi chép bản ZIP mới; giữ lại `backend/.env` trên máy (ZIP không chứa file này).

```powershell
cd D:\SkinAdvisorShop\backend
npm.cmd ci
npm.cmd run dev
```

Mở terminal thứ hai:

```powershell
cd D:\SkinAdvisorShop\frontend
npm.cmd ci
npm.cmd run dev
```

Vào `http://localhost:5173/products` và chọn **Thương hiệu → COSRX**. Vào trang chủ, bấm tên thương hiệu để kiểm tra lọc. Ở Admin, sản phẩm thật cần ảnh hợp lệ và SKU còn hàng trước khi kích hoạt bán.

Lưu ý: môi trường live dùng `skinora_prod`. Script kiểm thử tích hợp cần database `_test` riêng. Không chạy seed/demo trên `skinora_prod`.
