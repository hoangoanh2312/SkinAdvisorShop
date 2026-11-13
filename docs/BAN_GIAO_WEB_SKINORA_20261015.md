# BÀN GIAO SKINORA – Bản mã nguồn cập nhật (15/10/2026)

## 1. Nội dung gói

- `backend/`: Node.js, Express, MongoDB, quản trị thương hiệu/danh mục/sản phẩm/biến thể/kho/voucher/đơn hàng, Cloudinary, Gemini Vision và AI recommendation, COD/VNPay/VietQR.
- `frontend/`: React + Vite, cửa hàng, tư vấn và phân tích da, đăng nhập/đăng ký, giỏ hàng/checkout, quản trị Admin.
- `docs/`: cách chạy, nhập sản phẩm chính thức, thiết lập Cloudinary và danh sách chưa nghiệm thu.
- `backend/assets/demo-products/`: tư liệu **dev/test cũ**, không phải catalog kinh doanh. Không sử dụng script seed demo trên `skinora_prod`.

## 2. Sửa đổi trọng tâm của bản cập nhật

- Giữ các sửa lỗi trước đó: upload ảnh multipart, product draft/variant, hộp thoại xác nhận tránh bấm hai lần, lọc tồn kho khỏi gợi ý AI.
- Thêm **chống tạo đơn trùng ở backend**: `Idempotency-Key` của một checkout được lưu vào Order theo từng user, có chỉ mục unique; gửi lại cùng key và cùng dữ liệu sẽ trả về chính đơn cũ mà không trừ kho lần hai. Dùng cùng key cho payload khác bị trả 409. Client tự lưu key cho lần thử lại sau lỗi mạng.
- `start:business` đảm bảo MongoDB tạo chỉ mục chống trùng trước khi nhận request. Nếu tài khoản MongoDB không có quyền tạo index, backend sẽ không mở cổng: cần cấp quyền phù hợp và khởi chạy lại (không xóa database).
- Thêm unit test offline cho key/fingerprint, frontend test cho attempt key và tài liệu nguồn ảnh thật của 10 hãng.

## 3. Cài đặt trên Windows 10/11

**Không ghi đè `.env` hiện có.** Sao lưu toàn bộ `D:\SkinAdvisorShop` trước khi chép mã nguồn, không tự chạy script cleanup/destructive.

Terminal 1:
```powershell
cd D:\SkinAdvisorShop\backend
npm.cmd ci
npm.cmd run start:business
```

Terminal 2:
```powershell
cd D:\SkinAdvisorShop\frontend
npm.cmd ci
npm.cmd run dev
```

Mở `http://localhost:5173`. Từ bản hợp nhất backend, `npm.cmd run dev` cũng dùng `skinora_prod`. Có thể dùng `start:business` hoặc `npm start` với cùng database; không chạy nhiều backend trên cổng 5000 cùng lúc.

## 4. Kiểm tra ngắn gọn

```powershell
cd D:\SkinAdvisorShop\backend
npm.cmd run test:order-idempotency
node scripts/testReadinessOffline.js
node scripts/testAdminProduction.js
node scripts/testDataDemo.js
```

```powershell
cd D:\SkinAdvisorShop\frontend
npx.cmd vitest run
npm.cmd run build
npm.cmd run lint
```

Nên thử thủ công việc tạo sản phẩm ở trạng thái nháp → upload ảnh → thêm variant tồn kho → kích hoạt → giỏ hàng → đặt COD **trên database staging/test**. Tuyệt đối không chạy test tạo đơn giả trên `skinora_prod`.

## 5. Những gì CHƯA được nghiệm thu thực tế trong môi trường bàn giao

- Kết nối MongoDB Atlas và chỉ mục thật sau lần thay source, Cloudinary upload, Gemini Vision và chất lượng tư vấn cho ảnh người thật.
- VNPay sandbox/IPN, VietQR/COD từ đầu đến cuối, hoàn kho/phí vận chuyển, các trường hợp mạng chập chờn có giao dịch thật.
- Bảo mật triển khai công khai, HTTPS, sao lưu/khôi phục và chính sách người dùng.
- Catalog của 10 thương hiệu chỉ có **nguồn nhập tham khảo**, chưa có ảnh bản quyền/catalog sản phẩm thật, giá và tồn kho được xác minh. Chưa có CSV importer tự động.
- Frontend full build chưa chạy được trong môi trường Linux này vì gói dependencies được tải từ Windows thiếu native binding Linux; cần kiểm tra trên Windows theo lệnh ở trên.

**Kết luận:** Đây là **mã nguồn đã cập nhật để tiếp tục hoàn thiện đồ án và nghiệm thu trên máy bạn**, không phải bằng chứng web đã sẵn sàng bán hàng công khai.
