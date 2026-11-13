# SKINORA – Bản cập nhật một lần kiểm thử (20/10/2026)

## Phạm vi sửa

Bản này phát triển từ bản SKINORA đã có Gemini Vision + bản vá di chuyển nút **Lưu sản phẩm** xuống cuối trang. Chỉ sửa giao diện frontend và bài kiểm thử. Không chạy migration, không sửa MongoDB Atlas hay tệp `.env`, không tự tạo tồn kho hoặc sản phẩm.

1. Nút **Lưu sản phẩm** vẫn nằm ở cuối trang, sau phần **Phiên bản, SKU và tồn kho**.
2. Khi chỉnh sửa các SKU *đã tồn tại* (giá, giá giảm, dung tích, tồn kho, trạng thái), nút lưu cuối trang sẽ phát hiện SKU có thay đổi, yêu cầu xác nhận một lần rồi gửi các thay đổi SKU **trước** yêu cầu cập nhật sản phẩm. Đây là nhiều lời gọi API tuần tự, không phải giao dịch MongoDB nguyên tử.
3. Nếu một SKU lưu lỗi, hệ thống dừng, không chuyển về trang danh sách và hiển thị lỗi để thử lại. Một SKU đã lưu thành công trước đó vẫn giữ thay đổi đã lưu trên server.
4. SKU *mới* cần bấm **Thêm phiên bản** vì thao tác này tạo một bản ghi mới. Nếu đã điền nháp SKU mới nhưng chưa bấm nút thêm, bấm **Lưu sản phẩm** sẽ cảnh báo thay vì bỏ mất dữ liệu.
5. SKU chưa lưu có nhãn **Chưa lưu**; trang có cảnh báo khi rời đi với thay đổi chưa lưu. Các loại da/vấn đề da dùng nhãn tiếng Việt nhưng giá trị API/DB vẫn giữ như cũ.
6. Trên danh sách quản lý sản phẩm, nhấp vào **tên sản phẩm / biểu tượng bút chì** để chỉnh sửa, không phải kéo ngang đến cột thao tác. Trạng thái có nhãn **Đang bán/Chưa bán**.
7. Kiểm tra thêm thương hiệu hợp lệ khi đổi thương hiệu; xác thực giá và số lượng SKU trước khi ghi dữ liệu.

## Cập nhật cho máy Windows

1. **Sao lưu** `D:\SkinAdvisorShop` trước khi cập nhật.
2. Nếu dùng **bản vá nhỏ**, giải nén vào `D:\SkinAdvisorShop` sao cho file mới thay thế `frontend\src\pages\admin\ProductForm.jsx`, `frontend\src\pages\admin\ProductsAdmin.jsx`, `frontend\src\admin.css`, `frontend\src\test\productImageAutoUpload.test.jsx`.
3. Nếu dùng **bản đầy đủ**, giải nén vào `D:\` để thu được `D:\SkinAdvisorShop`. Giữ nguyên `.env` trên máy, không xóa cơ sở dữ liệu.
4. Giữ terminal backend/frontend đang hoạt động hoặc khởi động lại nếu cần. Không chạy seed/test API ghi vào cơ sở dữ liệu kinh doanh.

Mở PowerShell:

```powershell
cd D:\SkinAdvisorShop\frontend
npx.cmd vitest run
npm.cmd run build
npm.cmd run lint
```

**Kết quả mong đợi:** 6 test files, **34 tests**. Đây là mục tiêu để kiểm chứng trên máy Windows, *không phải xác nhận đã chạy được Vitest trên môi trường đóng gói*. Lint từ bản cũ có 9 warning và 0 errors; đợt này chưa xử lý 9 warning ngoài phạm vi form.

## Kiểm thử giao diện một lượt

1. Vào **Admin → Sản phẩm**, nhấp tên sản phẩm COSRX (không kéo ngang). Trang chỉnh sửa phải mở được.
2. Kiểm tra các checkbox loại da và vấn đề da hiện bằng tiếng Việt; các checkbox đã tích sẵn không tự thay đổi.
3. Cuộn xuống dưới phần SKU: có nút **Lưu sản phẩm**. Nút **Lưu phiên bản** riêng vẫn tồn tại.
4. Đổi tạm một trường SKU **nhưng không xác nhận lưu**: nhãn **Chưa lưu** xuất hiện và nút lưu cuối trang thông báo số SKU chưa lưu. Hãy trả dữ liệu về đúng giá trị ban đầu nếu không định cập nhật thật.
5. Chọn **Quay lại** khi còn thay đổi: phải xuất hiện hộp thoại cảnh báo, chọn **Hủy** để giữ lại thông tin.
6. Thử nhập tên phiên bản mới vào ô **Thêm phiên bản** mà chưa tạo, bấm **Lưu sản phẩm**: phải có cảnh báo về SKU nháp, không tự tạo sản phẩm/SKU. Xóa tên bản nháp sau test.
7. Nếu bạn có **giá và tồn kho thật đã được xác minh**, chỉnh dữ liệu SKU rồi dùng **Lưu sản phẩm** cuối trang một lần: hộp thoại sẽ xác nhận số SKU, hệ thống lưu SKU trước rồi mới lưu sản phẩm. Kiểm tra lại bằng tải lại trang. **Không tự nhập tồn kho giả để thử mua hàng trên `skinora_prod`.**
8. Kiểm thử AI trước đó vẫn dùng trang `/skin-analysis`; không cần gửi lại ảnh khi chỉ thử giao diện Admin.

## Kết quả đã kiểm tra khi đóng gói

- Frontend JSX được TypeScript parser kiểm tra cú pháp (không phải Vitest).
- Backend offline `testSkinAnalysisGuidanceOffline.js`, `testCatalogAvailabilityOffline.js`, `testOrderIdempotencyOffline.js` chạy PASS bằng dependencies sẵn có.
- Vitest/Vite build **chưa chạy trực tiếp tại môi trường đóng gói** vì thiếu gói native Linux của Rolldown; cần chạy trên Windows bằng lệnh trên.

**Giới hạn:** "Lưu toàn bộ" là chuỗi thao tác API, không bảo đảm all-or-nothing nếu mạng lỗi. Những thay đổi đã lưu sẽ không bị hoàn tác tự động. Bản này không thay đổi thuật toán Gemini AI, Cloudinary, cổng thanh toán, quyền đăng nhập hoặc quy tắc bán hàng.
