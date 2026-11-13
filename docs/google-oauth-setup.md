# Google OAuth cho sandwich/SKINORA

Flow dùng Google Identity Services **authorization code popup**. Browser nhận code một lần; backend dùng `GOOGLE_CLIENT_SECRET` đổi code tại Google, xác minh chữ ký/audience/expiry của ID token, rồi cấp JWT hiện có. Không gửi Google token, refresh token hoặc secret về frontend.

1. Tạo OAuth Client loại **Web application** trong Google Cloud Console; cấu hình OAuth consent screen và test users nếu ứng dụng còn ở Testing.
2. Thêm chính xác origin của frontend vào **Authorized JavaScript origins** (ví dụ `http://localhost:5173`). Popup dùng chính origin làm redirect URI khi backend đổi code.
3. Trong `backend/.env` (không commit), đặt `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_ALLOWED_ORIGINS` (danh sách origin phân cách dấu phẩy). Trong `frontend/.env` (tạo cục bộ, không commit), đặt `VITE_GOOGLE_CLIENT_ID` bằng cùng Client ID. Khởi động lại cả backend/Vite sau khi đổi env.
4. Mở `/login`, chọn **Tiếp tục với Google**. Nếu Google trả email đã có trong hệ thống, đăng nhập bằng mật khẩu cũ, vào `/profile` và bấm **Liên kết Google** với cùng email. Admin không thể đăng nhập/liên kết bằng flow này.

Không dùng email làm khóa định danh Google: backend lưu `sub` đã xác minh. User mới luôn là `customer`. Email chưa `email_verified` bị từ chối; User inactive bị chặn; không tự nâng role Admin. Backend cần kết nối HTTPS ra Google; production frontend phải chạy HTTPS và origin cấu hình phải khớp tuyệt đối. Các bài test có test double của Google chỉ xác nhận chính sách tài khoản; **không thay cho kiểm thử popup và Google thật**.
