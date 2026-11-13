const mongoose = require('mongoose');
const Product = require('../models/Product');
const Variant = require('../models/Variant');
const { paymentCapabilities } = require('../services/paymentCapabilities');

/** Read-only environment + catalog readiness; never prints tokens, account numbers or URIs. */
const launchReadiness = async (_req, res) => {
  try {
    const [products, variants] = await Promise.all([
      Product.find().select('_id name isActive images').lean(),
      Variant.find().select('product price stock isActive').lean(),
    ]);
    const productById = new Map(products.map(p => [String(p._id), p]));
    const totalSku = variants.length;
    const missingPrices = variants.filter(v => !Number.isFinite(v.price) || v.price <= 0).length;
    const stockedSku = variants.filter(v => Number.isSafeInteger(v.stock) && v.stock > 0).length;
    const eligibleVariants = variants.filter(v => v.isActive && v.price > 0 && Number.isSafeInteger(v.stock) && v.stock > 0
      && productById.get(String(v.product))?.isActive && productById.get(String(v.product))?.images?.length);
    const activeSellableProducts = new Set(eligibleVariants.map(v => String(v.product))).size;
    const payments = paymentCapabilities();
    const aiConfigured = Boolean(process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_MODEL?.trim());
    const production = process.env.NODE_ENV === 'production';
    const safeSecret = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32);
    const originConfigured = Boolean((process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '').trim());
    const checks = [
      { id: 'database', category: 'Hệ thống', label: 'MongoDB đang kết nối', passed: mongoose.connection.readyState === 1, detail: 'Cần một cơ sở dữ liệu MongoDB hoạt động và sao lưu định kỳ.' },
      { id: 'sellable', category: 'Bán hàng', label: 'Có sản phẩm và SKU đủ điều kiện bán', passed: activeSellableProducts > 0, detail: `${activeSellableProducts} sản phẩm đủ điều kiện, ${stockedSku}/${totalSku} SKU có tồn kho dương.` },
      { id: 'prices', category: 'Bán hàng', label: 'Tất cả SKU có giá dương', passed: totalSku > 0 && missingPrices === 0, detail: `Còn ${missingPrices} SKU chưa có giá. Bộ kiểm tra không xác minh được giá từ nhà cung cấp.` },
      { id: 'orders', category: 'Bán hàng', label: 'Phương thức COD sẵn sàng', passed: payments.COD.available, detail: 'Đơn COD cần được nghiệm thu thực tế từ giỏ hàng tới giao hàng và hủy đơn.' },
      { id: 'bank', category: 'Thanh toán', label: 'Cấu hình VietQR/Chuyển khoản', passed: payments.BANK_TRANSFER.available, detail: 'Tùy chọn: nếu bán bằng chuyển khoản, cần đối soát ngân hàng thủ công.' },
      { id: 'vnpay', category: 'Thanh toán', label: 'Cấu hình VNPay thực', passed: payments.VNPAY.mode === 'live', detail: payments.VNPAY.mode === 'sandbox' ? 'Đang cấu hình VNPay Sandbox, không được nhận là giao dịch thật.' : 'Tùy chọn: cần URL/khóa chính thức và IPN HTTPS, kiểm tra giao dịch và đối soát.' },
      { id: 'gemini', category: 'AI', label: 'Đã cấu hình khóa và model Gemini', passed: aiConfigured, detail: 'Chỉ kiểm tra cấu hình hiện diện; phải gửi ảnh thật và tin nhắn thật để xác nhận API.' },
      { id: 'jwt', category: 'Bảo mật', label: 'JWT_SECRET dài ít nhất 32 ký tự', passed: safeSecret, detail: 'Dùng giá trị ngẫu nhiên bí mật, tuyệt đối không commit vào Git hoặc ZIP.' },
      { id: 'cors', category: 'Bảo mật', label: 'Đã cấu hình origin frontend', passed: originConfigured, detail: 'Ở production hãy dùng tên miền HTTPS thật trong CORS_ORIGINS.' },
      { id: 'deploy', category: 'Triển khai', label: 'NODE_ENV=production', passed: production, detail: 'Chỉ đạt khi server triển khai thật; localhost vẫn là môi trường phát triển.' },
    ];
    return res.set('Cache-Control','no-store').json({ success: true, data: {
      database: mongoose.connection.name || 'unknown',
      checkedAt: new Date().toISOString(),
      inventory: { products: products.length, skus: totalSku, missingPrices, stockedSku, sellableProducts: activeSellableProducts },
      checks,
      manualVerifications: [
        'Đối chiếu nguồn hàng, giá bán, số lượng, hình ảnh, nhãn hàng, hạn sử dụng và thành phần từng mỹ phẩm.',
        'Đặt COD thử trên môi trường nghiệm thu riêng rồi kiểm tra trừ kho, hủy đơn và hoàn kho.',
        'Chạy Gemini API thật với sự đồng ý của người chụp ảnh và kiểm tra khả năng xóa kết quả.',
        'Đối soát chuyển khoản/VNPay với ngân hàng hoặc cổng thanh toán trước khi đánh dấu đã thu tiền.',
        'Triển khai HTTPS, thiết lập sao lưu MongoDB, giám sát lỗi, chính sách vận chuyển/đổi trả và quyền riêng tư.',
      ],
    } });
  } catch (_error) { return res.status(500).json({ success: false, message: 'Không thể kiểm tra điều kiện vận hành' }); }
};
module.exports = { launchReadiness };
