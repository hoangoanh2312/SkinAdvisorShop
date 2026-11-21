/* Offline: trang Liên hệ — kiểm tra dữ liệu, lưu tin nhắn, chuyển vào hộp thư cửa hàng với Reply-To của khách */
const assert = require("node:assert/strict");
const ContactMessage = require("../models/ContactMessage");
const mail = require("../services/mailService");
const { createMessage, updateStatus } = require("../controllers/contactController");
const res = () => ({ statusCode: 200, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
(async () => {
  const saved = [], outbox = [], env = { ...process.env };
  const orig = { create: ContactMessage.create, updateOne: ContactMessage.updateOne, findByIdAndUpdate: ContactMessage.findByIdAndUpdate };
  ContactMessage.create = async (doc) => { const row = { _id: "m" + saved.length, status: "new", forwarded: false, ...doc }; saved.push(row); return row; };
  ContactMessage.updateOne = async (f, u) => { Object.assign(saved.find((r) => r._id === f._id), u.$set); return {}; };
  ContactMessage.findByIdAndUpdate = () => ({ lean: async () => null });
  mail.setMailTransportForTests(async (m) => { outbox.push(m); return { delivered: true }; });
  Object.assign(process.env, { SMTP_USER: "shop@gmail.com", SMTP_PASS: "abcdefghijklmnop", CONTACT_INBOX: "" });
  try {
    const ok = { name: "Nguyễn Lan", email: "Lan@Gmail.com", phone: "0912 345 678", topic: "skin", message: "Da mình dầu, nên dùng gì <b>ạ</b>?" };
    for (const [patch, pattern] of [[{ name: "" }, /họ tên/], [{ email: "x" }, /Email/], [{ phone: "123" }, /điện thoại/], [{ message: "ngắn" }, /10 ký tự/]]) {
      const r = res(); await createMessage({ body: { ...ok, ...patch } }, r); assert.equal(r.statusCode, 400); assert.match(r.body.message, pattern);
    }
    const r = res(); await createMessage({ body: { ...ok, topic: "hack" } }, r);
    assert.equal(r.statusCode, 201); assert.equal(saved[0].email, "lan@gmail.com"); assert.equal(saved[0].topic, "other");
    assert.equal(outbox[0].to, "shop@gmail.com", "chuyển vào Gmail cửa hàng"); assert.equal(outbox[0].headers["Reply-To"], "lan@gmail.com");
    assert.ok(!outbox[0].html.includes("<b>ạ</b>"), "nội dung khách nhập được mã hóa HTML");
    assert.equal(saved[0].forwarded, true);
    // Gửi email lỗi vẫn lưu tin nhắn
    mail.setMailTransportForTests(async () => { throw new mail.MailError("SMTP_FAILED", "x"); });
    const logged = []; const e = console.error; console.error = (m) => logged.push(m);
    const r2 = res(); await createMessage({ body: ok }, r2); console.error = e;
    assert.equal(r2.statusCode, 201); assert.equal(saved[1].forwarded, false); assert.ok(logged.length);
    const bad = res(); await updateStatus({ params: { id: "x" }, body: { status: "handled" } }, bad); assert.equal(bad.statusCode, 400);
  } finally {
    Object.assign(ContactMessage, orig); mail.setMailTransportForTests(null);
    for (const k of ["SMTP_USER", "SMTP_PASS", "CONTACT_INBOX"]) { if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  }
  console.log("SKINORA_CONTACT_OFFLINE_PASS: contact form validates, saves, forwards to shop inbox with Reply-To");
})().catch((e) => { console.error(e); process.exitCode = 1; });
