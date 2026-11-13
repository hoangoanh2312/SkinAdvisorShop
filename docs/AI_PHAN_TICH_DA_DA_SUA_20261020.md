# SKINORA – Cập nhật AI phân tích da (20/10/2026)

## Vấn đề xác định từ mã nguồn được gửi

- Backend chuyển trực tiếp `recommendedIngredients` từ Gemini về giao diện. Nếu Gemini trả `[]`, màn hình không có thành phần nên ưu tiên.
- Routine chăm sóc da chỉ là mẫu cố định, không sử dụng `analysis.skinType` và `analysis.concerns`.
- Công cụ gợi ý mỹ phẩm đọc database, chỉ chọn Product active có Variant active và stock lớn hơn 0. Khi catalog chưa có hàng đang bán, `recommendations: []` là kết quả đúng.

## Phạm vi đã sửa

- Prompt Gemini mô tả rõ cấu trúc JSON, giới hạn diễn giải từ ảnh và yêu cầu không chẩn đoán.
- `ingredientGuidanceService.js` mới đưa ra gợi ý mỹ phẩm dịu nhẹ theo QUY TẮC tham khảo, khi loại da hoặc đặc điểm quan tâm đạt ngưỡng tin cậy trong kết quả chuẩn hóa. Không tự tạo tình trạng da nếu bằng chứng không đủ.
- Giữ trường `recommendedIngredients` để tương thích frontend, bổ sung `ingredientGuidance` (tên, giải thích ngắn) và `ingredientSuggestionSource` (`reference_rules`, `gemini_vision_reviewed` hoặc `insufficient_evidence`).
- Routine sáng/tối có giải thích theo nhóm da và vấn đề quan tâm. Trường `product` chỉ chứa sản phẩm thực sự được tìm thấy trong database, không tạo sản phẩm giả.
- Nếu database không có phiên bản còn hàng, API giữ nguyên `recommendations: []` và routine vẫn có thông tin chăm sóc tổng quát.
- Giao diện hiển thị giải thích thành phần và routine thay vì chỉ tiêu đề. Các tỷ lệ độ tin cậy được ghi là ước lượng của mô hình, không phải đo lường y khoa.
- Model lưu lịch sử SkinAnalysis bổ sung trường nguồn gợi ý và giải thích thành phần.
- Tối ưu Recommendation Engine trả ngay mảng rỗng nếu không có bất kỳ SKU còn hàng nào.

## Kiểm tra đã thực hiện tại môi trường xử lý

- `npm run test:skin-analysis:offline`: PASS. Mock Gemini, không kết nối nhà cung cấp AI thật và không ghi database.
- `npm run test:catalog-availability`: PASS.
- `npm run test:order-idempotency`: PASS.
- Cú pháp 98 JavaScript backend: PASS.
- Phân tích cú pháp 56 JavaScript/JSX frontend: PASS.
- Xác thực schema Mongoose cho kết quả tư vấn mới mà không kết nối database: PASS.
- **Chưa chạy được Vite production build trên môi trường kiểm tra Linux** vì dependencies trong ZIP được cài trên Windows nên không có native binding Rolldown Linux, đồng thời mạng npm không truy cập được. Cần chạy `npm.cmd run build` trên Windows.
- **Chưa nghiệm thu Gemini API thật, kết nối MongoDB Atlas hay giao diện trên trình duyệt Windows trong lượt sửa này.**

## Cách cập nhật trên Windows

1. Sao lưu `D:\SkinAdvisorShop` và giữ nguyên `.env` tại máy. ZIP bàn giao không chứa `.env`, `node_modules`, `.git` hay bản chụp dữ liệu database.
2. Giải nén ZIP và chép mã nguồn mới vào `D:\SkinAdvisorShop`.
3. Terminal 1: `cd D:\SkinAdvisorShop\backend` rồi `npm.cmd ci` (nếu thiếu packages), sau đó `npm.cmd run dev`.
4. Terminal 2: `cd D:\SkinAdvisorShop\frontend` rồi `npm.cmd ci` (nếu thiếu packages), sau đó `npm.cmd run dev`.
5. Trên Windows, kiểm tra trước khi nghiệm thu: `cd D:\SkinAdvisorShop\frontend` → `npm.cmd run build`, `npm.cmd run lint`, `npx.cmd vitest run`.
6. Chọn ảnh khuôn mặt được phép sử dụng, đồng ý xử lý ảnh, gửi phân tích một lần. Nếu backend trả Gemini kết quả có `recommendedIngredients: []` nhưng có đặc điểm tin cậy, mục Thành phần nên ưu tiên sẽ hiển thị gợi ý theo quy tắc và lý do. Nếu ảnh không đủ thông tin, hệ thống không cố đoán.
7. Đối chiếu response API `skin-analysis` với màn hình và kiểm tra trường `ingredientSuggestionSource` để phân biệt nguồn gợi ý.

## Giới hạn và an toàn

- Đây là công cụ tư vấn chăm sóc mỹ phẩm tham khảo. Không xác nhận bệnh da, không thay thế bác sĩ, không biến độ tin cậy AI thành chỉ số đã kiểm chứng y khoa.
- Hệ thống không tạo sản phẩm giả. Muốn thấy thẻ mỹ phẩm cần nhập hàng thật, có ảnh và giá được xác minh, cùng Variant đang hoạt động và còn hàng.
- Không nên sửa tồn kho thành số giả trên `skinora_prod` chỉ để thử đặt hàng. Hãy thử giao dịch trên database `_test` riêng.
- Không chạy lệnh xóa dữ liệu thật hoặc gửi `.env` hay API key trong chat.
