/* Kiểm thử tồn kho trên MongoDB THẬT (cần transaction của replica set — Atlas có sẵn).
   Kịch bản của thầy: một SKU còn 6, khách A mua 5, khách B mua 3.
   Script tự tạo danh mục/sản phẩm/SKU/người dùng tạm có tiền tố TESTRACE, chạy kiểm thử rồi XÓA SẠCH.
   Chạy: npm run test:stock-race                                                                 */
require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const User = require("../models/User");
const Order = require("../models/Order");
const InventoryMovement = require("../models/InventoryMovement");
const { createOrder } = require("../controllers/orderController");
const { releaseExpiredReservations } = require("../services/stockReservation");
const { paymentCapabilities } = require("../services/paymentCapabilities");

const tag = `testrace-${Date.now()}`;
const address = { fullName: "Khach Kiem Thu", phone: "0912345678", province: "TP. Hồ Chí Minh", ward: "Phường Bến Nghé", address: "1 Đường Kiểm Thử" };
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const order = async (user, variant, quantity, paymentMethod = "COD") => {
  const r = res();
  await createOrder({ user, body: { items: [{ variantId: String(variant._id), quantity }], paymentMethod, shippingAddress: address }, get: () => undefined }, r);
  return r;
};
const stockOf = async (variant) => (await Variant.findById(variant._id).lean()).stock;
const line = (label, r) => console.log(`   ${label}: HTTP ${r.statusCode} — ${r.body?.message || (r.body?.data?.order ? `tạo đơn ${r.body.data.order.orderCode || r.body.data.order._id}` : "")}`);

(async () => {
  if (!process.env.MONGO_URI) throw new Error("Thiếu MONGO_URI trong .env");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const ids = {};
  try {
    const category = await Category.create({ name: `Kiểm thử ${tag}`, slug: tag });
    const product = await Product.create({ name: "Sản phẩm kiểm thử tồn kho", slug: tag, brand: "TESTRACE", category: category._id, basePrice: 100000, isActive: true, isCatalogVisible: false });
    const variant = await Variant.create({ product: product._id, name: "50 ml", sku: tag.toUpperCase(), price: 100000, stock: 6, isActive: true });
    const [A, B] = await User.create([
      { fullName: "Khach A", email: `${tag}-a@example.test`, password: "khong-dung-dang-nhap" },
      { fullName: "Khach B", email: `${tag}-b@example.test`, password: "khong-dung-dang-nhap" },
    ]);
    Object.assign(ids, { category: category._id, product: product._id, variant: variant._id, users: [A._id, B._id] });

    console.log("\n1) Lần lượt: SKU còn 6, A đặt 5 rồi B đặt 3 (COD)");
    const a1 = await order(A, variant, 5); line("A đặt 5", a1);
    const b1 = await order(B, variant, 3); line("B đặt 3", b1);
    assert.equal(a1.statusCode, 201);
    assert.equal(b1.statusCode, 409);
    assert.match(b1.body.message, /chỉ còn 1 sản phẩm, bạn đang đặt 3/);
    assert.equal(await stockOf(variant), 1);
    console.log("   => Tồn kho còn 1. B bị từ chối và được báo chỉ còn 1 sản phẩm. ĐẠT");

    console.log("\n2) Cùng lúc: đặt lại tồn 6, A (5) và B (3) bấm Đặt hàng đồng thời");
    await Variant.updateOne({ _id: variant._id }, { stock: 6 });
    const [a2, b2] = await Promise.all([order(A, variant, 5), order(B, variant, 3)]);
    line("A đặt 5", a2); line("B đặt 3", b2);
    const ok = [a2, b2].filter((r) => r.statusCode === 201);
    assert.equal(ok.length, 1, "Chỉ đúng một đơn được tạo");
    const left = await stockOf(variant);
    assert.equal(left, a2.statusCode === 201 ? 1 : 3);
    assert.ok(left >= 0);
    console.log(`   => Chỉ 1 đơn thành công, tồn kho còn ${left}, không bao giờ âm hay bán vượt. ĐẠT`);

    const online = ["ZALOPAY", "BANK_TRANSFER", "VNPAY"].find((m) => paymentCapabilities()[m].available);
    if (online) {
      console.log(`\n3) Thanh toán online (${online}): đặt lại tồn 6, A đặt 5 nhưng CHƯA thanh toán`);
      await Variant.updateOne({ _id: variant._id }, { stock: 6 });
      const a3 = await order(A, variant, 5, online); line(`A đặt 5 (${online})`, a3);
      assert.equal(a3.statusCode, 201);
      assert.equal(await stockOf(variant), 1, "Hàng được giữ ngay khi đặt");
      const b3 = await order(B, variant, 3); line("B đặt 3 trong lúc A đang giữ hàng", b3);
      assert.equal(b3.statusCode, 409);
      console.log("   A không thanh toán, giả lập hết thời gian giữ hàng...");
      await Order.updateOne({ _id: a3.body.data.order._id }, { reservedUntil: new Date(Date.now() - 1000) });
      const released = await releaseExpiredReservations();
      assert.ok(released >= 1);
      const expired = await Order.findById(a3.body.data.order._id).lean();
      assert.equal(expired.orderStatus, "cancelled");
      console.log(`   Đơn của A: ${expired.orderStatus} — ${expired.cancelReason}; tồn kho trở lại ${await stockOf(variant)}`);
      assert.equal(await stockOf(variant), 6);
      const b4 = await order(B, variant, 3); line("B đặt lại 3", b4);
      assert.equal(b4.statusCode, 201);
      assert.equal(await stockOf(variant), 3);
      console.log("   => Hàng được giữ cho người đặt trước; quá hạn thì tự trả về kho cho người khác. ĐẠT");
    } else {
      console.log("\n3) Bỏ qua kịch bản online vì chưa cấu hình ZaloPay / chuyển khoản / VNPay.");
    }
    console.log("\nSKINORA_STOCK_RACE_LIVE_PASS");
  } finally {
    if (ids.variant) await InventoryMovement.deleteMany({ variant: ids.variant });
    if (ids.users) await Order.deleteMany({ user: { $in: ids.users } });
    if (ids.variant) await Variant.deleteOne({ _id: ids.variant });
    if (ids.product) await Product.deleteOne({ _id: ids.product });
    if (ids.category) await Category.deleteOne({ _id: ids.category });
    if (ids.users) await User.deleteMany({ _id: { $in: ids.users } });
    console.log("(Đã xóa toàn bộ dữ liệu kiểm thử tạm)");
    await mongoose.disconnect();
  }
})().catch((error) => { console.error("FAIL:", error.message); process.exitCode = 1; });
