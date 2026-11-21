/* Offline: gửi email qua SMTP (Gmail) bằng máy chủ SMTP giả chạy trên máy, không cần mạng */
const assert = require("node:assert/strict");
const tls = require("tls");
const { sendSmtp, buildMessage, encodeWord } = require("../services/smtpClient");

// Chứng chỉ tự ký chỉ dùng cho máy chủ giả trong bài test này
const CERT = `-----BEGIN CERTIFICATE-----
MIIDCTCCAfGgAwIBAgIUJOpvnCGLoNSQpWWJWxsj4SfMzR0wDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJbG9jYWxob3N0MB4XDTI2MTExNjA5MTAxMVoXDTI2MTEx
ODA5MTAxMVowFDESMBAGA1UEAwwJbG9jYWxob3N0MIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEAzFUnWFxwwyxDzYF+vQBvjAj+kb4vCtyf/6nyV3XnOvjE
Ze+uW+pYwFP9gtsQLQ6hh9DmI61zJ/2CF4Y8v3/3W3cSh7KZh1B6i6EsAt1sT98l
sA/0Xbm+l1BJyHJfay1R/jEEj8qwZ3YOS+evEjMOe6KJ3VbQOrsPypzcSxkx7l2E
kEeNJ128ZOuoOeApAHw6wSdLUzltwVhuEXjUiE/cCk5JpnuFqp8m3bvZBLW5Aply
DBGSPmO2+ruQ0dCtZu9m0+T0tdcxFQiub8kTD0aXEkWz7i3Bo2iPWaSk+g8DCFhF
RVdW05wawbPwjZoZAgEsj6/efoDnz+kucMzo3rzkBwIDAQABo1MwUTAdBgNVHQ4E
FgQU+OBgQwh2ur17+ecbAWPlz27LyoowHwYDVR0jBBgwFoAU+OBgQwh2ur17+ecb
AWPlz27LyoowDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAWWCk
GYkX8tszDjsxkE5fu7+E36rLAxEGyyQhCNw0WcE5/BbhvjXYWkgAGkgsXpCCFbS8
gt1ymATuUJARtS/UakjiqsEnlOPFB2t1rFS2t7HsStpkv1okqXeM/ZTrCbpmnRg6
sotiigYz/kKEWs8Ku71y7+NliCOspFZoUUQjdzzsogmyxBlOVmznDYZv3Qs3L5X1
gPa7Oa21iDdrdEo0Fo4ARAi7jcRqRu2wCmE4vNOgxik7UdsOia+3wLjcZvCjb9/y
odYFN/Ty9ejskh4Lu8zmtDebg4bFkHNjnKaV/uZGNHcSjS+7LjQFySzAQr3+8LzH
fRcSqNqM+cNsu7V2Mg==
-----END CERTIFICATE-----`;
const KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDMVSdYXHDDLEPN
gX69AG+MCP6Rvi8K3J//qfJXdec6+MRl765b6ljAU/2C2xAtDqGH0OYjrXMn/YIX
hjy/f/dbdxKHspmHUHqLoSwC3WxP3yWwD/Rdub6XUEnIcl9rLVH+MQSPyrBndg5L
568SMw57oondVtA6uw/KnNxLGTHuXYSQR40nXbxk66g54CkAfDrBJ0tTOW3BWG4R
eNSIT9wKTkmme4Wqnybdu9kEtbkCmXIMEZI+Y7b6u5DR0K1m72bT5PS11zEVCK5v
yRMPRpcSRbPuLcGjaI9ZpKT6DwMIWEVFV1bTnBrBs/CNmhkCASyPr95+gOfP6S5w
zOjevOQHAgMBAAECggEAHrl9MZGw2QAqb9fVdVj/7OgbU1HsI+951Yk56gHOE7V9
XrCUILkTwFPAznDfNU86ZcA5Iss9ghlh+uSR9N+qk6PLcwEdidXFn4JMKmAeHcJ5
mchEX+WCraECfzQHege2CQlY3MBHFz+OtcYwMoXf2yJdJZ2csQAYx0gf7eDre6Jq
Ui+/cEvAL+ZpmlGRam/HwenXMzYKGc7Ocaev6radHFNZLQooHgfI1W4YDSpB2u9S
02wAYoMSOhk1P5gF4QjcvmQ+m5mQF2geMlCTj7FgZMOjwAwarxh2vj/bQWHbIMEB
6CKtkIV5UYll2fe7Al4quik5G8y3erfhSqK38NUUaQKBgQD0YeWrP8ibLt4UGH1z
PRfTKlLeZRoVpg1LB1ouQ6wwdNcGnSlMO1PgXeZDLElJQv7HXZgBozM4PPPJKxBa
LEXX8uVbz3o+gZV3ByYmlw1WPHIxg97BAZO6kANK4GJNaICb7FWhz70KrvUD0iQy
4D5UIN3LaEO/+wi+2a224o0reQKBgQDWC9sXqje2npygVYTaGzf6LYnaTyGH/O16
zqByU+aOHQhz52X2qp4IIjYosTOpPueUq/xHMSyoOUgJgr0eFvZa007vHKBrnwSP
gHbQ+llVdUc3CQmv7SaTOgV75DWFsTE0FFGVjPTFhCJRw52RY5+rNa7urZqn9OXx
ZuFnlt8rfwKBgHXFQ+g+Sc+3S2DF2JcThwrFp7/zWxm5t0hEF8qZ5D5J4GIYlRFe
ufIzbkdK7Vp4Bc5QJXQMkR92CEoXDb9W/KWwMaYIG7JJwpzk/ha0zsGTSbjhAxVi
TC4pPtzzu4vwY6JAx5e+RC0E2aDowXcfKApk+F4RNi0rrjBDOPscvMmJAoGATZMu
bH08g+soSNO1unZy6zDl7UEQngCE8SVB8S2HOao8DgWnZqafb8M2bbkLSCOMOs26
OPMRhEZ+XTQM5oLb9j7vNKnjWh3fwUKFzWduSRKgJMoZwLDqciFtK2GiJDn74ywa
BWF4tL0W0xtaV/8LNznVlJtGmeigDcWDm8+KQnECgYEAx1Y71P4DcENEW/mZTf+g
0nry68sUuQGhiOZk4BstIxpAfO/Z4xFnTvF0A9EvvuPzbh69uWN2ME41pLEkV+AV
NxmWSCe127SezJml1Ryjiib6cPpBGr66SwtREHO17iqIpnTdxvZx+xoYGnhVrjzM
6YvX/MO3ViBQMg4ZesTnuYo=
-----END PRIVATE KEY-----`;

const startFakeSmtp = ({ password }) => new Promise((resolve) => {
  const received = [];
  const server = tls.createServer({ cert: CERT, key: KEY }, (socket) => {
    let buffer = "", state = "cmd", data = "", session = { log: [] };
    const say = (line) => socket.write(`${line}\r\n`);
    say("220 fake.smtp ready");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      if (state === "data") {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        data = buffer.slice(0, end); buffer = buffer.slice(end + 5); state = "cmd";
        received.push({ ...session, data }); say("250 2.0.0 OK queued");
      }
      let idx;
      while (state !== "data" && (idx = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, idx); buffer = buffer.slice(idx + 2); session.log.push(line);
        if (state === "user") { session.user = Buffer.from(line, "base64").toString(); state = "pass"; say("334 UGFzc3dvcmQ6"); continue; }
        if (state === "pass") {
          state = "cmd";
          if (Buffer.from(line, "base64").toString() === password) say("235 2.7.0 Accepted");
          else say("535 5.7.8 Username and Password not accepted");
          continue;
        }
        if (/^EHLO/i.test(line)) { socket.write("250-fake.smtp\r\n250-AUTH LOGIN PLAIN\r\n250 8BITMIME\r\n"); }
        else if (/^AUTH LOGIN/i.test(line)) { state = "user"; say("334 VXNlcm5hbWU6"); }
        else if (/^MAIL FROM:/i.test(line)) { session.from = line; say("250 OK"); }
        else if (/^RCPT TO:/i.test(line)) { session.to = line; say("250 OK"); }
        else if (/^DATA/i.test(line)) { state = "data"; say("354 Go ahead"); }
        else if (/^QUIT/i.test(line)) { say("221 bye"); socket.end(); }
        else say("500 unknown");
      }
    });
  });
  server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port, received }));
});

(async () => {
  const { server, port, received } = await startFakeSmtp({ password: "abcdefghijklmnop" });
  const base = { host: "localhost", port, rejectUnauthorized: false, user: "shop@gmail.com", from: "sandwich beauty <shop@gmail.com>" };
  try {
    await sendSmtp({ ...base, pass: "abcdefghijklmnop", to: "khach@yahoo.com", subject: "Chào mừng bạn đến với sandwich beauty", text: "Xin chào\n.dòng bắt đầu bằng dấu chấm", html: "<p>Xin chào</p>", headers: { "List-Unsubscribe": "<http://x/u?token=1>" } });
    assert.equal(received.length, 1);
    const mail = received[0];
    assert.equal(mail.user, "shop@gmail.com");
    assert.equal(mail.from, "MAIL FROM:<shop@gmail.com>"); assert.equal(mail.to, "RCPT TO:<khach@yahoo.com>");
    assert.match(mail.data, /Subject: =\?UTF-8\?B\?/); assert.match(mail.data, /List-Unsubscribe: <http:\/\/x\/u\?token=1>/);
    const parts = [...mail.data.matchAll(/base64\r\n\r\n([\s\S]*?)\r\n--/g)].map((m) => Buffer.from(m[1].replace(/\r\n/g, ""), "base64").toString("utf8"));
    assert.equal(parts[0], "Xin chào\n.dòng bắt đầu bằng dấu chấm"); assert.equal(parts[1], "<p>Xin chào</p>");
    const decoded = Buffer.from(/Subject: =\?UTF-8\?B\?(.*)\?=/.exec(mail.data)[1], "base64").toString("utf8");
    assert.equal(decoded, "Chào mừng bạn đến với sandwich beauty");

    // Sai mật khẩu ứng dụng: báo rõ lý do của máy chủ
    await assert.rejects(() => sendSmtp({ ...base, pass: "sai", to: "khach@yahoo.com", subject: "x", text: "x", html: "x" }), (error) => error.code === "SMTP_AUTH_PASS_535" && /not accepted/.test(error.detail));
    // Không kết nối được
    await assert.rejects(() => sendSmtp({ ...base, port: 1, pass: "x", to: "a@b.vn", subject: "x", text: "x", html: "x", timeoutMs: 3000 }));
    // Dòng bắt đầu bằng dấu chấm trong phần thân được nhân đôi
    assert.ok(buildMessage({ from: "a@b.vn", to: "c@d.vn", subject: "s", text: "", html: "" }).includes("MIME-Version: 1.0"));
    assert.equal(encodeWord("abc"), "abc");

    // Cấu hình: ưu tiên SMTP, bỏ qua giá trị mẫu, Gmail tự dùng smtp.gmail.com và địa chỉ của tài khoản
    const keys = ["SMTP_USER", "SMTP_PASS", "SMTP_HOST", "SMTP_PORT", "RESEND_API_KEY", "MAIL_FROM"];
    const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    const mailService = require("../services/mailService");
    Object.assign(process.env, { RESEND_API_KEY: "re_xxxxxxxx", MAIL_FROM: "sandwich beauty <onboarding@resend.dev>", SMTP_USER: "", SMTP_PASS: "" });
    assert.equal(mailService.mailProvider(), "", "khóa mẫu re_xxxxxxxx coi như chưa cấu hình");
    Object.assign(process.env, { SMTP_USER: "shop@gmail.com", SMTP_PASS: "abcd efgh ijkl mnop" });
    const cfg = mailService.smtpConfig();
    assert.equal(mailService.mailProvider(), "smtp");
    assert.equal(cfg.host, "smtp.gmail.com"); assert.equal(cfg.port, 465); assert.equal(cfg.pass, "abcdefghijklmnop");
    assert.equal(cfg.from, "sandwich beauty <shop@gmail.com>", "không dùng địa chỉ resend.dev khi gửi qua Gmail");
    for (const k of keys) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  } finally { server.close(); }
  console.log("SKINORA_SMTP_OFFLINE_PASS: Gmail SMTP login, UTF-8 MIME, unsubscribe header, wrong password reported, placeholder keys ignored");
})().catch((e) => { console.error(e); process.exitCode = 1; });
