/* Kiểm thử giá trên MongoDB THẬT: đổi giá sau khi khách đã mua thì đơn cũ vẫn giữ giá lúc mua.
   Kịch bản: SKU đang bán 100.000đ, khách A mua 2 → quản trị viên tăng giá lên 150.000đ
   → đơn của A vẫn 100.000đ × 2 = 200.000đ; khách B mua sau trả giá mới 150.000đ.
   Script tự tạo dữ liệu tạm có tiền tố TESTPRICE rồi XÓA SẠCH. Chạy: npm run test:price-snapshot */
require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const User = require("../models/User");
const Order = require("../models/Order");
const InventoryMovement = require("../models/InventoryMovement");
const AdminAuditLog = require("../models/AdminAuditLog");
const { createOrder, getOrder, getMyOrders } = require("../controllers/orderController");
const { updateVariant } = require("../controllers/variantController");

const tag = `testprice-${Date.now()}`;
const address = { fullName: "Khach Kiem Thu", phone: "0912345678", province: "TP. Hồ Chí Minh", ward: "Phường Bến Nghé", address: "1 Đường Kiểm Thử" };
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const vnd = (n) => `${Number(n).toLocaleString("vi-VN")}đ`;
const buy = async (user, variant, quantity) => {
  const r = res();
  await createOrder({ user, body: { items: [{ variantId: String(variant._id), quantity }], paymentMethod: "COD", shippingAddress: address }, get: () => undefined }, r);
  assert.equal(r.statusCode, 201, r.body?.message);
  return r.body.data.order;
};
const view = async (user, orderId) => { const r = res(); await getOrder({ user, params: { id: String(orderId) } }, r); assert.equal(r.statusCode, 200); return r.body.data.order; };
const show = (label, o) => console.log(`   ${label}: ${o.items[0].quantity} × ${vnd(o.items[0].unitPrice)} = ${vnd(o.items[0].subtotal)}, tổng đơn ${vnd(o.total)}`);

(async () => {
  if (!process.env.MONGO_URI) throw new Error("Thiếu MONGO_URI trong .env");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
  const ids = {};
  try {
    const category = await Category.create({ name: `Kiểm thử ${tag}`, slug: tag });
    const product = await Product.create({ name: "Sản phẩm kiểm thử giá", slug: tag, brand: "TESTPRICE", category: category._id, basePrice: 100000, isActive: true, isCatalogVisible: false });
    const variant = await Variant.create({ product: product._id, name: "50 ml", sku: tag.toUpperCase(), price: 100000, stock: 10, isActive: true });
    const [A, B, admin] = await User.create([
      { fullName: "Khach A", email: `${tag}-a@example.test`, password: "khong-dung-dang-nhap" },
      { fullName: "Khach B", email: `${tag}-b@example.test`, password: "khong-dung-dang-nhap" },
      { fullName: "Quan tri", email: `${tag}-admin@example.test`, password: "khong-dung-dang-nhap", role: "admin" },
    ]);
    Object.assign(ids, { category: category._id, product: product._id, variant: variant._id, users: [A._id, B._id, admin._id] });

    console.log("\n1) Giá đang bán 100.000đ, khách A mua 2");
    const orderA = await buy(A, variant, 2);
    show("Đơn của A lúc đặt", orderA);

    console.log("\n2) Quản trị viên tăng giá lên 150.000đ");
    const u = res();
    await updateVariant({ user: admin, params: { id: String(variant._id) }, body: { price: 150000 } }, u);
    assert.equal(u.statusCode, 200, u.body?.message);
    console.log(`   Giá hiện tại của mã hàng: ${vnd((await Variant.findById(variant._id).lean()).price)}`);

    console.log("\n3) Mở lại đơn của A (trang Chi tiết đơn hàng)");
    const againA = await view(A, orderA._id);
    show("Đơn của A sau khi tăng giá", againA);
    assert.equal(againA.items[0].unitPrice, 100000, "đơn cũ phải giữ giá lúc mua");
    assert.equal(againA.total, orderA.total);
    const list = res(); await getMyOrders({ user: A, query: {} }, list);
    const inList = (list.body.data.orders || list.body.data.items || []).find((o) => String(o._id) === String(orderA._id));
    if (inList) assert.equal(inList.total, orderA.total, "danh sách đơn cũng giữ tổng cũ");
    console.log("   => Đơn đã mua giữ nguyên giá cũ. ĐẠT");

    console.log("\n4) Khách B mua 1 sau khi tăng giá");
    const orderB = await buy(B, variant, 1);
    show("Đơn của B", orderB);
    assert.equal(orderB.items[0].unitPrice, 150000, "đơn mới phải dùng giá mới");
    console.log("   => Đơn mới tính theo giá mới. ĐẠT");

    console.log("\n5) Đặt giá giảm 120.000đ rồi hủy giảm giá: đơn đã đặt không đổi");
    await updateVariant({ user: admin, params: { id: String(variant._id) }, body: { salePrice: 120000 } }, res());
    await updateVariant({ user: admin, params: { id: String(variant._id) }, body: { salePrice: null } }, res());
    assert.equal((await view(A, orderA._id)).items[0].unitPrice, 100000);
    assert.equal((await view(B, orderB._id)).items[0].unitPrice, 150000);
    console.log("   => Cả hai đơn vẫn giữ giá lúc đặt. ĐẠT");

    console.log("\nSKINORA_PRICE_SNAPSHOT_LIVE_PASS");
  } finally {
    if (ids.variant) await InventoryMovement.deleteMany({ variant: ids.variant });
    if (ids.users) await Order.deleteMany({ user: { $in: ids.users } });
    if (ids.users) await AdminAuditLog.deleteMany({ actor: { $in: ids.users } }).catch(() => {});
    if (ids.variant) await Variant.deleteOne({ _id: ids.variant });
    if (ids.product) await Product.deleteOne({ _id: ids.product });
    if (ids.category) await Category.deleteOne({ _id: ids.category });
    if (ids.users) await User.deleteMany({ _id: { $in: ids.users } });
    console.log("(Đã xóa toàn bộ dữ liệu kiểm thử tạm)");
    await mongoose.disconnect();
  }
})().catch((error) => { console.error("FAIL:", error.message); process.exitCode = 1; });
