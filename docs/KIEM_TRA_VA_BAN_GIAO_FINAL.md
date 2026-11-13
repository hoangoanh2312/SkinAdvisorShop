# SKINORA – Kiểm tra mã nguồn và bàn giao bản sửa lỗi (14/10/2026)

## Phạm vi

Nguồn kiểm tra: `SkinAdvisorShop.zip` và bản sửa mã nguồn trước đó. Bản này giữ lại chức năng hiện có, không tạo, xóa hoặc chỉnh sửa MongoDB thực và **không chứa `.env`/khóa bí mật**.

## Lỗi đã sửa

1. **Admin / form sản phẩm:** loại bỏ hộp thoại xác nhận bị đặt nhầm trong component `VariantFields` (gây `ReferenceError` khi mở form sửa và hiển thị phiên bản). Hộp thoại duy nhất giờ đặt đúng trong `ProductForm`, cho phép hủy/tạo/sửa, khóa nút khi lưu, không tự tạo sản phẩm lần hai khi upload ảnh thất bại.
2. **Upload ảnh sản phẩm và phân tích da:** bỏ mặc định `Content-Type: application/json` ở Axios; browser/Axios tự đặt multipart boundary cho `FormData`. Backend Multer yêu cầu field `images` cho nhiều ảnh và `image` cho ảnh thay thế/ảnh phân tích da. Đồng thời bỏ header multipart đặt tay trong trang phân tích da.
3. **SKU của sản phẩm nháp:** cho phép Admin tạo phiên bản khi Product đang `isActive=false`. Endpoint công khai vẫn không trả về sản phẩm nháp. Sản phẩm mới trên Admin luôn lưu trước ở dạng nháp.
4. **Điều kiện mở bán:** chỉ cho kích hoạt sản phẩm nháp khi đã có ảnh lưu thành công và phiên bản active có tồn kho lớn hơn 0. Frontend cảnh báo; backend kiểm tra lại khi chuyển `isActive=false` sang `true`, không làm hỏng chức năng sửa các sản phẩm active legacy.
5. **Bảo vệ thao tác bấm liên tiếp:** nút tạo/cập nhật sản phẩm có modal xác nhận và khóa trong lúc request; checkout có khóa đồng bộ bằng ref để giảm tạo đơn hàng trùng vì double-click. Khi lỗi mạng không rõ kết quả, yêu cầu kiểm tra lịch sử đơn trước khi thử tạo lại.
6. **AI gợi ý:** loại sản phẩm không có variant còn hàng khỏi candidates và danh sách đề xuất chatbot; trong tư vấn, loại da vừa được người dùng cung cấp ưu tiên hơn loại da cũ.
7. **Quyền riêng tư ảnh:** cập nhật thông báo đồng ý: ảnh được gửi đến dịch vụ AI để phân tích, hệ thống lưu **kết quả** phân tích chứ không lưu file ảnh gốc. Kết quả chỉ để tham khảo chăm sóc mỹ phẩm, không thay thế bác sĩ.
8. **Giao diện:** hạn chế tràn ngang form Admin khi thu hẹp cửa sổ, nút tìm kiếm trên mobile dẫn tới catalog, bỏ nút yêu thích chưa có chức năng, bỏ dòng quảng cáo phí vận chuyển không thống nhất với tính phí backend.
9. **Kiểm thử:** thêm `backend/scripts/testReadinessOffline.js` để thử không cần DB: tạo variant cho nháp; điều kiện kích hoạt; AI không gợi ý hết hàng; parser upload multipart.

## Bằng chứng đã chạy trong môi trường offline

- `node backend/scripts/testReadinessOffline.js`: PASS (4 nhóm kiểm tra).
- `node backend/scripts/testAdminProduction.js`: PASS.
- `node backend/scripts/testDataDemo.js`: PASS.
- TypeScript parser: toàn bộ mã `frontend/src/**/*.js` và `*.jsx` parse PASS.
- React/JSDOM smoke test độc lập: trang edit có variant render được, form tạo mở hộp thoại xác nhận, nút Quay lại đóng modal mà không tạo sản phẩm.
- `node --check` toàn bộ backend JS: PASS (xem nhật ký kiểm thử kèm báo cáo).

**Giới hạn quan trọng:** Máy kiểm tra Linux không chạy được Vite/Vitest từ `node_modules` đi kèm Windows do thiếu native binding Linux; không có API keys hoặc kết nối MongoDB/Gemini/Cloudinary/VNPay thật. Vì vậy chưa được coi là đã kiểm chứng full build/browser/API production. Trên Windows cần chạy phần sau.

## Kiểm tra trên máy của bạn

### 1. Sao lưu và thay mã nguồn

1. Sao lưu toàn bộ `D:\SkinAdvisorShop` (đặc biệt `.env` riêng trên máy).
2. Giải nén ZIP mới; chép `backend/`, `frontend/`, `docs/` vào dự án (không ghi đè file `.env` hiện có).
3. Không chạy script cleanup destructive và không import seed sản phẩm demo vào `skinora_prod`.

### 2. Chạy backend và frontend

Terminal A:

```powershell
cd D:\SkinAdvisorShop\backend
npm.cmd ci
npm.cmd run start:business
```

Terminal B:

```powershell
cd D:\SkinAdvisorShop\frontend
npm.cmd ci
npm.cmd run dev
```

`http://localhost:5173` (store); `http://localhost:5173/admin` (Admin). Giữ cả hai terminal chạy. `start:business` phải trỏ tới `skinora_prod`, không sử dụng `npm run dev` ở backend để tránh chạy nhầm DB phát triển. 10 danh mục và 10 thương hiệu mà bạn đã tạo trong `skinora_prod` được giữ nguyên; **không cần apply lại**.

### 3. Test sau khi chép mã nguồn

```powershell
cd D:\SkinAdvisorShop\frontend
npx.cmd vitest run
npm.cmd run build
npm.cmd run lint
```

```powershell
cd D:\SkinAdvisorShop\backend
node scripts/testReadinessOffline.js
node scripts/testAdminProduction.js
node scripts/testDataDemo.js
```

Các test tích hợp MongoDB sử dụng **TEST_MONGO_URI kết thúc bằng `_test`**, tuyệt đối không chạy ghi vào `skinora_prod`. Các test browser checkout thanh toán thực cần staging/sandbox.

### 4. Nghiệm thu thủ công có dữ liệu thật

1. Admin → Products: nhập chính xác tên, brand đang có, category, giá xác minh và chọn ảnh sản phẩm hợp lệ; kiểm tra có hộp thoại **Xác nhận tạo sản phẩm**. Ấn Quay lại: không tạo; xác nhận một lần: tạo **nháp**.
2. Khi upload ảnh lỗi: kiểm tra thông báo, không bấm tạo sản phẩm mới; vào **Sửa** sản phẩm đã tạo để tải ảnh lại. Trong Network, request POST `/api/products/<id>/images` phải có `multipart/form-data` cùng boundary.
3. Sửa sản phẩm nháp: thêm variant có SKU, dung tích, giá, tồn kho; lưu, sau khi có ảnh và stock mới đánh dấu Đang bán. Kiểm tra xuất hiện ở trang cửa hàng.
4. Đăng ký tài khoản customer thật thử trong **staging test**, xem sản phẩm, giỏ hàng, COD; Admin xử lý đơn, kiểm tra hoàn kho nếu hủy. Không tạo đơn test trong `skinora_prod`.
5. Phân tích da: yêu cầu đồng ý trước khi gửi ảnh; test bằng API Gemini thật nếu có key hợp lệ; với catalog trống hoặc thiếu hàng, không được bịa đề xuất.
6. VNPay dùng **sandbox**, VietQR dùng thông tin tài khoản test/staging. Xác minh thanh toán thành công/thất bại, webhook/IPN, hoàn tiền và tính đúng kho; KHÔNG thử giao dịch tiền thật để nghiệm thu vội.

## Còn thiếu / chưa thể xác nhận production-ready

- **Catalog thật:** database kinh doanh mới có 10 danh mục, 10 thương hiệu; sản phẩm thực tế, ảnh có quyền sử dụng, SKU/giá/tồn kho cần nhập và xác minh. Không thể tự bịa dữ liệu hàng hóa.
- **Cloudinary:** đã sửa lỗi request multipart; vẫn cần kiểm tra cloud name, quyền upload, quota, định dạng/ảnh thực, lỗi mạng, quản lý ảnh thực tế.
- **Gemini AI:** có code gọi Gemini Vision + AI advisor + recommendation, nhưng chưa chứng minh chạy với model/key/quota hiện hành. Không được coi là chẩn đoán bệnh hay công cụ y tế; đánh giá độ chính xác trên bộ ảnh được đồng ý sử dụng trước khi phát hành.
- **Thanh toán:** backend có COD/VNPay/VietQR, nhưng chưa nghiệm thu staging end-to-end, IPN, đối soát và các trường hợp cạnh tranh tồn kho. Double-click ở frontend được chặn nhưng **chưa có idempotency key lưu ở backend cho mọi yêu cầu tạo đơn**, nên không thể bảo đảm tuyệt đối không trùng đơn sau mất mạng/retry.
- **Vận hành:** chưa có hạ tầng hosting, domain/HTTPS, giám sát lỗi, backup/restore định kỳ, chính sách mua hàng/đổi trả/bảo mật, phân quyền vận hành thực tế; chưa audit bảo mật đầy đủ.
- **Tính năng chưa có:** nhập sản phẩm CSV, upload logo thương hiệu qua Cloudinary, wishlist thật; nút wishlist giả đã bỏ khỏi giao diện.
- **Chưa đầy đủ chính sách vận chuyển:** backend tính `SHIPPING_FEE=0`. Cần chốt phí/điều kiện và đồng bộ chính sách trước khi mở bán công khai.
- **Chưa kiểm thử hoàn chỉnh trên browser thật:** ảnh Cloudinary, upload thành công, layout các kích thước, giao dịch thanh toán, email/thông báo khách hàng.

## Bảo mật

ZIP không chứa `.env`, `.git`, `node_modules`, `dist`, session, log, manifest chứa dữ liệu. File gốc từng chứa `.env`; nếu khóa trong đó đang dùng thật, nên đổi key/mật khẩu liên quan. Không đẩy các file bí mật lên Git.
