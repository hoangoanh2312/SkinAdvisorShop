// Gửi email không cần cài thêm gói npm. Thứ tự ưu tiên:
// - SMTP_USER + SMTP_PASS set       -> gửi qua SMTP, mặc định Gmail (smtp.gmail.com:465, dùng Mật khẩu ứng dụng), gửi được tới mọi địa chỉ.
// - RESEND_API_KEY + MAIL_FROM set  -> sends through the Resend HTTP API (https://resend.com, free tier).
// - otherwise, outside production    -> prints the e-mail (with its link) in the backend console so the flow can be demoed.
// - otherwise, in production         -> throws MAIL_NOT_CONFIGURED.
class MailError extends Error { constructor(code, detail = "") { super(code); this.code = code; this.detail = detail; } }

const frontendUrl = (path) => `${(process.env.FRONTEND_URL || process.env.GOOGLE_FRONTEND_ORIGIN || "http://localhost:5173").replace(/\/+$/, "")}${path}`;
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const layout = ({ title, intro, actionLabel, actionUrl, note }) => `<!doctype html><html lang="vi"><body style="margin:0;background:#f7f1ec;font-family:Arial,sans-serif;color:#2d2326">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:14px;padding:32px">
<tr><td style="font-family:'Brush Script MT',cursive;font-size:30px;color:#6e2b46">sandwich beauty</td></tr>
<tr><td style="padding-top:18px;font-size:20px;font-weight:bold">${escapeHtml(title)}</td></tr>
<tr><td style="padding-top:10px;font-size:15px;line-height:1.6;color:#4a3d40">${escapeHtml(intro)}</td></tr>
<tr><td style="padding:24px 0"><a href="${escapeHtml(actionUrl)}" style="background:#6e2b46;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:bold;display:inline-block">${escapeHtml(actionLabel)}</a></td></tr>
<tr><td style="font-size:13px;line-height:1.6;color:#8b7f7c">${escapeHtml(note)}<br>Nếu nút không bấm được, mở liên kết: ${escapeHtml(actionUrl)}</td></tr>
</table></td></tr></table></body></html>`;

let transportOverride = null;
const { sendSmtp, parseAddress } = require("./smtpClient");
// Giá trị mẫu như "re_xxxxxxxx" hay "your_app_password" coi như chưa điền
const realValue = (value) => {
  const text = String(value || "").trim();
  return !text || /x{4,}|your[_-]|changeme/i.test(text) ? "" : text;
};
const smtpConfig = () => {
  const user = realValue(process.env.SMTP_USER);
  const pass = realValue(process.env.SMTP_PASS).replace(/\s+/g, ""); // Mật khẩu ứng dụng Gmail hiển thị dạng "abcd efgh ijkl mnop"
  if (!user || !pass) return null;
  const host = realValue(process.env.SMTP_HOST) || (/@(gmail|googlemail)\.com$/i.test(user) ? "smtp.gmail.com" : "");
  if (!host) return null;
  // Gmail chỉ cho gửi bằng đúng địa chỉ của tài khoản: giữ tên hiển thị trong MAIL_FROM, thay địa chỉ bằng SMTP_USER
  const wanted = parseAddress(process.env.MAIL_FROM || "");
  const fromEmail = wanted.email && !/resend\.dev$/i.test(wanted.email) ? wanted.email : user;
  return { host, port: Number(process.env.SMTP_PORT || 465), user, pass, from: `${wanted.name || "sandwich beauty"} <${fromEmail}>` };
};
const mailProvider = () => smtpConfig() ? "smtp" : (realValue(process.env.RESEND_API_KEY) && realValue(process.env.MAIL_FROM) ? "resend" : "");

const sendMail = async ({ to, subject, html, text, headers }) => {
  if (transportOverride) return transportOverride({ to, subject, html, text, headers });
  const smtp = smtpConfig();
  if (smtp) {
    try {
      await sendSmtp({ ...smtp, to, subject, text, html, headers });
      return { delivered: true };
    } catch (error) {
      throw new MailError(error.code || "SMTP_FAILED", error.detail || String(error.message || ""));
    }
  }
  const key = realValue(process.env.RESEND_API_KEY);
  const from = (process.env.MAIL_FROM || "").trim();
  if (key && from) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST", signal: controller.signal,
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, html, text, ...(headers ? { headers } : {}) }),
      });
      if (!response.ok) {
        // Giữ lại lời giải thích của Resend (ví dụ chỉ được gửi tới email của chủ tài khoản) để in ra cửa sổ máy chủ
        let detail = "";
        try { const body = await response.json(); detail = String(body?.message || body?.error || "").slice(0, 300); } catch { /* bỏ qua */ }
        throw new MailError(`MAIL_SEND_FAILED_${response.status}`, detail);
      }
      return { delivered: true };
    } catch (error) {
      throw error instanceof MailError ? error : new MailError("MAIL_SEND_FAILED", error?.name === "AbortError" ? "Hết thời gian chờ Resend" : String(error?.message || ""));
    } finally { clearTimeout(timer); }
  }
  if (process.env.NODE_ENV === "production") throw new MailError("MAIL_NOT_CONFIGURED");
  console.log(`\n[DEV MAIL] Chưa cấu hình SMTP_USER/SMTP_PASS hoặc RESEND_API_KEY — email KHÔNG được gửi đi.\n  Tới: ${to}\n  Tiêu đề: ${subject}\n  ${text}\n`);
  return { delivered: false, dev: true };
};

const sendPasswordResetMail = (user, token) => {
  const url = frontendUrl(`/reset-password?token=${encodeURIComponent(token)}`);
  return sendMail({
    to: user.email, subject: "Đặt lại mật khẩu sandwich beauty",
    text: `Mở liên kết sau để đặt lại mật khẩu (hết hạn sau 30 phút): ${url}`,
    html: layout({ title: "Đặt lại mật khẩu", intro: `Xin chào ${user.fullName}, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.`, actionLabel: "Đặt lại mật khẩu", actionUrl: url, note: "Liên kết hết hạn sau 30 phút và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này." }),
  });
};
const sendVerifyMail = (user, token) => {
  const url = frontendUrl(`/verify-email?token=${encodeURIComponent(token)}`);
  return sendMail({
    to: user.email, subject: "Xác minh email sandwich beauty",
    text: `Mở liên kết sau để xác minh email (hết hạn sau 24 giờ): ${url}`,
    html: layout({ title: "Xác minh địa chỉ email", intro: `Xin chào ${user.fullName}, hãy xác minh email để bảo vệ tài khoản và nhận thông báo đơn hàng.`, actionLabel: "Xác minh email", actionUrl: url, note: "Liên kết hết hạn sau 24 giờ." }),
  });
};

// ---- Bản tin ----
const apiUrl = (path) => `${(process.env.PUBLIC_API_URL || process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/+$/, "")}${path}`;
const absoluteUrl = (value) => !value ? "" : /^https?:\/\//i.test(value) ? value : frontendUrl(value.startsWith("/") ? value : `/${value}`);
const formatVnd = (value) => `${Number(value || 0).toLocaleString("vi-VN")}đ`;
const unsubscribeLinks = (token) => ({
  page: frontendUrl(`/huy-nhan-ban-tin?token=${encodeURIComponent(token)}`),
  oneClick: apiUrl(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`),
});
// Email bản tin luôn có link hủy nhận ở cuối và header List-Unsubscribe để hộp thư hiện nút hủy một chạm.
const newsletterHeaders = (token) => {
  const { page, oneClick } = unsubscribeLinks(token);
  return { "List-Unsubscribe": `<${oneClick}>, <${page}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
};
const paragraphs = (text) => String(text || "").split(/\r?\n\s*\r?\n/).map((block) => block.trim()).filter(Boolean)
  .map((block) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#4a3d40">${escapeHtml(block).replace(/\r?\n/g, "<br>")}</p>`).join("");
const productCards = (products = []) => !products.length ? "" : `<tr><td style="padding-top:8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${products.map((p) => {
  const url = frontendUrl(`/products/${encodeURIComponent(p.slug || p.productId || "")}`);
  const image = absoluteUrl(p.image);
  return `<tr><td style="padding:10px 0;border-top:1px solid #eee3dc"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
${image ? `<td width="84" style="padding-right:14px;vertical-align:top"><a href="${escapeHtml(url)}"><img src="${escapeHtml(image)}" width="84" height="84" alt="${escapeHtml(p.name)}" style="display:block;width:84px;height:84px;object-fit:cover;border-radius:8px;background:#f2e9e3"></a></td>` : ""}
<td style="vertical-align:top"><div style="font-size:11px;letter-spacing:.12em;color:#8e6558;text-transform:uppercase">${escapeHtml(p.brand || "")}</div>
<a href="${escapeHtml(url)}" style="display:block;margin:4px 0 6px;font-size:15px;font-weight:bold;color:#2d2326;text-decoration:none">${escapeHtml(p.name)}</a>
<span style="font-size:14px;color:#6e2b46;font-weight:bold">${formatVnd(p.price)}</span>${p.originalPrice && p.originalPrice > p.price ? ` <del style="font-size:12px;color:#9a8f8c">${formatVnd(p.originalPrice)}</del>` : ""}
<div style="margin-top:8px"><a href="${escapeHtml(url)}" style="font-size:13px;color:#6e2b46">Xem sản phẩm</a></div></td></tr></table></td></tr>`;
}).join("")}</table></td></tr>`;
const newsletterLayout = ({ title, bodyHtml, productsHtml = "", actionLabel, actionUrl, token }) => {
  const { page } = unsubscribeLinks(token);
  return `<!doctype html><html lang="vi"><body style="margin:0;background:#f7f1ec;font-family:Arial,sans-serif;color:#2d2326">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" style="max-width:560px;background:#fff;border-radius:14px;padding:32px">
<tr><td style="font-family:'Brush Script MT',cursive;font-size:30px;color:#6e2b46">sandwich beauty</td></tr>
<tr><td style="padding-top:18px;font-size:21px;font-weight:bold;line-height:1.35">${escapeHtml(title)}</td></tr>
<tr><td style="padding-top:14px">${bodyHtml}</td></tr>
${productsHtml}
${actionUrl ? `<tr><td style="padding:22px 0 6px"><a href="${escapeHtml(actionUrl)}" style="background:#6e2b46;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:bold;display:inline-block">${escapeHtml(actionLabel)}</a></td></tr>` : ""}
<tr><td style="padding-top:26px;border-top:1px solid #eee3dc;font-size:12px;line-height:1.6;color:#8b7f7c">Bạn nhận được email này vì đã đăng ký nhận bản tin tại sandwich beauty<br>
Không muốn nhận nữa? <a href="${escapeHtml(page)}" style="color:#6e2b46">Hủy nhận bản tin</a></td></tr>
</table></td></tr></table></body></html>`;
};
const newsletterText = ({ title, content, products = [], token }) => [
  title, "", String(content || "").trim(),
  ...products.map((p) => `- ${p.name}: ${formatVnd(p.price)} ${frontendUrl(`/products/${encodeURIComponent(p.slug || "")}`)}`),
  "", `Hủy nhận bản tin: ${unsubscribeLinks(token).page}`,
].join("\n");

const WELCOME_CONTENT = "Cảm ơn bạn đã đăng ký nhận bản tin của sandwich beauty\n\nTừ nay bạn sẽ nhận được thông tin sản phẩm mới, mã giảm giá và các mẹo chăm sóc da phù hợp từng loại da. Chúng tôi chỉ gửi khi có nội dung thật sự hữu ích, không gửi dồn dập\n\nTrong lúc chờ, bạn có thể thử Phân tích da bằng ảnh để biết làn da đang cần gì";
const sendNewsletterWelcome = (subscriber) => {
  const title = "Chào mừng bạn đến với sandwich beauty";
  return sendMail({
    to: subscriber.email, subject: "Bạn đã đăng ký nhận bản tin sandwich beauty",
    text: newsletterText({ title, content: WELCOME_CONTENT, token: subscriber.unsubscribeToken }),
    html: newsletterLayout({ title, bodyHtml: paragraphs(WELCOME_CONTENT), actionLabel: "Phân tích da miễn phí", actionUrl: frontendUrl("/skin-analysis"), token: subscriber.unsubscribeToken }),
    headers: newsletterHeaders(subscriber.unsubscribeToken),
  });
};
const sendNewsletterIssue = (subscriber, campaign) => sendMail({
  to: subscriber.email, subject: campaign.subject,
  text: newsletterText({ title: campaign.subject, content: campaign.content, products: campaign.products, token: subscriber.unsubscribeToken }),
  html: newsletterLayout({ title: campaign.subject, bodyHtml: paragraphs(campaign.content), productsHtml: productCards(campaign.products), actionLabel: "Mua sắm ngay", actionUrl: frontendUrl("/products"), token: subscriber.unsubscribeToken }),
  headers: newsletterHeaders(subscriber.unsubscribeToken),
});

const setMailTransportForTests = (fn) => { transportOverride = fn; };
const isMailConfigured = () => Boolean(mailProvider());

module.exports = { mailProvider, smtpConfig, sendMail, sendPasswordResetMail, sendVerifyMail, sendNewsletterWelcome, sendNewsletterIssue, unsubscribeLinks, setMailTransportForTests, isMailConfigured, MailError };
