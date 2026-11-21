# Mô hình phát hiện mụn

Chép 2 file tải từ notebook `ml/acne_yolo_training.ipynb` (ở thư mục gốc dự án) vào đây:

- `acne_yolo.onnx` — mô hình YOLO đã huấn luyện
- `acne_yolo.json` — tên lớp, kích thước ảnh đầu vào, chỉ số đánh giá

Sau đó chạy `npm install` trong `backend` rồi `npm run acne:check -- duong_dan_anh.jpg` để kiểm tra.
Thiếu file nào thì backend tự quay về chỉ dùng Gemini.
