const mongoose = require("mongoose");
const NewsletterSubscriber = require("../models/NewsletterSubscriber");
const NewsletterCampaign = require("../models/NewsletterCampaign");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { summarizeCatalogVariants } = require("../utils/catalogAvailability");
const { audit } = require("../services/adminSupport");
const mail = require("../services/mailService");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_PATTERN = /^[a-f0-9]{48}$/;
const MAX_PRODUCTS = 4;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Resend gói miễn phí cho tối đa 2 email mỗi giây, nên gửi lần lượt và nghỉ giữa các email.
let sendGapMs = Number(process.env.NEWSLETTER_SEND_GAP_MS || 600);
const setSendGapForTests = (ms) => { sendGapMs = ms; };

const maskEmail = (email = "") => {
  const [name, domain] = email.split("@");
  if (!domain) return email;
  return `${name.slice(0, 2)}${"*".repeat(Math.max(1, name.length - 2))}@${domain}`;
};

// Bản ghi cũ (tạo trước khi có link hủy nhận) chưa có token: cấp token trước khi gửi email.
const ensureToken = async (subscriber) => {
  if (subscriber.unsubscribeToken) return subscriber;
  const token = NewsletterSubscriber.newUnsubscribeToken();
  await NewsletterSubscriber.updateOne({ _id: subscriber._id, unsubscribeToken: { $in: [null, ""] } }, { $set: { unsubscribeToken: token } });
  const fresh = await NewsletterSubscriber.findById(subscriber._id).lean();
  return fresh || { ...subscriber, unsubscribeToken: token };
};

const describeMailError = (error) => `${error.code || error.name || "Error"}${error.detail ? `: ${error.detail}` : ""}`;

// Trả về "sent" (đã tới Resend), "preview" (chưa cấu hình, chỉ in ra cửa sổ máy chủ) hoặc "failed"
const sendWelcome = async (subscriber) => {
  try {
    const ready = await ensureToken(subscriber);
    const result = await mail.sendNewsletterWelcome(ready);
    if (result?.delivered === false) return "preview";
    await NewsletterSubscriber.updateOne({ _id: ready._id }, { $set: { welcomeSentAt: new Date() } });
    return "sent";
  } catch (error) {
    console.error(`[Bản tin] Gửi email chào mừng tới ${subscriber.email} thất bại: ${describeMailError(error)}`);
    return "failed";
  }
};

const SUBSCRIBE_MESSAGES = {
  sent: "Cảm ơn bạn, email chào mừng đã được gửi, hãy kiểm tra hộp thư (cả mục Quảng cáo và Thư rác)",
  preview: "Cảm ơn bạn, email đã được đăng ký nhận bản tin",
  failed: "Đã lưu email của bạn nhưng chưa gửi được email chào mừng, chúng tôi sẽ gửi bản tin khi máy chủ email hoạt động lại",
  already: "Email này đã đăng ký nhận bản tin trước đó",
};

// POST /api/newsletter/subscribe
// Đăng ký mới, đăng ký lại sau khi hủy, hoặc đã đăng ký mà chưa từng nhận email chào mừng thì gửi email chào mừng.
// Chờ gửi xong (Resend thường dưới 1 giây) để báo đúng kết quả cho khách thay vì hứa suông.
const subscribe = async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ success: false, message: "Email không hợp lệ" });
  }
  try {
    const existing = await NewsletterSubscriber.findOne({ email }).lean();
    let target = null;
    if (!existing) {
      try { target = (await NewsletterSubscriber.create({ email, source: "footer" })).toObject(); }
      catch (error) { if (error?.code !== 11000) throw error; return res.status(200).json({ success: true, message: SUBSCRIBE_MESSAGES.already }); }
    } else if (!existing.isActive) {
      const token = existing.unsubscribeToken || NewsletterSubscriber.newUnsubscribeToken();
      await NewsletterSubscriber.updateOne({ _id: existing._id }, { $set: { isActive: true, unsubscribedAt: null, unsubscribeToken: token } });
      target = { ...existing, isActive: true, unsubscribeToken: token };
    } else if (!existing.welcomeSentAt) {
      target = existing;
    }
    if (!target) return res.status(200).json({ success: true, message: SUBSCRIBE_MESSAGES.already });
    const outcome = await sendWelcome(target);
    return res.status(200).json({ success: true, message: SUBSCRIBE_MESSAGES[outcome], data: { welcome: outcome } });
  } catch (error) {
    console.error(`Newsletter subscribe failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Chưa đăng ký được, vui lòng thử lại sau" });
  }
};

// GET hoặc POST /api/newsletter/unsubscribe?token=...
// Không cần đăng nhập: ai có link trong email thì hủy được đúng email đó. POST dùng cho nút hủy một chạm của Gmail, Outlook
const unsubscribe = async (req, res) => {
  const raw = req.body?.token ?? req.query?.token;
  const token = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!TOKEN_PATTERN.test(token)) return res.status(400).json({ success: false, message: "Link hủy nhận bản tin không hợp lệ" });
  try {
    const subscriber = await NewsletterSubscriber.findOne({ unsubscribeToken: token }).lean();
    if (!subscriber) return res.status(404).json({ success: false, message: "Không tìm thấy email ứng với link này, có thể link đã cũ" });
    if (subscriber.isActive) {
      await NewsletterSubscriber.updateOne({ _id: subscriber._id }, { $set: { isActive: false, unsubscribedAt: new Date() } });
    }
    return res.status(200).json({ success: true, message: "Bạn đã hủy nhận bản tin, chúng tôi sẽ không gửi thêm email quảng cáo", data: { email: maskEmail(subscriber.email) } });
  } catch (error) {
    console.error(`Newsletter unsubscribe failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Chưa hủy được, vui lòng thử lại sau" });
  }
};

// GET /api/newsletter/admin?status=active|unsubscribed&search=&page=
const listSubscribers = async (req, res) => {
  try {
    const status = req.query.status === "unsubscribed" ? "unsubscribed" : "active";
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = 20;
    const filter = { isActive: status === "active" };
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    if (search) filter.email = new RegExp(escapeRegex(search.toLowerCase()), "i");
    const [items, total, activeCount, unsubscribedCount] = await Promise.all([
      NewsletterSubscriber.find(filter).select("email source isActive createdAt unsubscribedAt welcomeSentAt").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      NewsletterSubscriber.countDocuments(filter),
      NewsletterSubscriber.countDocuments({ isActive: true }),
      NewsletterSubscriber.countDocuments({ isActive: false }),
    ]);
    return res.status(200).json({
      success: true,
      data: { items, stats: { active: activeCount, unsubscribed: unsubscribedCount, mailConfigured: mail.isMailConfigured() }, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể tải danh sách đăng ký bản tin" });
  }
};

// GET /api/newsletter/admin/campaigns — lịch sử các lần gửi
const listCampaigns = async (_req, res) => {
  try {
    const items = await NewsletterCampaign.find().sort({ createdAt: -1 }).limit(50).populate("sentBy", "fullName").lean();
    return res.status(200).json({ success: true, data: { items } });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể tải lịch sử gửi bản tin" });
  }
};

const readDraft = async (body = {}) => {
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (subject.length < 3 || subject.length > 150) return { error: "Tiêu đề cần từ 3 đến 150 ký tự" };
  if (content.length < 10 || content.length > 5000) return { error: "Nội dung cần từ 10 đến 5000 ký tự" };
  const ids = Array.isArray(body.productIds) ? [...new Set(body.productIds.map(String))] : [];
  if (ids.length > MAX_PRODUCTS) return { error: `Chỉ kèm tối đa ${MAX_PRODUCTS} sản phẩm` };
  if (ids.some((id) => !mongoose.isValidObjectId(id))) return { error: "Sản phẩm kèm theo không hợp lệ" };
  let products = [];
  if (ids.length) {
    const [found, variants] = await Promise.all([
      Product.find({ _id: { $in: ids }, isActive: true }).select("name slug brand images").lean(),
      Variant.find({ product: { $in: ids } }).select("product price salePrice stock isActive").lean(),
    ]);
    if (found.length !== ids.length) return { error: "Có sản phẩm đã ngừng bán hoặc không tồn tại, hãy chọn lại" };
    const byId = new Map(found.map((p) => [String(p._id), p]));
    products = ids.map((id) => {
      const product = byId.get(id);
      const summary = summarizeCatalogVariants(variants.filter((v) => String(v.product) === id));
      const price = summary.catalogSalePrice ?? summary.catalogPrice ?? 0;
      const originalPrice = summary.catalogPrice && summary.catalogPrice > price ? summary.catalogPrice : null;
      return { product: product._id, name: product.name, slug: product.slug, brand: product.brand, image: product.images?.[0] || "", price, originalPrice };
    });
  }
  return { subject, content, products };
};

// Gửi lần lượt cho từng người đang nhận bản tin, cập nhật tiến độ vào bản ghi lần gửi.
const deliverCampaign = async (campaignId) => {
  const campaign = await NewsletterCampaign.findById(campaignId).lean();
  if (!campaign) return;
  let sent = 0, failed = 0, lastError = "", previewOnly = !mail.isMailConfigured();
  const save = (extra = {}) => NewsletterCampaign.updateOne({ _id: campaignId }, { $set: { sentCount: sent, failedCount: failed, previewOnly, lastError, ...extra } });
  try {
    const subscribers = await NewsletterSubscriber.find({ isActive: true }).select("email unsubscribeToken").lean();
    for (const [index, subscriber] of subscribers.entries()) {
      try {
        const ready = await ensureToken(subscriber);
        const result = await mail.sendNewsletterIssue(ready, campaign);
        if (result && result.delivered === false) previewOnly = true;
        sent += 1;
      } catch (error) {
        failed += 1;
        lastError = describeMailError(error).slice(0, 300);
        console.error(`[Bản tin] Gửi tới ${subscriber.email} thất bại: ${describeMailError(error)}`);
      }
      if ((index + 1) % 10 === 0) await save();
      if (!previewOnly && sendGapMs > 0 && index < subscribers.length - 1) await sleep(sendGapMs);
    }
    const status = failed === 0 ? "sent" : sent === 0 ? "failed" : "partial";
    await save({ status, recipientCount: subscribers.length, finishedAt: new Date() });
  } catch (error) {
    console.error(`Newsletter campaign failed: ${error.name || "Error"}`);
    await save({ status: sent ? "partial" : "failed", finishedAt: new Date() }).catch(() => {});
  }
};

// POST /api/newsletter/admin/campaigns — tạo và gửi bản tin cho tất cả người đang nhận
const createCampaign = async (req, res) => {
  try {
    const draft = await readDraft(req.body);
    if (draft.error) return res.status(400).json({ success: false, message: draft.error });
    const busy = await NewsletterCampaign.exists({ status: "sending" });
    if (busy) return res.status(409).json({ success: false, message: "Đang có một bản tin được gửi, vui lòng chờ gửi xong" });
    const recipientCount = await NewsletterSubscriber.countDocuments({ isActive: true });
    if (!recipientCount) return res.status(400).json({ success: false, message: "Chưa có ai đang nhận bản tin" });
    const campaign = await NewsletterCampaign.create({ ...draft, recipientCount, sentBy: req.user._id, previewOnly: !mail.isMailConfigured() });
    await audit({ actor: req.user._id, action: "newsletter.send", resource: "newsletterCampaign", resourceId: String(campaign._id), method: "POST", details: `Gửi bản tin "${draft.subject}" tới ${recipientCount} người` }).catch(() => {});
    const pending = deliverCampaign(campaign._id);
    if (req.waitForMail) await pending; // chỉ dùng trong test
    return res.status(202).json({ success: true, message: `Đang gửi bản tin tới ${recipientCount} người`, data: { campaign } });
  } catch (error) {
    console.error(`Newsletter create campaign failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể gửi bản tin" });
  }
};

// POST /api/newsletter/admin/campaigns/test — gửi thử bản nháp tới email của quản trị viên đang đăng nhập
const sendTestCampaign = async (req, res) => {
  try {
    const draft = await readDraft(req.body);
    if (draft.error) return res.status(400).json({ success: false, message: draft.error });
    const email = req.user?.email;
    if (!email) return res.status(400).json({ success: false, message: "Tài khoản quản trị chưa có email" });
    const result = await mail.sendNewsletterIssue({ email, unsubscribeToken: "0".repeat(48) }, { ...draft, subject: `[Gửi thử] ${draft.subject}` });
    const message = result?.delivered === false
      ? "Máy chủ chưa cấu hình gửi email, nội dung email đã in ra cửa sổ máy chủ"
      : `Đã gửi thử tới ${email}`;
    return res.status(200).json({ success: true, message });
  } catch (error) {
    console.error(`[Bản tin] Gửi thử thất bại: ${describeMailError(error)}`);
    return res.status(502).json({ success: false, message: `Gửi thử thất bại${error.detail ? `: ${error.detail}` : ", kiểm tra RESEND_API_KEY và MAIL_FROM"}` });
  }
};

module.exports = { subscribe, unsubscribe, listSubscribers, listCampaigns, createCampaign, sendTestCampaign, deliverCampaign, readDraft, maskEmail, setSendGapForTests, EMAIL_PATTERN, TOKEN_PATTERN };
