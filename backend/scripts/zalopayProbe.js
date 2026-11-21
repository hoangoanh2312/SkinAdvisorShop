/* Chạy: node scripts/zalopayProbe.js   (trong thư mục backend)
   Thử tạo đơn TEST 10.000đ trên ZaloPay SANDBOX với từng bộ khoá công khai và 2 kiểu gửi dữ liệu,
   để biết bộ nào được chấp nhận. Không tạo đơn hàng trong website, không mất tiền thật. */
require("dotenv").config({ quiet: true });
const crypto = require("crypto");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data, "utf8").digest("hex");
const endpoint = (process.env.ZALOPAY_ENDPOINT || "https://sb-openapi.zalopay.vn/v2").replace(/\/+$/, "");
const candidates = [
  { label: ".env hiện tại", appId: (process.env.ZALOPAY_APP_ID || "").trim(), key1: (process.env.ZALOPAY_KEY1 || "").trim() },
  { label: "sandbox 2553", appId: "2553", key1: "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL" },
  { label: "sandbox 2554", appId: "2554", key1: "sdngKKJmqEMzvh5QQcdD2A9XBSKUNaYn" },
];
const vnDate = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "2-digit", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "");
(async () => {
  console.log("Endpoint:", endpoint);
  for (const c of candidates) {
    if (!c.appId || !c.key1) { console.log(`- ${c.label}: thiếu cấu hình`); continue; }
    for (const mode of ["form", "json"]) {
      const o = { app_id: Number(c.appId), app_trans_id: `${vnDate()}_probe${Date.now()}`, app_user: "demo", app_time: Date.now(), amount: 10000, item: "[]", embed_data: "{}", description: "sandwich beauty probe", bank_code: "" };
      o.mac = hmac(c.key1, [o.app_id, o.app_trans_id, o.app_user, o.amount, o.app_time, o.embed_data, o.item].join("|"));
      try {
        const res = await fetch(`${endpoint}/create`, mode === "json"
          ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o) }
          : { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString() });
        const body = await res.json().catch(() => ({}));
        const ok = Number(body.return_code) === 1;
        console.log(`- ${c.label} (app ${c.appId}, key1 ${c.key1.slice(0, 4)}…, ${mode}): ${ok ? "OK ✅" : "LỖI ❌"} return_code=${body.return_code} ${body.return_message || ""} ${body.sub_return_message || ""}`);
      } catch (error) { console.log(`- ${c.label} (${mode}): không kết nối được (${error.cause?.code || error.message})`); }
    }
  }
})();
