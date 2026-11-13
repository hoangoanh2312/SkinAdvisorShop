# SKINORA – bản mã nguồn được rà soát (14/10/2026)

## Thay đổi đã thực hiện

- Trang chủ không còn sử dụng sản phẩm giả, lời chứng thực khách hàng giả, 10K khách hàng, điểm 4.9/5 hay mức độ phù hợp 94% dựng sẵn. Khu vực AI minh họa được gắn nhãn rõ.
- Trang chủ lấy thương hiệu đang hoạt động qua `GET /api/brands` (chỉ trả tên và slug), và sản phẩm nổi bật từ API sản phẩm hiện có. Khi dữ liệu kinh doanh chưa có sản phẩm, giao diện hiển thị đúng trạng thái trống.
- Link khám phá vấn đề da và thành phần ở trang chủ chuyển đúng tham số lọc của trang danh mục. Xóa bộ lọc giá mặc định 1.000.000đ vốn vô tình giấu sản phẩm có giá cao hơn.
- Màn hình thêm sản phẩm mặc định `isActive=false` (bản nháp). Sau khi có ảnh, phiên bản và tồn kho, Admin tự kích hoạt sản phẩm.
- Sửa lỗi các ô bắt buộc ở phần *Thêm phiên bản* có thể chặn form *Lưu sản phẩm* khi biên tập sản phẩm cũ. Thêm kiểm tra giá, giá khuyến mãi và số nguyên tồn kho trước khi gửi variant.
- Trang chi tiết sản phẩm không hiển thị năm sao giả khi chưa có đánh giá, và biểu mẫu đánh giá chỉ dành cho khách hàng.
- Bỏ nút yêu thích không có chức năng và file giao diện Admin cũ không còn được dùng.

## Khởi động trên Windows (PowerShell)

Giữ nguyên file `.env` **trên máy của bạn**, KHÔNG sao chép vào gói mã nguồn hoặc chia sẻ lên mạng.

```powershell
cd D:\SkinAdvisorShop\backend
npm.cmd ci
npm.cmd run start:business
```

Terminal khác:

```powershell
cd D:\SkinAdvisorShop\frontend
npm.cmd ci
npm.cmd run dev
```

Truy cập `http://localhost:5173`. Kiểm tra `http://localhost:5000/api/health` và `http://localhost:5000/api/brands`.

Nếu bạn giải nén thành thư mục khác, sửa đường dẫn trong lệnh tương ứng. `start:business` dùng database `skinora_prod` theo cấu hình server hiện tại; không tự nạp dữ liệu demo.

### Tạo danh mục và hồ sơ thương hiệu thật (tùy chọn)

Chạy ở `backend` sau khi đã thiết lập database kinh doanh và kiểm tra đúng cấu hình kết nối:

```powershell
npm.cmd run business-catalog:dry
# Đọc danh sách được thêm; chỉ khi đồng ý mới chạy:
npm.cmd run business-catalog:apply
```

Script chỉ tạo **10 danh mục chuẩn và 10 hồ sơ thương hiệu theo tên thực tế**, idempotent, không tải ảnh, không tạo sản phẩm, giá, đơn hàng, tồn kho hay đánh giá. Phải tự kiểm tra quyền sử dụng thương hiệu và nhập sản phẩm đã xác minh. Không chạy khi chưa biết backend đang nhắm tới database nào.

### Nhập dữ liệu thật

1. Vào `/admin/brands`: thêm thương hiệu có thật bằng tên đã đối chiếu.
2. Vào `/admin/categories`: thêm danh mục chính xác theo sản phẩm đang kinh doanh.
3. Vào `/admin/products/new`: tạo sản phẩm với tên, brand, category, thành phần, dung tích, giá được xác minh và để ở dạng nháp.
4. Tải lên ảnh có quyền sử dụng, vào màn sửa sản phẩm, thêm biến thể có SKU và tồn kho hợp lệ.
5. Chuyển sản phẩm sang trạng thái **Đang bán** và lưu, sau đó kiểm tra `/products` và giỏ hàng.

Thông tin thương hiệu không thay thế nguồn ảnh hoặc quyền sử dụng hình ảnh; đọc `docs/real-product-sources.md`.

## Trạng thái kiểm thử và lưu ý quan trọng

- File ZIP nhận được chứa cả `.env`, `.git` và `node_modules`; bản bàn giao loại bỏ chúng, cũng không đóng gói dữ liệu cleanup manifest có thể chứa thông tin cá nhân.
- Không thao tác trực tiếp lên MongoDB, Cloudinary, Gemini, VNPay, VietQR, không xóa cơ sở dữ liệu hay tạo dữ liệu giả. 72 sản phẩm demo còn nằm nguyên trong database phát triển (nếu trước đó đã tạo).
- Những thay đổi trong gói này **chưa được xác nhận PASS đầy đủ trên môi trường Windows có MongoDB/Chrome của người dùng**. Cần chạy test và nghiệm thu thực tế tại máy của bạn trước khi triển khai công khai.
- Cần thêm sản phẩm thật, ảnh có quyền sử dụng, chính sách bán hàng và nghiệm thu COD/VNPay/VietQR trên môi trường staging trước khi mở bán.

### Kiểm thử khuyến nghị

```powershell
cd D:\SkinAdvisorShop\frontend
npx.cmd vitest run
npm.cmd run build
npm.cmd run lint
cd D:\SkinAdvisorShop\backend
npm.cmd run test:admin-production
npm.cmd run test:admin-production-api
npm.cmd run test:catalog-checkout-browser
```

Chỉ chạy `test:catalog-checkout-browser` khi đã xác minh MongoDB test database và Chrome trên Windows; script dùng test DB riêng, tạo sản phẩm/đơn test trong DB đó và mock Cloudinary.
