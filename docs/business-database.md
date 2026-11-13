# Database kinh doanh SKINORA

Database phát triển cũ có thể vẫn tồn tại để bảo toàn dữ liệu, nhưng cả `npm run dev`, `npm start` và `start:business` hiện đều dùng `skinora_prod` cho website. Script khởi tạo một lần từng sao chép tài khoản Admin (bao gồm bcrypt hash), không sao chép Product, Order, Voucher, Review hoặc Customer. Không cần sửa `.env` để dùng database kinh doanh.

Trong `backend`:

```powershell
npm.cmd run check:business-config
npm.cmd run dev
```

`business-db:init` là lệnh di chuyển Admin một lần từ database cũ, không chạy lại vì `skinora_prod` đã có dữ liệu. `check:business-config` kiểm tra logic mà không kết nối mạng. Để chạy website, trong `frontend` dùng `npm.cmd run dev` rồi mở `http://localhost:5173`. API mặc định là `http://localhost:5000/api`; nếu đặt `VITE_API_URL`, phải trỏ tới đúng backend kinh doanh.

Khi triển khai công khai, đặt `MONGO_URI` tại môi trường máy chủ tới `skinora_prod` và dùng `npm start`. Không đưa URI hoặc JWT secret vào frontend. Tạo backup/snapshot Atlas trước khi thay đổi cấu hình production.

Rollback kỹ thuật: phải hoàn tác thay đổi mã nguồn hợp nhất backend hoặc cấu hình lại trước khi có thể chạy database khác, không chỉ sửa URI `.env`. Dừng backend và sao lưu dữ liệu trước mọi thay đổi. Việc này không xóa `skinora_prod` và không phục hồi các đơn đã tạo sau lúc chuyển đổi; cần đối soát dữ liệu giao dịch trước khi rollback trên website đang bán hàng.

Database mới ban đầu chỉ có Admin; Dashboard và catalog hiển thị số 0 đúng dữ liệu. Tạo Brand/Category rồi nhập Product/Variant/ảnh thật qua Admin. Không chuyển `SKN-DEMO-*` hoặc fixture sang đây.

## Nhập catalog thật bằng Admin

1. Đăng nhập Admin trên website chạy với `start:business`; kiểm tra Dashboard đang có 0 sản phẩm/đơn hàng trước khi nhập.
2. Tạo hồ sơ thương hiệu tại `/admin/brands` và danh mục tại `/admin/categories`. Chỉ nhập tên, slug và mô tả đã xác minh; không tạo hàng loạt dữ liệu giả.
3. Tại `/admin/products/new`, nhập tên, slug, thương hiệu, danh mục, mô tả, thành phần, loại da, vấn đề da và giá đã đối chiếu với nguồn chính thức hoặc hồ sơ nhập hàng. Chọn ảnh mà cửa hàng có quyền sử dụng; ảnh được tải qua backend lên Cloudinary khi lưu.
4. Mở sản phẩm vừa tạo để thêm các variant với SKU, dung tích/đơn vị, giá, giá giảm và tồn kho theo dữ liệu nhập kho thực tế. Kiểm tra ảnh chính và ảnh phụ, sau đó xem sản phẩm ở trang cửa hàng.
5. Chỉ kích hoạt sản phẩm sau khi xác minh lại giá, dung tích, thành phần, ảnh, tồn kho và chính sách bán. Không dùng database kinh doanh để thử tạo đơn/thanh toán giả; các bài thử giao dịch phải chạy trên database test riêng.

Chưa có CSV importer trong bản này; dùng form Admin để nhập thủ công. Brand logo cũng chưa có luồng upload Cloudinary riêng, nên không nên gắn URL ảnh ngoài. Các mục này cần hoàn thiện trước khi coi Admin là đủ mọi tính năng yêu cầu.
