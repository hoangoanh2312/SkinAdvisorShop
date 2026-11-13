require("dotenv").config({ quiet: true });
const assert = require("assert");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const net = require("net");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const { startTestServer } = require("../utils/testServer");
const User = require("../models/User");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const Order = require("../models/Order");
const generateToken = require("../utils/generateToken");
const { setCloudinaryAdapterForTests } = require("../controllers/productImageController");
const { setSkinAnalysisProviderForTests } = require("../services/skinAnalysis/skinAnalysisService");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const frontendDir = path.resolve(__dirname, "../../frontend");
const imagePath = path.resolve(__dirname, "../assets/demo-products/serum.png");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () => new Promise((resolve, reject) => { const server = net.createServer(); server.once("error", reject); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); });

async function debuggerClient(port) {
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = targets.find(item => item.type === "page");
  if (!target) throw new Error("BROWSER_PAGE_NOT_FOUND");
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      const exception = result.exceptionDetails;
      const detail = exception.exception?.description || exception.exception?.value || exception.text || "Uncaught";
      throw new Error(`BROWSER_JS_ERROR: ${detail}`);
    }
    return result.result?.value;
  };
  return { call, evaluate, close: () => socket.close() };
}

async function run() {
  if (!fs.existsSync(chromePath)) throw new Error("CHROME_NOT_INSTALLED");
  process.env.JWT_SECRET ||= "catalog-browser-acceptance-secret";
  const test = await startTestServer();
  let vite, chrome, browser, profile;
  try {
    assert(test.databaseName.endsWith("_test"));
    const admin = await User.create({ fullName: "Acceptance Admin", email: `admin.${randomUUID()}@example.test`, password: await bcrypt.hash(randomUUID(), 10), role: "admin", isActive: true });
    const adminToken = generateToken(admin);
    let uploads = 0;
    setCloudinaryAdapterForTests({
      upload: async (_file, productId) => { uploads += 1; const publicId = `skinora/products/${productId}/acceptance-${uploads}`; return { url: `https://res.cloudinary.com/skinora-test/image/upload/${publicId}.png`, publicId, format: "png", width: 400, height: 400, bytes: 1000 }; },
      destroy: async () => ({ result: "ok" }),
    });
    const vitePort = await freePort();
    const viteUrl = `http://127.0.0.1:${vitePort}`;
    vite = spawn(process.execPath, [path.join(frontendDir, "node_modules/vite/bin/vite.js"), "--host", "127.0.0.1", "--port", String(vitePort), "--strictPort"], { cwd: frontendDir, env: { ...process.env, VITE_API_URL: `${test.baseUrl}/api` }, windowsHide: true, stdio: "ignore" });
    let viteReady = false;
    for (let attempt = 0; attempt < 60; attempt++) { try { viteReady = (await fetch(viteUrl)).ok; if (viteReady) break; } catch {} await delay(250); }
    if (!viteReady) throw new Error("TEST_VITE_NOT_READY");
    profile = fs.mkdtempSync(path.join(os.tmpdir(), "skinora-acceptance-"));
    chrome = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
    const portFile = path.join(profile, "DevToolsActivePort");
    for (let attempt = 0; attempt < 50 && !fs.existsSync(portFile); attempt++) await delay(200);
    if (!fs.existsSync(portFile)) throw new Error("CHROME_DEBUGGER_NOT_READY");
    browser = await debuggerClient(Number(fs.readFileSync(portFile, "utf8").split(/\r?\n/)[0]));
    await browser.call("Page.enable"); await browser.call("Runtime.enable");
    const evaluate = browser.evaluate;
    const wait = async (expression, label) => {
      let lastError = "";
      for (let attempt = 0; attempt < 70; attempt++) {
        try { if (await evaluate(expression)) return; }
        catch (error) { lastError = error.message; }
        await delay(200);
      }
      const page = await evaluate("({ url: location.href, readyState: document.readyState, root: Boolean(document.querySelector('#root')), body: (document.body?.innerText || '').slice(0, 350) })")
        .catch(error => ({ diagnosticError: error.message }));
      throw new Error(`BROWSER_WAIT_FAILED:${label}: ${JSON.stringify(page)}${lastError ? ` | lastError=${lastError}` : ""}`);
    };
    const navigate = async (route, expected) => { await browser.call("Page.navigate", { url: `${viteUrl}${route}` }); await wait(`document.body?.innerText?.includes(${JSON.stringify(expected)})`, route); };
    // Serialize browser-side values as JSON rather than interpolating them into JS string literals.
    // Selectors such as input[aria-label='Mới tên phiên bản'] contain apostrophes.
    const setValue = async (selector, value) => evaluate(`(() => { const args=${JSON.stringify({selector, value})}; const el=document.querySelector(args.selector); if(!el) throw new Error('INPUT_NOT_FOUND:' + args.selector); const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto,'value').set.call(el,args.value); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true})); return true; })()`);
    const click = async selector => evaluate(`(() => { const selector=${JSON.stringify(selector)}; const el=document.querySelector(selector); if(!el) throw new Error('CLICK_NOT_FOUND:' + selector); el.click(); return true; })()`);
    const clickText = async (scope, label) => evaluate(`(() => { const args=${JSON.stringify({scope, label})}; const root=document.querySelector(args.scope); const buttons=[...(root?.querySelectorAll('button')||[])]; const el=buttons.find(item=>item.textContent.trim()===args.label); if(!el) throw new Error('BUTTON_NOT_FOUND:' + args.label + '; scope=' + args.scope + '; path=' + location.pathname + '; available=' + JSON.stringify(buttons.map(item=>({text:item.textContent.trim(),disabled:item.disabled})).slice(0,20))); if(el.disabled) throw new Error('BUTTON_DISABLED:' + args.label); el.click(); return true; })()`);
    const waitDb = async (query, label) => { for (let attempt = 0; attempt < 70; attempt++) { const value = await query(); if (value) return value; await delay(200); } throw new Error(`DB_WAIT_FAILED:${label}`); };

    await browser.call("Page.navigate", { url: viteUrl });
    // Vite/React may be usable before every external image/resource has completed.
    // Wait for the actual mounted homepage rather than document.readyState === 'complete'.
    await wait("document.querySelector('#root')?.innerText?.includes('Hiểu làn da') === true", "home");
    await evaluate(`localStorage.setItem('skinora_token',${JSON.stringify(adminToken)})`);
    await navigate("/admin/brands", "Thương hiệu");
    await setValue(".admin-editor label:nth-of-type(1) input", "Acceptance Brand");
    await setValue(".admin-editor label:nth-of-type(2) input", "acceptance-brand");
    await clickText(".admin-editor", "Thêm thương hiệu");
    const brand = await waitDb(() => Brand.findOne({ slug: "acceptance-brand" }), "brand create");
    await wait("document.body.innerText.includes('Acceptance Brand')", "brand UI");
    await clickText("table", "Sửa");
    // React cập nhật giao diện bất đồng bộ: chờ nút Lưu thay đổi xuất hiện.
    await wait("[...document.querySelectorAll('.admin-editor-actions button')].some(button => button.textContent.trim() === 'Lưu thay đổi')", "brand editor ready");
    await setValue(".admin-editor label:nth-of-type(1) input", "Acceptance Brand Updated");
    await clickText(".admin-editor", "Lưu thay đổi");
    await waitDb(() => Brand.findOne({ _id: brand._id, name: "Acceptance Brand Updated" }), "brand edit");

    await navigate("/admin/categories", "Danh mục");
    await setValue(".admin-editor label:nth-of-type(1) input", "Acceptance Category");
    await setValue(".admin-editor label:nth-of-type(2) input", "acceptance-category");
    await clickText(".admin-editor", "Thêm danh mục");
    const category = await waitDb(() => Category.findOne({ slug: "acceptance-category" }), "category create");
    await wait("document.body.innerText.includes('Acceptance Category')", "category UI");
    await clickText("table", "Sửa");
    await wait("[...document.querySelectorAll('.admin-editor-actions button')].some(button => button.textContent.trim() === 'Lưu thay đổi')", "category editor ready");
    await setValue(".admin-editor label:nth-of-type(1) input", "Acceptance Category Updated");
    await clickText(".admin-editor", "Lưu thay đổi");
    await waitDb(() => Category.findOne({ _id: category._id, name: "Acceptance Category Updated" }), "category edit");

    await navigate("/admin/products/new", "Thêm sản phẩm mới");
    await wait("document.querySelectorAll('#brand-options option').length>0", "brand options");
    await setValue("input[name=name]", "Acceptance Serum");
    await setValue("input[name=slug]", "acceptance-serum");
    await setValue("input[name=brand]", "Acceptance Brand Updated");
    await setValue("select[name=category]", String(category._id));
    await setValue("input[name=basePrice]", "150000");
    await browser.call("DOM.enable");
    const document = await browser.call("DOM.getDocument");
    const node = await browser.call("DOM.querySelector", { nodeId: document.root.nodeId, selector: ".product-images-manager input[type=file][multiple]" });
    if (!node.nodeId) throw new Error("PRODUCT_IMAGE_INPUT_NOT_FOUND");
    await browser.call("DOM.setFileInputFiles", { nodeId: node.nodeId, files: [imagePath] });
    await wait("document.body.innerText.includes('Chờ tải lên')", "image preview");
    await wait("document.querySelector('.admin-product-save-actions button[type=submit]')?.textContent.trim() === 'Lưu sản phẩm'", "create product save ready");
    await clickText(".admin-product-save-actions", "Lưu sản phẩm");
    // Giao diện mới có hộp thoại xác nhận trước khi tạo sản phẩm.
    await wait("document.querySelector('[role=dialog]') !== null", "create product modal");
    await clickText("[role=dialog]", "Xác nhận tạo sản phẩm");
    const product = await waitDb(() => Product.findOne({ slug: "acceptance-serum", "imageAssets.0": { $exists: true } }), "product + image upload");
    assert.strictEqual(product.brandRef.toString(), String(brand._id));
    assert.strictEqual(product.category.toString(), String(category._id));
    assert.strictEqual(product.brand, "Acceptance Brand Updated");
    assert.strictEqual(uploads, 1);
    await wait(`location.pathname.includes(${JSON.stringify(`/admin/products/${product._id}/edit`)})`, "product edit navigation");
    // Sau khi tạo mới và upload ảnh, trang sửa phải về trạng thái lưu thông thường.
    // Ngăn trạng thái 'Thử tải ảnh lại' tồn đọng từ màn hình tạo sản phẩm.
    await wait("document.querySelector('.admin-product-save-actions button[type=submit]')?.textContent.trim() === 'Lưu sản phẩm'", "edit product save ready");
    await wait(`document.querySelector(${JSON.stringify("input[aria-label='Mới tên phiên bản']")}) !== null`, "variant editor ready");
    await setValue("input[aria-label='Mới tên phiên bản']", "Chai 100 ml");
    await setValue("input[aria-label='Mới SKU']", "ACCEPT-100");
    await setValue("input[aria-label='Mới dung tích']", "100");
    await setValue("input[aria-label='Mới giá']", "150000");
    await setValue("input[aria-label='Mới giá giảm']", "120000");
    await setValue("input[aria-label='Mới tồn kho']", "2");
    await clickText(".variant-admin", "Thêm phiên bản");
    const variant = await waitDb(() => Variant.findOne({ sku: "ACCEPT-100" }), "variant create");
    assert.strictEqual(variant.size, "100"); assert.strictEqual(variant.unit, "ml"); assert.strictEqual(variant.salePrice, 120000); assert.strictEqual(variant.stock, 2);
    // DB có thể ghi xong trước khi React nhận phản hồi và kết thúc trạng thái 'Đang lưu...'.
    // Chờ giao diện nhận SKU, hoàn tất tác vụ, và cập nhật điều kiện được bật bán.
    await wait("[...document.querySelectorAll('.variant-admin .admin-editor strong')].some(el => el.textContent.includes('Chai 100 ml'))", "variant visible in React");
    await wait("[...document.querySelectorAll('.variant-admin .admin-editor button')].every(el => !el.disabled && el.textContent.trim() !== 'Đang lưu...')", "variant editor idle");
    // A product created from Admin starts as a draft. Publish only after the verified variant exists.
    assert.strictEqual((await Product.findById(product._id)).isActive, false);
    await wait("document.querySelector('.admin-form-grid aside.form-card label.check-inline input[type=checkbox]')?.disabled === false", "publish available after image and stock load");
    await click(".admin-form-grid aside.form-card label.check-inline input[type=checkbox]");
    await wait("document.querySelector('.admin-form-grid aside.form-card label.check-inline input[type=checkbox]')?.checked === true", "publish checkbox");
    await wait("document.querySelector('.admin-product-save-actions button[type=submit]')?.textContent.trim() === 'Lưu sản phẩm' && !document.querySelector('.admin-product-save-actions button[type=submit]').disabled", "publish save ready");
    await clickText(".admin-product-save-actions", "Lưu sản phẩm");
    await wait("document.querySelector('[role=dialog]') !== null", "edit product modal");
    await clickText("[role=dialog]", "Xác nhận lưu");
    await waitDb(() => Product.findOne({ _id: product._id, isActive: true }), "publish complete product");
    console.log("Browser Admin: brand/category create+edit, product+image+variant+publish PASS (isolated test DB, Cloudinary mock)");

    await navigate("/products", "Acceptance Serum");
    await navigate(`/products/${product._id}`, "Acceptance Serum");
    await clickText(".purchase-row", "Thêm vào giỏ hàng");
    await navigate("/cart", "Acceptance Serum");
    await click(".cart-item .qty button:last-child");
    await wait("document.querySelector('.cart-item .qty span')?.textContent==='2'", "cart increase");
    await click(".cart-item .qty button:first-child");
    await wait("document.querySelector('.cart-item .qty span')?.textContent==='1'", "cart decrease");
    await clickText(".cart-item", "Xóa");
    await wait("document.body.innerText.includes('Giỏ hàng đang trống')", "cart remove");
    await navigate(`/products/${product._id}`, "Acceptance Serum");
    await clickText(".purchase-row", "Thêm vào giỏ hàng");

    await navigate("/register", "Tạo tài khoản mới");
    const customerEmail = `customer.${randomUUID()}@example.test`;
    await setValue("input[name=fullName]", "Acceptance Customer");
    await setValue("input[name=email]", customerEmail);
    await setValue("input[name=password]", "Acceptance@12345");
    await setValue("input[name=confirmPassword]", "Acceptance@12345");
    await clickText(".auth-form", "Tạo tài khoản");
    const customer = await waitDb(() => User.findOne({ email: customerEmail }), "customer register");
    assert.strictEqual(customer.role, "customer");
    await wait("location.pathname==='/profile'", "register redirect");
    await evaluate("localStorage.removeItem('skinora_token');localStorage.removeItem('skinora_user')");
    await navigate("/login", "Chào mừng bạn trở lại");
    await setValue("input[type=email]", customerEmail);
    await setValue("input[type=password]", "Acceptance@12345");
    await clickText(".auth-form", "Đăng nhập");
    await wait("location.pathname==='/profile'", "customer login");
    // Gio hang duoc luu rieng theo tai khoan: hang da them trong phien Admin
    // khong duoc tu dong chuyen sang tai khoan khach moi dang nhap.
    await navigate("/cart", "Giỏ hàng đang trống");
    // Khach hang phai tu them san pham vao gio cua chinh minh truoc khi checkout.
    await navigate(`/products/${product._id}`, "Acceptance Serum");
    await clickText(".purchase-row", "Thêm vào giỏ hàng");
    const customerCartKey = `skinora_cart_customer_${encodeURIComponent(String(customer._id))}`;
    await wait(`JSON.parse(localStorage.getItem(${JSON.stringify(customerCartKey)}) || '[]').some(item => item.variantId === ${JSON.stringify(String(variant._id))})`, "customer cart persisted");
    await navigate("/cart", "Acceptance Serum");
    const customerToken = generateToken(customer);
    const request = async (route, method, token, body) => {
      const response = await fetch(`${test.baseUrl}/api${route}`, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    const address = await request("/users/me/addresses", "POST", customerToken, { fullName: "Acceptance Customer", phone: "0900000000", province: "Hà Nội", ward: "Phường Test", address: "Số 1 đường Test", label: "Nhà", isDefault: true });
    assert.strictEqual(address.status, 201);
    const voucherCode = `ACCEPT${Date.now()}`;
    const voucher = await request("/vouchers", "POST", adminToken, { code: voucherCode, discountType: "percent", discountValue: 10, minOrderValue: 100000, maxDiscount: 20000, startDate: new Date(Date.now() - 3600000).toISOString(), endDate: new Date(Date.now() + 86400000).toISOString(), usageLimit: 5, perUserLimit: 1, isActive: true });
    assert.strictEqual(voucher.status, 201);
    await navigate("/checkout", "Hoàn tất đơn hàng");
    await wait("document.body.innerText.includes('Acceptance Customer')", "checkout address");
    await setValue("input[aria-label='Mã giảm giá']", voucherCode);
    await clickText(".checkout-voucher", "Áp dụng");
    await wait(`document.body.innerText.includes(${JSON.stringify(`Đã áp dụng ${voucherCode}`)})`, "voucher apply");
    await clickText(".order-summary", "Đặt hàng");
    await wait("document.body.innerText.includes('Đặt hàng thành công')", "COD success");
    const order = await waitDb(() => Order.findOne({ user: customer._id, paymentMethod: "COD" }).select("+stockDeducted"), "COD order");
    assert.strictEqual(order.total, 108000);
    assert.strictEqual(order.stockDeducted, true);
    assert.strictEqual((await Variant.findById(variant._id)).stock, 1);
    const overstock = await request("/orders", "POST", customerToken, { items: [{ variantId: String(variant._id), quantity: 2 }], shippingAddress: { fullName: "Acceptance Customer", phone: "0900000000", province: "Hà Nội", ward: "Phường Test", address: "Số 1 đường Test" }, paymentMethod: "COD" });
    assert.strictEqual(overstock.status, 400);
    assert.strictEqual(await Order.countDocuments({ user: customer._id }), 1);
    await navigate("/orders", order.orderCode);
    await navigate(`/orders/${order._id}`, order.orderCode);
    await navigate("/products?q=Acceptance", "Acceptance Serum");
    await navigate(`/products?category=${category.slug}`, "Acceptance Serum");
    console.log("Browser Customer: register/login, product/cart, voucher, COD checkout PASS; stock/overstock API PASS");

    await Product.updateOne({ _id: product._id }, { $set: { skinTypes: ["oily"], skinConcerns: ["acne"] } });
    const [inactiveAiProduct, noStockAiProduct] = await Product.create([
      { name: "Inactive AI Test", slug: "inactive-ai-test", brand: brand.name, category: category._id, basePrice: 100000, skinTypes: ["oily"], skinConcerns: ["acne"], isActive: false },
      { name: "Out Of Stock AI Test", slug: "out-of-stock-ai-test", brand: brand.name, category: category._id, basePrice: 100000, skinTypes: ["oily"], skinConcerns: ["acne"], isActive: true },
    ]);
    const [inactiveAiVariant, noStockAiVariant] = await Variant.create([
      { product: inactiveAiProduct._id, name: "30 ml", sku: "ACCEPT-AI-INACTIVE", price: 100000, stock: 2 },
      { product: noStockAiProduct._id, name: "30 ml", sku: "ACCEPT-AI-NOSTOCK", price: 100000, stock: 0 },
    ]);
    setSkinAnalysisProviderForTests(async () => ({ skinType: "oily", confidence: 0.8, concerns: [{ key: "acne", confidence: 0.8 }], recommendedIngredients: [], warnings: [], analysisSource: "mock_vision" }));
    await navigate("/skin-analysis", "Phân tích đặc điểm da");
    await clickText(".analysis-tabs", "Tải ảnh lên");
    const invalidInput = await browser.call("DOM.getDocument");
    const invalidNode = await browser.call("DOM.querySelector", { nodeId: invalidInput.root.nodeId, selector: "#skin-image-upload" });
    await browser.call("DOM.setFileInputFiles", { nodeId: invalidNode.nodeId, files: [__filename] });
    await wait("document.querySelector('.analysis-error')?.innerText.includes('JPG')", "invalid image rejected");
    await browser.call("DOM.setFileInputFiles", { nodeId: invalidNode.nodeId, files: [imagePath] });
    await wait("document.querySelector('.analysis-preview img') !== null", "valid image preview");
    await click(".analysis-consent input");
    await clickText(".analysis-input-card", "Phân tích da");
    await wait("document.querySelector('.analysis-results .recommend-card')?.innerText.includes('Acceptance Serum')", "mock AI recommendation");
    assert.strictEqual(await evaluate("document.querySelector('.analysis-results')?.innerText.includes('Inactive AI Test') || document.querySelector('.analysis-results')?.innerText.includes('Out Of Stock AI Test')"), false);
    await click(".analysis-results .recommend-card a");
    await wait(`location.pathname===${JSON.stringify(`/products/${product.slug}`)}`, "AI recommendation detail");
    await navigate(`/products/${noStockAiProduct.slug}`, "Hết hàng");
    assert.strictEqual(await evaluate("document.querySelector('.purchase-row button.grow')?.disabled"), true);
    await navigate(`/products/${inactiveAiProduct.slug}`, "Không thể hiển thị sản phẩm");
    const shippingAddress = { fullName: "Acceptance Customer", phone: "0900000000", province: "Hà Nội", ward: "Phường Test", address: "Số 1 đường Test" };
    assert.strictEqual((await request("/orders", "POST", customerToken, { items: [{ variantId: String(noStockAiVariant._id), quantity: 1 }], shippingAddress, paymentMethod: "COD" })).status, 400);
    assert.strictEqual((await request("/orders", "POST", customerToken, { items: [{ variantId: String(inactiveAiVariant._id), quantity: 1 }], shippingAddress, paymentMethod: "COD" })).status, 400);
    console.log("Browser AI: invalid/valid image, consent, mocked analysis, sellable-only recommendation and detail navigation PASS");

    await evaluate(`localStorage.setItem('skinora_token',${JSON.stringify(adminToken)})`);
    await navigate("/admin/orders", order.orderCode);
    await navigate(`/admin/orders/${order._id}`, order.orderCode);
    await clickText(".admin-detail-actions", "Xác nhận đơn");
    await wait("document.querySelector('[role=dialog]') !== null", "order confirm modal");
    await clickText("[role=dialog]", "Xác nhận đơn");
    await waitDb(() => Order.findOne({ _id: order._id, orderStatus: "confirmed" }), "admin order transition");
    assert.strictEqual((await Variant.findById(variant._id)).stock, 1);
    await navigate("/admin/brands", "Acceptance Brand Updated");
    await clickText("table", "Vô hiệu hóa");
    await wait("document.querySelector('[role=dialog]') !== null", "brand deactivate modal");
    await clickText("[role=dialog]", "Xác nhận");
    await waitDb(() => Brand.findOne({ _id: brand._id, isActive: false }), "brand deactivate");
    await navigate("/admin/categories", "Acceptance Category Updated");
    await clickText("table", "Vô hiệu hóa");
    await wait("document.querySelector('[role=dialog]') !== null", "category deactivate modal");
    await clickText("[role=dialog]", "Xác nhận");
    await waitDb(() => Category.findOne({ _id: category._id, isActive: false }), "category deactivate");
    console.log("Browser Admin: order transition and brand/category deactivation PASS");
    for (const width of [390, 768, 1366]) {
      await browser.call("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 500 });
      for (const [route, expected] of [["/admin", "Tổng quan"], ["/admin/products", "Quản lý sản phẩm"], ["/admin/categories", "Danh mục"], ["/admin/brands", "Thương hiệu"], ["/admin/orders", order.orderCode], ["/admin/users", "Acceptance Customer"]]) {
        await navigate(route, expected);
        const overflow = await evaluate("document.documentElement.scrollWidth>window.innerWidth");
        assert.strictEqual(overflow, false, `${width}px ${route} horizontal overflow`);
        console.log(`${width}px ${route}: no horizontal overflow`);
      }
    }
    console.log(`Acceptance PASS on isolated database ${test.databaseName}; no business/development DB writes`);
  } finally {
    setCloudinaryAdapterForTests(null);
    setSkinAnalysisProviderForTests(null);
    browser?.close();
    chrome?.kill(); vite?.kill();
    await delay(500);
    if (profile?.startsWith(os.tmpdir() + path.sep)) fs.rmSync(profile, { recursive: true, force: true });
    await test.close();
  }
}
run().catch(error => { console.error(`Acceptance FAIL: ${error.stack || error.message}`); process.exitCode = 1; });
