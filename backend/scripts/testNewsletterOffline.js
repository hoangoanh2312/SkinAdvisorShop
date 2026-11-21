/* Offline: bản tin — đăng ký, email chào mừng, link hủy nhận, gửi bản tin kèm sản phẩm, lịch sử gửi. Không cần MongoDB */
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const NewsletterSubscriber = require("../models/NewsletterSubscriber");
const NewsletterCampaign = require("../models/NewsletterCampaign");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const AdminAuditLog = require("../models/AdminAuditLog");
const mail = require("../services/mailService");
const ctl = require("../controllers/newsletterController");

const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const lean = (value) => ({ lean: async () => value, select() { return this; }, sort() { return this; }, skip() { return this; }, limit() { return this; }, populate() { return this; }, then: (ok, ko) => Promise.resolve(value).then(ok, ko) });
const matches = (doc, filter = {}) => Object.entries(filter).every(([key, cond]) => {
  if (cond && typeof cond === "object" && !(cond instanceof RegExp) && "$in" in cond) return cond.$in.map(String).includes(String(doc[key] ?? null));
  if (cond instanceof RegExp) return cond.test(doc[key]);
  return String(doc[key]) === String(cond);
});

(async () => {
  const subs = [], campaigns = [], outbox = [], restore = [];
  const patch = (obj, key, fn) => { restore.push([obj, key, obj[key]]); obj[key] = fn; };
  patch(NewsletterSubscriber, "findOne", (f) => lean(subs.find((s) => matches(s, f)) ? { ...subs.find((s) => matches(s, f)) } : null));
  patch(NewsletterSubscriber, "findById", (id) => lean(subs.find((s) => String(s._id) === String(id)) || null));
  patch(NewsletterSubscriber, "find", (f) => lean(subs.filter((s) => matches(s, f)).map((s) => ({ ...s }))));
  patch(NewsletterSubscriber, "countDocuments", async (f) => subs.filter((s) => matches(s, f)).length);
  patch(NewsletterSubscriber, "create", async (doc) => {
    if (subs.some((s) => s.email === doc.email)) throw Object.assign(new Error("dup"), { code: 11000 });
    const row = { _id: new mongoose.Types.ObjectId(), isActive: true, unsubscribeToken: NewsletterSubscriber.newUnsubscribeToken(), ...doc };
    subs.push(row); return { toObject: () => ({ ...row }) };
  });
  patch(NewsletterSubscriber, "updateOne", async (f, u) => { const row = subs.find((s) => matches(s, f)); if (row) Object.assign(row, u.$set); return { acknowledged: true }; });
  patch(NewsletterCampaign, "exists", async (f) => campaigns.some((c) => matches(c, f)));
  patch(NewsletterCampaign, "create", async (doc) => { const row = { _id: new mongoose.Types.ObjectId(), status: "sending", sentCount: 0, failedCount: 0, ...doc }; campaigns.push(row); return row; });
  patch(NewsletterCampaign, "findById", (id) => lean(campaigns.find((c) => String(c._id) === String(id))));
  patch(NewsletterCampaign, "updateOne", async (f, u) => { Object.assign(campaigns.find((c) => matches(c, f)), u.$set); return {}; });
  patch(NewsletterCampaign, "find", () => lean([...campaigns].reverse()));
  patch(AdminAuditLog, "create", async () => ({}));
  const productId = new mongoose.Types.ObjectId();
  patch(Product, "find", (f) => lean(f._id.$in.map(String).includes(String(productId)) ? [{ _id: productId, name: "Serum Niacinamide 10%", slug: "serum-niacinamide", brand: "The Ordinary", images: ["/anh/serum.jpg"] }] : []));
  patch(Variant, "find", () => lean([{ product: productId, price: 320000, salePrice: 280000, stock: 9, isActive: true }]));
  mail.setMailTransportForTests(async (message) => { outbox.push(message); return { delivered: true }; });
  ctl.setSendGapForTests(0);

  try {
    // 1) Kiểm tra email đầu vào
    for (const bad of [undefined, "", "abc", "a@b", "a b@c.vn", `${"x".repeat(250)}@a.vn`, { email: "x" }]) {
      const r = res(); await ctl.subscribe({ body: { email: bad } }, r);
      assert.equal(r.statusCode, 400, `phải từ chối ${JSON.stringify(bad)}`);
    }
    // 2) Đăng ký mới: chuẩn hóa email, gửi email chào mừng có link hủy nhận
    const r1 = res(); await ctl.subscribe({ body: { email: "  Khach.Hang@Gmail.com " } }, r1);
    assert.equal(r1.statusCode, 200); assert.match(r1.body.message, /email chào mừng đã được gửi/); assert.equal(r1.body.data.welcome, "sent");
    assert.equal(subs[0].email, "khach.hang@gmail.com");
    assert.equal(outbox.length, 1, "gửi đúng 1 email chào mừng");
    assert.match(outbox[0].subject, /đăng ký nhận bản tin/);
    assert.ok(outbox[0].html.includes(`/huy-nhan-ban-tin?token=${subs[0].unsubscribeToken}`), "email chào mừng có link hủy nhận");
    assert.match(outbox[0].headers["List-Unsubscribe"], /\/api\/newsletter\/unsubscribe\?token=/);
    assert.ok(subs[0].welcomeSentAt, "ghi lại thời điểm gửi chào mừng");
    // 3) Đăng ký lại khi đang nhận: không gửi thêm
    const r2 = res(); await ctl.subscribe({ body: { email: "khach.hang@gmail.com" } }, r2);
    assert.equal(r2.statusCode, 200); assert.equal(outbox.length, 1, "không gửi lại chào mừng cho người đang nhận");
    assert.match(r2.body.message, /đã đăng ký nhận bản tin trước đó/);
    // 3b) Đăng ký từ trước khi có email chào mừng (welcomeSentAt trống) thì được gửi bù
    subs.push({ _id: new mongoose.Types.ObjectId(), email: "dangkysom@gmail.com", isActive: true, unsubscribeToken: null, welcomeSentAt: null });
    const r2b = res(); await ctl.subscribe({ body: { email: "dangkysom@gmail.com" } }, r2b);
    assert.equal(r2b.body.data.welcome, "sent"); assert.equal(outbox.at(-1).to, "dangkysom@gmail.com"); assert.ok(subs.at(-1).unsubscribeToken);
    outbox.pop(); subs.pop();
    // 3c) Resend từ chối (ví dụ địa chỉ gửi thử chỉ cho gửi tới chủ tài khoản): báo thật cho khách, ghi lý do ra cửa sổ máy chủ
    const logged = []; const origErr = console.error; console.error = (m) => logged.push(m);
    mail.setMailTransportForTests(async () => { throw new mail.MailError("MAIL_SEND_FAILED_403", "You can only send testing emails to your own email address"); });
    const r2c = res(); await ctl.subscribe({ body: { email: "nguoikhac@gmail.com" } }, r2c);
    console.error = origErr;
    assert.equal(r2c.body.data.welcome, "failed"); assert.match(r2c.body.message, /chưa gửi được email chào mừng/);
    assert.ok(logged.some((m) => m.includes("nguoikhac@gmail.com") && m.includes("own email address")), "in lý do của Resend");
    assert.equal(subs.find((x) => x.email === "nguoikhac@gmail.com").welcomeSentAt, undefined);
    subs.splice(subs.findIndex((x) => x.email === "nguoikhac@gmail.com"), 1);
    mail.setMailTransportForTests(async (message) => { outbox.push(message); return { delivered: true }; });

    // 4) Hủy nhận bằng token, không cần đăng nhập
    const token = subs[0].unsubscribeToken;
    const badToken = res(); await ctl.unsubscribe({ query: { token: "abc" } }, badToken); assert.equal(badToken.statusCode, 400);
    const unknown = res(); await ctl.unsubscribe({ query: { token: "f".repeat(48) } }, unknown); assert.equal(unknown.statusCode, 404);
    const u1 = res(); await ctl.unsubscribe({ body: { token } }, u1);
    assert.equal(u1.statusCode, 200); assert.equal(subs[0].isActive, false); assert.ok(subs[0].unsubscribedAt);
    assert.equal(u1.body.data.email, "kh********@gmail.com", "chỉ hiện email đã che bớt");
    const u2 = res(); await ctl.unsubscribe({ query: { token } }, u2); assert.equal(u2.statusCode, 200, "bấm lại link vẫn báo thành công");

    // 5) Đăng ký lại sau khi hủy: nhận lại và có email chào mừng
    const r3 = res(); await ctl.subscribe({ body: { email: "khach.hang@gmail.com" } }, r3);
    assert.equal(subs[0].isActive, true); assert.equal(outbox.length, 2);

    // 6) Bản ghi cũ chưa có token vẫn được cấp token trước khi gửi
    subs.push({ _id: new mongoose.Types.ObjectId(), email: "cu@gmail.com", isActive: true, unsubscribeToken: null });
    subs.push({ _id: new mongoose.Types.ObjectId(), email: "dahuy@gmail.com", isActive: false, unsubscribeToken: NewsletterSubscriber.newUnsubscribeToken() });

    // 7) Kiểm tra bản nháp
    const admin = { _id: new mongoose.Types.ObjectId(), email: "admin@sandwich.vn" };
    for (const [body, pattern] of [
      [{ subject: "a", content: "Nội dung đủ dài rồi" }, /Tiêu đề/],
      [{ subject: "Ưu đãi tháng 11", content: "ngắn" }, /Nội dung/],
      [{ subject: "Ưu đãi tháng 11", content: "Nội dung đủ dài rồi", productIds: ["x"] }, /không hợp lệ/],
      [{ subject: "Ưu đãi tháng 11", content: "Nội dung đủ dài rồi", productIds: Array.from({ length: 5 }, () => String(new mongoose.Types.ObjectId())) }, /tối đa 4/],
      [{ subject: "Ưu đãi tháng 11", content: "Nội dung đủ dài rồi", productIds: [String(new mongoose.Types.ObjectId())] }, /ngừng bán/],
    ]) { const r = res(); await ctl.createCampaign({ body, user: admin }, r); assert.equal(r.statusCode, 400); assert.match(r.body.message, pattern); }

    // 8) Gửi thử tới email quản trị viên
    const t = res(); await ctl.sendTestCampaign({ body: { subject: "Ưu đãi tháng 11", content: "Nội dung đủ dài rồi" }, user: admin }, t);
    assert.equal(t.statusCode, 200); assert.equal(outbox.at(-1).to, "admin@sandwich.vn"); assert.match(outbox.at(-1).subject, /^\[Gửi thử\]/);
    assert.equal(campaigns.length, 0, "gửi thử không tạo lịch sử");

    // 9) Gửi thật: chỉ người đang nhận, có sản phẩm kèm giá theo mã hàng, có link hủy riêng từng người
    const before = outbox.length;
    const c = res(); await ctl.createCampaign({ body: { subject: "Ưu đãi tháng 11", content: "Giảm giá serum\n\nĐoạn thứ hai <b>an toàn</b>", productIds: [String(productId)] }, user: admin, waitForMail: true }, c);
    assert.equal(c.statusCode, 202);
    const sentNow = outbox.slice(before);
    assert.deepEqual(sentNow.map((m) => m.to).sort(), ["cu@gmail.com", "khach.hang@gmail.com"], "không gửi cho người đã hủy");
    for (const m of sentNow) {
      const sub = subs.find((s) => s.email === m.to);
      assert.ok(sub.unsubscribeToken, "bản ghi cũ đã được cấp token");
      assert.ok(m.html.includes(`token=${sub.unsubscribeToken}`), "mỗi người có link hủy của riêng mình");
      assert.ok(m.html.includes("Hủy nhận bản tin"));
      assert.ok(m.html.includes("Serum Niacinamide 10%") && m.html.includes("280.000đ") && m.html.includes("320.000đ"), "có thẻ sản phẩm với giá bán và giá gốc");
      assert.ok(m.html.includes("http://localhost:5173/anh/serum.jpg"), "ảnh sản phẩm dùng đường dẫn đầy đủ");
      assert.ok(!m.html.includes("<b>an toàn</b>"), "nội dung quản trị viên nhập được mã hóa HTML");
    }
    const saved = campaigns[0];
    assert.equal(saved.status, "sent"); assert.equal(saved.sentCount, 2); assert.equal(saved.failedCount, 0); assert.equal(saved.recipientCount, 2);
    assert.equal(saved.products[0].price, 280000);

    // 10) Một email lỗi thì lần gửi ghi "partial"
    campaigns.length = 0;
    mail.setMailTransportForTests(async (m) => { if (m.to === "cu@gmail.com") throw new mail.MailError("MAIL_SEND_FAILED_403", "domain is not verified"); outbox.push(m); return { delivered: true }; });
    const p = res(); await ctl.createCampaign({ body: { subject: "Lần hai", content: "Nội dung đủ dài rồi" }, user: admin, waitForMail: true }, p);
    assert.equal(campaigns[0].status, "partial"); assert.equal(campaigns[0].failedCount, 1); assert.equal(campaigns[0].sentCount, 1);
    assert.match(campaigns[0].lastError, /domain is not verified/, "lịch sử lưu lý do lỗi");

    // 11) Không cho gửi chồng khi đang có lần gửi chưa xong
    campaigns[0].status = "sending";
    const busy = res(); await ctl.createCampaign({ body: { subject: "Lần ba", content: "Nội dung đủ dài rồi" }, user: admin }, busy);
    assert.equal(busy.statusCode, 409);
  } finally {
    for (const [obj, key, fn] of restore.reverse()) obj[key] = fn;
    mail.setMailTransportForTests(null);
  }
  console.log("SKINORA_NEWSLETTER_OFFLINE_PASS: subscribe + welcome mail, one-click unsubscribe, admin campaign with products, history and partial failures");
})().catch((e) => { console.error(e); process.exitCode = 1; });
