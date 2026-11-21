// Gửi email qua SMTP (ví dụ Gmail) chỉ bằng thư viện có sẵn của Node, không cần cài thêm gói npm.
// Dùng kết nối TLS ngay từ đầu (cổng 465), xác thực AUTH LOGIN, gửi email gồm cả bản chữ thường và bản HTML.
const tls = require("tls");
const crypto = require("crypto");

class SmtpError extends Error {
  constructor(code, detail = "") { super(code); this.code = code; this.detail = detail; }
}

const b64 = (value) => Buffer.from(String(value), "utf8").toString("base64");
const wrap76 = (text) => text.replace(/.{1,76}/g, "$&\r\n");
// Tiêu đề và tên người gửi có dấu tiếng Việt phải mã hóa theo RFC 2047
const encodeWord = (value) => /^[\x20-\x7e]*$/.test(value) ? value : `=?UTF-8?B?${b64(value)}?=`;
const parseAddress = (value) => {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value || "");
  return match ? { name: match[1].replace(/^"|"$/g, ""), email: match[2].trim() } : { name: "", email: String(value || "").trim() };
};
const formatAddress = ({ name, email }) => name ? `${encodeWord(name)} <${email}>` : email;
const safeHeader = (value) => String(value).replace(/[\r\n]+/g, " ");

const buildMessage = ({ from, to, subject, text, html, headers = {} }) => {
  const boundary = `sb_${crypto.randomBytes(12).toString("hex")}`;
  const domain = parseAddress(from).email.split("@")[1] || "localhost";
  const lines = [
    `From: ${formatAddress(parseAddress(from))}`,
    `To: ${to}`,
    `Subject: ${encodeWord(safeHeader(subject))}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
    ...Object.entries(headers).map(([key, value]) => `${safeHeader(key)}: ${safeHeader(value)}`),
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(text || "")),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap76(b64(html || "")),
    `--${boundary}--`,
    "",
  ];
  // Dòng bắt đầu bằng dấu chấm phải nhân đôi (dot-stuffing) để không bị hiểu là kết thúc email
  return lines.join("\r\n").replace(/\r\n\./g, "\r\n..");
};

// Đọc từng phản hồi SMTP (có thể nhiều dòng "250-...", kết thúc bằng "250 ...")
const createReader = (socket) => {
  let buffer = "";
  const waiting = [];
  const replies = [];
  const flush = () => {
    while (true) {
      const lines = buffer.split("\r\n");
      let end = -1;
      for (let i = 0; i < lines.length - 1; i += 1) if (/^\d{3} /.test(lines[i])) { end = i; break; }
      if (end === -1) return;
      const block = lines.slice(0, end + 1);
      buffer = lines.slice(end + 1).join("\r\n");
      const reply = { code: Number(block[end].slice(0, 3)), text: block.map((line) => line.slice(4)).join(" ") };
      if (waiting.length) waiting.shift().resolve(reply); else replies.push(reply);
    }
  };
  socket.on("data", (chunk) => { buffer += chunk.toString("utf8"); flush(); });
  let dead = null;
  const failAll = (error) => { dead = dead || error; while (waiting.length) waiting.shift().reject(dead); };
  socket.on("error", failAll);
  socket.on("close", () => failAll(new SmtpError("SMTP_CONNECTION_CLOSED", "Máy chủ SMTP đóng kết nối")));
  return () => {
    if (replies.length) return Promise.resolve(replies.shift());
    if (dead) return Promise.reject(dead);
    return new Promise((resolve, reject) => waiting.push({ resolve, reject }));
  };
};

const sendSmtp = ({ host, port = 465, user, pass, from, to, subject, text, html, headers, timeoutMs = 20000, rejectUnauthorized = true }) => new Promise((resolve, reject) => {
  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized });
  socket.setTimeout(timeoutMs, () => socket.destroy(new SmtpError("SMTP_TIMEOUT", "Hết thời gian chờ máy chủ SMTP")));
  const next = createReader(socket);
  const expect = async (codes, step) => {
    const reply = await next();
    if (!codes.includes(reply.code)) throw new SmtpError(`SMTP_${step}_${reply.code}`, reply.text.slice(0, 300));
    return reply;
  };
  const command = (line, codes, step) => { socket.write(`${line}\r\n`); return expect(codes, step); };
  (async () => {
    await expect([220], "GREETING");
    await command(`EHLO ${host === "localhost" ? "localhost" : "sandwich-beauty"}`, [250], "EHLO");
    await command("AUTH LOGIN", [334], "AUTH");
    await command(b64(user), [334], "AUTH_USER");
    await command(b64(pass), [235], "AUTH_PASS");
    await command(`MAIL FROM:<${parseAddress(from).email}>`, [250], "MAIL_FROM");
    await command(`RCPT TO:<${parseAddress(to).email}>`, [250, 251], "RCPT_TO");
    await command("DATA", [354], "DATA");
    const reply = await command(`${buildMessage({ from, to, subject, text, html, headers })}\r\n.`, [250], "SEND");
    socket.write("QUIT\r\n");
    socket.end();
    return reply;
  })().then(resolve, (error) => {
    socket.destroy();
    reject(error instanceof SmtpError ? error : new SmtpError("SMTP_FAILED", String(error?.message || error)));
  });
});

module.exports = { sendSmtp, buildMessage, encodeWord, parseAddress, SmtpError };
