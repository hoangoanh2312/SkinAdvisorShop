/* Gửi thử 1 email để kiểm tra cấu hình: npm run mail:test -- ban@gmail.com */
require("dotenv").config({ quiet: true });
const { mailProvider, smtpConfig, sendMail } = require("../services/mailService");

(async () => {
  const to = process.argv[2];
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) { console.log('Cách dùng: npm run mail:test -- email.nhan@gmail.com'); process.exitCode = 1; return; }
  const provider = mailProvider();
  if (!provider) { console.log("Chưa cấu hình gửi email: điền SMTP_USER và SMTP_PASS (Mật khẩu ứng dụng Gmail) trong backend/.env"); process.exitCode = 1; return; }
  console.log(provider === "smtp" ? `Gửi qua SMTP ${smtpConfig().host} bằng ${smtpConfig().user}` : "Gửi qua Resend");
  try {
    await sendMail({ to, subject: "Email thử từ sandwich beauty", text: "Nếu bạn đọc được email này, máy chủ đã gửi email thành công", html: "<p>Nếu bạn đọc được email này, máy chủ <b>sandwich beauty</b> đã gửi email thành công</p>" });
    console.log(`ĐÃ GỬI tới ${to}, kiểm tra hộp thư (cả mục Quảng cáo và Thư rác)`);
  } catch (error) {
    console.log(`GỬI THẤT BẠI: ${error.code}${error.detail ? ` — ${error.detail}` : ""}`);
    if (/535|AUTH/.test(error.code || "")) console.log("Gợi ý: SMTP_PASS phải là Mật khẩu ứng dụng 16 ký tự, không phải mật khẩu đăng nhập Gmail");
    process.exitCode = 1;
  }
})();
