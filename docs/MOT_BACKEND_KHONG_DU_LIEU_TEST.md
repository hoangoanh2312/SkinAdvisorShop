# SKINORA – Một backend, một database kinh doanh

## Điều đã sửa

- `npm.cmd run dev` (tự reload khi chỉnh code), `npm start` và `npm.cmd run start:business` đều khởi chạy `backend/server.js`, cùng database **`skinora_prod`**. Lệnh `start:business` chỉ giữ để tương thích hướng dẫn cũ.
- Nếu `.env` vẫn có `MONGO_URI` trỏ `skin_advisor_shop` hoặc một database phát triển khác, backend tự chuyển tên database trong bộ nhớ sang `skinora_prod`, không ghi lại `.env`. Nếu đã trỏ `skinora_prod`, không thay đổi. Chỉ định URI mẫu với tên database hợp lệ.
- Không sao chép hoặc tự xóa tài khoản, sản phẩm, đơn hàng trong database cũ. **Dữ liệu test cũ vẫn có thể tồn tại trên Atlas nhưng không xuất hiện trên website** khi backend chạy đúng `skinora_prod`.
- Script seed ảnh/demo chỉ cho phép kết nối đến database tên kết thúc `_test` khi chạy trực tiếp, không thể chèn ảnh/sản phẩm giả vào database kinh doanh. Các script kiểm thử vẫn sử dụng database `_test` riêng.
- Giữ chống tạo trùng đơn hàng ở backend, bằng index idempotency khi khởi động.

## Cách chạy trên Windows

1. Sao lưu thư mục `D:\SkinAdvisorShop` đang dùng. Sao lưu file `.env` riêng, không chia sẻ mật khẩu.
2. Giải nén ZIP, chép `backend/`, `frontend/`, `docs/` đè lên dự án hiện tại. **Không xóa `.env` và database Atlas**, không chạy `business-db:init` hoặc cleanup.
3. Mở Terminal 1:

```powershell
cd D:\SkinAdvisorShop\backend
npm.cmd ci
npm.cmd run check:business-config
npm.cmd run dev
```

4. Khi thấy `MongoDB connected successfully`, `Business database: skinora_prod`, `Server running on port 5000`, giữ nguyên Terminal 1 đang chạy.
5. Mở Terminal 2:

```powershell
cd D:\SkinAdvisorShop\frontend
npm.cmd ci
npm.cmd run dev
```

6. Mở `http://localhost:5173/admin`. Dashboard sẽ đọc số liệu thật của `skinora_prod`, có 10 danh mục, 10 thương hiệu và sản phẩm bạn đã nhập; số liệu thực tùy thuộc database.

## Kiểm tra nếu vẫn lỗi kết nối

- `npm run dev` và `start:business` giờ **kết nối cùng một MongoDB Atlas**, nên nếu lỗi IP/TLS/DNS, đổi lệnh chạy không giúp khắc phục.
- Kiểm tra IP Access List Atlas, kết nối TCP 27017, TLS, trạng thái cluster và internet. Không tắt xác minh TLS.
- Không chạy 2 backend cùng lúc trên port 5000. Dừng bằng Ctrl+C **chỉ khi muốn tắt backend**.
- Không lặp `npm ci` liên tục khi lỗi TLS Atlas; cài dependencies không sửa được lỗi mạng.

## Lưu ý kiểm thử và dữ liệu

- `npm run check:business-config` chỉ chạy bài test offline, không cần MongoDB.
- Bộ test tích hợp vẫn có thể tạo fixture, **chỉ** trong database `_test` được bảo vệ bằng `utils/testDatabase.js`. Không chạy đơn thử COD/VNPay/VietQR trên `skinora_prod`.
- Không xóa thủ công dữ liệu test Atlas cũ; nếu thực sự cần xóa vĩnh viễn phải backup và phê duyệt riêng.
- Catalog kinh doanh chỉ có sản phẩm do Admin nhập và những thương hiệu/danh mục đã xác nhận; không tự nhập ảnh, giá, tồn kho giả.
