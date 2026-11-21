const mongoose = require("mongoose");
const ContactMessage = require("../models/ContactMessage");
const mail = require("../services/mailService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^(\+?84|0)[0-9 .-]{8,13}$/;
const TOPICS = { order: "Đơn hàng", product: "Sản phẩm", skin: "Tư vấn da", partnership: "Hợp tác", other: "Khác" };
const text = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Hộp thư nhận tin nhắn: CONTACT_INBOX, nếu trống thì dùng Gmail đang gửi email (SMTP_USER)
const inbox = () => (process.env.CONTACT_INBOX || process.env.SMTP_USER || "").trim();

// POST /api/contact
const createMessage = async (req, res) => {
  const body = req.body || {};
  const name = text(body.name, 80), email = text(body.email, 254).toLowerCase(), phone = text(body.phone, 20);
  const message = text(body.message, 3000), topic = Object.hasOwn(TOPICS, body.topic) ? body.topic : "other";
  if (name.length < 2) return res.status(400).json({ success: false, message: "Vui lòng nhập họ tên" });
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ success: false, message: "Email không hợp lệ" });
  if (phone && !PHONE_PATTERN.test(phone)) return res.status(400).json({ success: false, message: "Số điện thoại không hợp lệ" });
  if (message.length < 10) return res.status(400).json({ success: false, message: "Nội dung cần ít nhất 10 ký tự" });
  try {
    const saved = await ContactMessage.create({ name, email, phone, topic, message });
    let forwarded = false;
    const to = inbox();
    if (to && mail.isMailConfigured()) {
      try {
        const rows = [["Họ tên", name], ["Email", email], ["Số điện thoại", phone || "Không có"], ["Chủ đề", TOPICS[topic]]];
        await mail.sendMail({
          to, subject: `[Liên hệ] ${TOPICS[topic]} từ ${name}`,
          headers: { "Reply-To": email },
          text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message}\n\nTrả lời email này để phản hồi trực tiếp cho khách`,
          html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#2d2326"><h2 style="color:#6e2b46">Tin nhắn liên hệ mới</h2><table cellpadding="6">${rows.map(([k, v]) => `<tr><td style="color:#8b7f7c">${k}</td><td><b>${escapeHtml(v)}</b></td></tr>`).join("")}</table><p style="white-space:pre-wrap;background:#f7f1ec;padding:14px;border-radius:8px">${escapeHtml(message)}</p><p style="color:#8b7f7c">Bấm Trả lời để phản hồi trực tiếp cho khách</p></div>`,
        });
        forwarded = true;
        await ContactMessage.updateOne({ _id: saved._id }, { $set: { forwarded: true } });
      } catch (error) {
        console.error(`[Liên hệ] Chuyển tin nhắn vào hộp thư thất bại: ${error.code || error.name}${error.detail ? `: ${error.detail}` : ""}`);
      }
    }
    return res.status(201).json({ success: true, message: "Cảm ơn bạn, chúng tôi đã nhận được tin nhắn và sẽ phản hồi qua email sớm nhất", data: { id: saved._id, forwarded } });
  } catch (error) {
    console.error(`Contact create failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Chưa gửi được tin nhắn, vui lòng thử lại sau" });
  }
};

// GET /api/contact/admin?status=new|handled|all&page=
const listMessages = async (req, res) => {
  try {
    const status = ["new", "handled"].includes(req.query.status) ? req.query.status : "all";
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1), limit = 20;
    const filter = status === "all" ? {} : { status };
    const [items, total, newCount] = await Promise.all([
      ContactMessage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ContactMessage.countDocuments(filter),
      ContactMessage.countDocuments({ status: "new" }),
    ]);
    return res.status(200).json({ success: true, data: { items, newCount, topics: TOPICS, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể tải tin nhắn liên hệ" });
  }
};

// PATCH /api/contact/admin/:id { status }
const updateStatus = async (req, res) => {
  const { id } = req.params;
  const status = req.body?.status;
  if (!mongoose.isValidObjectId(id) || !["new", "handled"].includes(status)) return res.status(400).json({ success: false, message: "Yêu cầu không hợp lệ" });
  try {
    const updated = await ContactMessage.findByIdAndUpdate(id, { $set: { status, handledAt: status === "handled" ? new Date() : null } }, { returnDocument: "after" }).lean();
    if (!updated) return res.status(404).json({ success: false, message: "Không tìm thấy tin nhắn" });
    return res.status(200).json({ success: true, data: { item: updated } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể cập nhật tin nhắn" });
  }
};

module.exports = { createMessage, listMessages, updateStatus, TOPICS };
