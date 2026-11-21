/* Offline: nhập kho bằng Excel — đọc .xlsx/.csv, đối chiếu mã hàng, báo lỗi từng dòng. Không cần MongoDB */
const assert = require("node:assert/strict");
const zlib = require("zlib");
const Product = require("../models/Product");
const Variant = require("../models/Variant");
const { readSpreadsheet } = require("../utils/spreadsheetReader");
const { planImport, parseSize, toInt } = require("../services/inventoryImport");

// Tạo file .xlsx nhỏ ngay trong test (zip có nén deflate, chuỗi dùng chung)
function makeXlsx(rows) {
  const strings = []; const idx = (s) => { let i = strings.indexOf(s); if (i < 0) { strings.push(s); i = strings.length - 1; } return i; };
  const col = (n) => String.fromCharCode(65 + n);
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => v === "" ? "" : typeof v === "number" ? `<c r="${col(ci)}${ri + 1}"><v>${v}</v></c>` : `<c r="${col(ci)}${ri + 1}" t="s"><v>${idx(v)}</v></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const sst = `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${strings.map((s) => `<si><t>${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</t></si>`).join("")}</sst>`;
  const files = { "xl/worksheets/sheet1.xml": sheet, "xl/sharedStrings.xml": sst };
  const locals = []; const centrals = []; let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = Buffer.from(text); const data = zlib.deflateRawSync(raw); const nameBuf = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(raw.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(raw.length, 24); central.writeUInt16LE(nameBuf.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data); centrals.push(central, nameBuf); offset += 30 + nameBuf.length + data.length;
  }
  const cd = Buffer.concat(centrals); const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 8); end.writeUInt16LE(2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const q = (rows) => ({ select() { return this; }, session() { return this; }, lean: async () => rows });
(async () => {
  const p1 = { _id: "p1", name: "Cocoon Dầu tẩy trang hoa hồng", slug: "cocoon-dau-tay-trang-hoa-hong" };
  const variants = [{ _id: "v310", sku: "COCOON-310ML", name: "310ml", product: "p1", price: 339000, salePrice: null, stock: 6 }];
  const orig = { vf: Variant.find, pf: Product.find };
  Variant.find = (filter) => q(filter.sku ? variants.filter((v) => filter.sku.$in.includes(v.sku)) : variants.filter((v) => filter.product.$in.includes(String(v.product))));
  Product.find = () => q([p1]);
  try {
    assert.deepEqual(parseSize("140 ml"), { size: "140", unit: "ml", name: "140ml" });
    assert.deepEqual(parseSize("454g"), { size: "454", unit: "g", name: "454g" });
    assert.equal(toInt("177.000"), 177000); assert.equal(toInt("177,000đ"), 177000); assert.ok(Number.isNaN(toInt("12.5")));

    const file = makeXlsx([
      ["Phiếu nhập kho tháng 11"],
      ["Mã hàng", "Số lượng nhập", "Giá bán", "Giá giảm", "Sản phẩm", "Dung tích", "Ghi chú"],
      ["cocoon-310ml", 20, "", 299000, "", "", "Lô 11/2026"],
      ["COCOON-140ML", 15, "177.000", 150000, "cocoon-dau-tay-trang-hoa-hong", "140 ml", ""],
      ["COCOON-500ML", 5, 450000, "", "Không có sản phẩm này", "500ml", ""],
      ["COCOON-310ML", 1, "", "", "", "", ""],
      ["COCOON-999ML", -3, "", "", "", "", ""],
      ["", "", "", "", "", "", ""],
    ]);
    const rows = readSpreadsheet(file, "nhap-kho.xlsx");
    const plan = await planImport(rows);
    const by = (line) => plan.items.find((i) => i.line === line);
    assert.equal(by(3).action, "update"); assert.equal(by(3).after.stock, 26); assert.equal(by(3).after.salePrice, 299000); assert.deepEqual(by(3).errors, []);
    assert.equal(by(4).action, "create"); assert.equal(by(4).name, "140ml"); assert.equal(by(4).after.price, 177000); assert.deepEqual(by(4).errors, []);
    assert.match(by(5).errors.join(), /Không tìm thấy sản phẩm/);
    assert.match(by(6).errors.join(), /trùng với dòng 3/);
    assert.match(by(7).errors.join(), /Số lượng nhập/);
    assert.equal(plan.totals.rows, 5); assert.equal(plan.totals.errors, 3);

    // Giá giảm không được lớn hơn giá bán, 0 = bỏ giảm giá, dung tích trùng bị chặn
    const csv = Buffer.from("﻿Mã hàng;Số lượng nhập;Giá bán;Giá giảm;Sản phẩm;Dung tích\nCOCOON-310ML;0;;400000;;\nCOCOON-NEW;3;200000;;cocoon-dau-tay-trang-hoa-hong;310 ml\n");
    const plan2 = await planImport(readSpreadsheet(csv, "a.csv"));
    assert.match(plan2.items[0].errors.join(), /phải nhỏ hơn giá bán/);
    assert.match(plan2.items[1].errors.join(), /đã có dung tích 310ml/);
    const plan3 = await planImport(readSpreadsheet(Buffer.from("Mã hàng,Giá giảm\nCOCOON-310ML,0\n"), "b.csv"));
    assert.equal(plan3.items[0].action, "skip", "giá giảm đang trống, đặt 0 thì không có gì đổi");
    const noHeader = await planImport([["abc", "def"]]); assert.match(noHeader.error, /Mã hàng/);
    assert.throws(() => readSpreadsheet(Buffer.from("x"), "a.xls"), /UNSUPPORTED_FILE/);
  } finally { Variant.find = orig.vf; Product.find = orig.pf; }
  console.log("SKINORA_INVENTORY_IMPORT_OFFLINE_PASS: xlsx/csv import plans receipts, price changes and new sizes with per-row errors");
})().catch((e) => { console.error(e); process.exitCode = 1; });
