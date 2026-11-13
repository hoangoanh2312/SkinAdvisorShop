require("dotenv").config({ quiet: true });
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const mongoose = require("mongoose");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { targetUri } = require("./initializeBusinessDatabase");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const frontend = "http://127.0.0.1:5173";
const pages = [
  ["/admin", "Tổng quan"], ["/admin/products", "Quản lý sản phẩm"],
  ["/admin/products/new", "Thêm sản phẩm mới"],
  ["/admin/categories", "Danh mục"], ["/admin/brands", "Thương hiệu"],
  ["/admin/users", "Khách hàng"], ["/admin/orders", "Đơn hàng"],
  ["/admin/vouchers", "Mã giảm giá"],
];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connectDebugger(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(item => item.type === "page");
  if (!target) throw new Error("BROWSER_PAGE_NOT_FOUND");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const entry = pending.get(message.id); pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { call, close: () => socket.close() };
}

async function run() {
  if (!fs.existsSync(chromePath)) throw new Error("CHROME_NOT_INSTALLED");
  const uri = targetUri(process.env.MONGO_URI, process.env.BUSINESS_DB_NAME || "skinora_prod");
  await mongoose.connect(uri);
  const admin = await User.findOne({ email: "admin@skinora.com", role: "admin", isActive: true });
  if (!admin) throw new Error("BUSINESS_ADMIN_NOT_FOUND");
  const token = generateToken(admin);
  await mongoose.disconnect();
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "skinora-browser-"));
  const chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
  let debuggerClient;
  try {
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let attempt = 0; attempt < 50 && !fs.existsSync(portFile); attempt++) await delay(200);
    if (!fs.existsSync(portFile)) throw new Error("CHROME_DEBUGGER_NOT_READY");
    const port = Number(fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0]);
    debuggerClient = await connectDebugger(port);
    await debuggerClient.call("Page.enable");
    await debuggerClient.call("Runtime.enable");
    await debuggerClient.call("Page.navigate", { url: frontend });
    await delay(1200);
    await debuggerClient.call("Runtime.evaluate", { expression: `localStorage.setItem("skinora_token", ${JSON.stringify(token)})` });
    for (const width of [1366, 390]) {
      await debuggerClient.call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      for (const [url, expected] of pages) {
        await debuggerClient.call("Page.navigate", { url: `${frontend}${url}` });
        let state = { text: "", overflow: false };
        for (let attempt = 0; attempt < 30; attempt++) {
          await delay(350);
          const result = await debuggerClient.call("Runtime.evaluate", { expression: `JSON.stringify({text:document.body.innerText,overflow:document.documentElement.scrollWidth>window.innerWidth})`, returnByValue: true });
          if (result.result?.value) state = JSON.parse(result.result.value);
          if (state.text.includes(expected) && !state.text.includes("Đang tải")) break;
        }
        const ok = state.text.includes(expected) && !state.overflow && !state.text.includes("Chưa có API") && !state.text.includes("Backend chưa có API");
        console.log(`${width}px ${url}: ${ok ? "PASS" : "FAIL"}, overflow=${state.overflow}`);
        if (!ok) throw new Error(`ADMIN_BROWSER_PAGE_FAILED:${url}:${state.text.slice(0, 220).replace(/\s+/g, " ")}`);
      }
    }
  } finally {
    debuggerClient?.close();
    chrome.kill();
    await delay(500);
    if (profile.startsWith(os.tmpdir() + path.sep)) fs.rmSync(profile, { recursive: true, force: true });
  }
}

run().catch(error => { console.error(`Admin browser verification failed: ${error.message}`); process.exitCode = 1; });
