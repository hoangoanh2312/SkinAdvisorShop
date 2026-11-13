/** Read-only production catalog browser audit. No mutation routes are mounted. */
require("dotenv").config({ quiet: true });
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { protect, authorize } = require("../middleware/authMiddleware");
const { getMe } = require("../controllers/authController");
const { listAdminProducts } = require("../controllers/adminController");
const { businessDatabaseName, businessUriFrom } = require("../config/businessDatabase");
const generateToken = require("../utils/generateToken");
const quotes = require("../data/catalog48VerifiedRetailQuotes20261023.json");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const frontendDir = path.resolve(__dirname, "../../frontend");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  if (!fs.existsSync(chromePath)) throw new Error("CHROME_NOT_INSTALLED");
  const dbName = businessDatabaseName(process.env);
  assert.equal(dbName, "skinora_prod");
  mongoose.set("autoIndex", false);
  await mongoose.connect(businessUriFrom(process.env.MONGO_URI, dbName), { autoIndex: false });
  let api, vite, chrome, socket, profile;
  try {
    assert.equal(mongoose.connection.name, dbName);
    const products = await Product.find({ slug: { $in: quotes.map(item => item.slug) } }).select("name slug images basePrice isActive").lean();
    const variants = await Variant.find({ product: { $in: products.map(item => item._id) } }).select("product sku size unit price salePrice stock").lean();
    assert.equal(products.length, 48); assert.equal(variants.length, 48);
    const byProduct = new Map(products.map(item => [String(item._id), item]));
    const expected = new Map(variants.map(item => [item.sku, { product: byProduct.get(String(item.product)), variant: item }]));
    const admin = await User.findOne({ email: "admin@skinora.com", role: "admin", isActive: true }).select("_id");
    if (!admin) throw new Error("ACTIVE_ADMIN_NOT_FOUND");
    const app = express();
    app.use(require("cors")());
    app.get("/api/auth/me", protect, getMe);
    app.get("/api/admin/products", protect, authorize("admin"), listAdminProducts);
    app.use("/api", (_req, res) => res.status(405).json({ success: false, message: "READ_ONLY_AUDIT" }));
    api = app.listen(0, "127.0.0.1");
    await new Promise(resolve => api.once("listening", resolve));
    const vitePort = await new Promise((resolve, reject) => { const server = require("node:net").createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); });
    const viteUrl = `http://127.0.0.1:${vitePort}`;
    vite = spawn(process.execPath, [path.join(frontendDir, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"], { cwd: frontendDir, env: { ...process.env, VITE_API_URL: `http://127.0.0.1:${api.address().port}/api` }, windowsHide: true, stdio: "ignore" });
    for (let i = 0; i < 60; i++) { try { if ((await fetch(viteUrl)).ok) break; } catch {} await delay(250); }
    profile = fs.mkdtempSync(path.join(os.tmpdir(), "skinora-catalog-readonly-"));
    chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let i = 0; i < 60 && !fs.existsSync(portFile); i++) await delay(200);
    if (!fs.existsSync(portFile)) throw new Error("CHROME_DEBUGGER_NOT_READY");
    const debugPort = Number(fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0]);
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    socket = new WebSocket(targets.find(item => item.type === "page").webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let id = 0; const pending = new Map();
    socket.onmessage = event => { const message = JSON.parse(event.data); const waiter = pending.get(message.id); if (!waiter) return; pending.delete(message.id); message.error ? waiter.reject(new Error(message.error.message)) : waiter.resolve(message.result); };
    const call = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; pending.set(key, { resolve, reject }); socket.send(JSON.stringify({ id: key, method, params })); });
    const evaluate = async expression => { const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw new Error("BROWSER_EVALUATION_FAILED"); return result.result?.value; };
    const wait = async expression => { for (let i = 0; i < 60; i++) { if (await evaluate(expression)) return; await delay(200); } const state = await evaluate("({path:location.pathname,body:document.body?.innerText?.slice(0,300)})"); throw new Error(`BROWSER_WAIT_TIMEOUT:${expression}:${JSON.stringify(state)}`); };
    await call("Page.enable"); await call("Runtime.enable");
    await call("Page.navigate", { url: viteUrl });
    await wait("document.querySelector('#root') !== null");
    await evaluate(`localStorage.setItem('skinora_token',${JSON.stringify(generateToken(admin))})`);
    const seen = new Set(); const imageIssues = new Map();
    for (const width of [390, 768, 1366]) {
      await call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      await call("Page.navigate", { url: `${viteUrl}/admin/products` });
      await wait("document.querySelector('.admin-products-table tbody tr') !== null");
      for (let page = 1; page <= 3; page++) {
        await wait(`document.querySelector('.admin-pager span')?.textContent.includes('Trang ${page}/3') === true`);
        await evaluate("Promise.all([...document.querySelectorAll('.admin-products-table tbody img')].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});setTimeout(resolve,5000)})))");
        const state = await evaluate("({ rows:[...document.querySelectorAll('.admin-products-table tbody tr')].map(row=>({text:row.innerText,image:row.querySelector('img')?.src||'',complete:row.querySelector('img')?.complete,loaded:row.querySelector('img')?.naturalWidth>0})),overflow:document.documentElement.scrollWidth>innerWidth })");
        assert.equal(state.overflow, false, `${width}px root overflow`);
        for (const row of state.rows) {
          const match = [...expected].find(([sku]) => row.text.includes(sku));
          assert.ok(match, `Unknown/missing SKU in browser row at ${width}px`);
          const [sku, { product, variant }] = match;
          assert.ok(row.text.includes(product.name), `${sku} name`);
          assert.ok(row.text.includes(`${variant.size} ${variant.unit}`.trim()), `${sku} size`);
          assert.ok(row.text.includes(variant.price > 0 ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(variant.salePrice ?? variant.price) : "Chưa có giá"), `${sku} price`);
          assert.ok(row.text.includes(String(variant.stock)), `${sku} stock`);
          assert.ok(row.text.includes(product.isActive ? "Đang bán" : "Chưa bán"), `${sku} status`);
          assert.equal(row.image, product.images[0], `${sku} image URL`);
          if (!row.loaded) imageIssues.set(sku, { host: new URL(row.image).host, complete: row.complete });
          seen.add(sku);
        }
        if (page < 3) { await evaluate("document.querySelector('.admin-pager button:last-child').click()"); await delay(300); }
      }
      assert.equal(seen.size, 48, `${width}px visible SKU count`);
      console.log(`${width}px: 48/48 catalog rows match production Product/Variant; root overflow=false`);
    }
    console.log(`READ_ONLY_BROWSER_AUDIT database=${dbName} rows=48 imageIssues=${imageIssues.size} sample=${JSON.stringify([...imageIssues].slice(0, 5))}`);
    if (imageIssues.size) throw new Error(`IMAGE_LOAD_ISSUES:${imageIssues.size}`);
    console.log("READ_ONLY_BROWSER_AUDIT_PASS");
  } finally {
    socket?.close(); chrome?.kill(); vite?.kill();
    if (api?.listening) await new Promise(resolve => api.close(resolve));
    await delay(500);
    if (profile?.startsWith(os.tmpdir() + path.sep)) fs.rmSync(profile, { recursive: true, force: true });
    await mongoose.disconnect();
  }
}
run().catch(error => { console.error(`READ_ONLY_BROWSER_AUDIT_FAIL:${error.message}`); process.exitCode = 1; });
