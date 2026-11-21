# Mô hình phát hiện mụn (YOLO + ACNE04)

1. Mở `acne_yolo_training.ipynb` trên Google Colab (File → Upload notebook), chọn Runtime → T4 GPU.
2. Chạy lần lượt các ô; cần Roboflow Private API Key (miễn phí).
3. Tải `acne_yolo_export.zip`, chép `acne_yolo.onnx` + `acne_yolo.json` vào `backend/ml/models/`.
4. `cd backend && npm install && npm run acne:check -- anh_mat.jpg`
5. Khởi động lại backend: log hiện `Acne detector: ON (...)`.

Thư mục `report/` trong zip có biểu đồ (results.png, confusion_matrix.png, PR_curve.png) cho mục
"Đánh giá độ chính xác mô hình". Chỉ số tổng hợp (precision, recall, mAP@50, mAP@50-95) nằm trong `acne_yolo.json`.
