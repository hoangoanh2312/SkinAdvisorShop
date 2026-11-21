const multer = require("multer");
const { readSpreadsheet } = require("../utils/spreadsheetReader");
const { planImport, applyImport } = require("../services/inventoryImport");
const { audit } = require("../services/adminSupport");
const { writeXlsx } = require("../utils/spreadsheetWriter");
const Variant = require("../models/Variant");

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES, files: 1, fields: 2 } }).single("file");
const parseImportFile = (req, res, next) => upload(req, res, (error) => {
  if (error?.code === "LIMIT_FILE_SIZE") return res.status(413).json({ success: false, message: "File tối đa 2 MB" });
  if (error) return res.status(400).json({ success: false, message: "File tải lên không hợp lệ" });
  if (!req.file) return res.status(400).json({ success: false, message: "Vui lòng chọn file Excel (.xlsx) hoặc CSV" });
  return next();
});

const READ_ERRORS = {
  NOT_XLSX: "File không phải Excel .xlsx hợp lệ. Nếu là file .xls cũ, hãy mở bằng Excel rồi Lưu thành .xlsx",
  BROKEN_XLSX: "File Excel bị hỏng, hãy lưu lại rồi thử lại",
  UNSUPPORTED_XLSX: "File Excel dùng kiểu nén chưa hỗ trợ, hãy lưu lại bằng Excel hoặc Google Sheets",
  XLSX_TOO_LARGE: "File Excel quá lớn",
  NO_SHEET: "Không tìm thấy trang tính nào trong file",
  UNSUPPORTED_FILE: "Chỉ nhận file .xlsx hoặc .csv",
  EMPTY_FILE: "File trống",
};
const fileName = (req) => String(req.file?.originalname || "file").replace(/[^\p{L}\p{N}._ -]/gu, "").slice(0, 80) || "file";

const publicItem = (item) => ({ line: item.line, sku: item.sku, action: item.action, productName: item.productName || "", name: item.name || "", qty: item.qty, before: item.before || null, after: item.after || null, summary: item.summary || "", errors: item.errors });

// POST /api/admin/inventory/import?mode=preview|apply
const importInventory = async (req, res) => {
  const mode = req.query.mode === "apply" ? "apply" : "preview";
  let rows;
  try { rows = readSpreadsheet(req.file.buffer, req.file.originalname); }
  catch (error) { return res.status(400).json({ success: false, message: READ_ERRORS[error.code] || "Không đọc được file" }); }
  try {
    const plan = mode === "apply" ? await applyImport(rows, { actor: req.user._id, fileName: fileName(req) }) : await planImport(rows);
    if (plan.error) return res.status(400).json({ success: false, message: plan.error });
    const data = { mode, applied: Boolean(plan.applied), totals: plan.totals, items: plan.items.map(publicItem) };
    if (mode === "apply" && !plan.applied) return res.status(400).json({ success: false, message: `Có ${plan.totals.errors} dòng lỗi, chưa ghi dòng nào. Sửa file rồi thử lại`, data });
    if (plan.applied) {
      await audit({ actor: req.user._id, action: "inventory.import", resource: "inventory", resourceId: fileName(req), method: "POST", details: `Nhập file ${fileName(req)}: ${plan.totals.updates} mã cập nhật, ${plan.totals.creates} mã mới, tổng ${plan.totals.quantity} sản phẩm` }).catch(() => {});
      return res.status(200).json({ success: true, message: `Đã nhập ${plan.totals.quantity} sản phẩm: ${plan.totals.updates} mã hàng cập nhật, ${plan.totals.creates} mã hàng mới`, data });
    }
    return res.status(200).json({ success: true, message: plan.totals.errors ? `Có ${plan.totals.errors} dòng lỗi cần sửa` : "File hợp lệ, kiểm tra lại rồi bấm Ghi vào kho", data });
  } catch (error) {
    if (error.message === "STOCK_CHANGED") return res.status(409).json({ success: false, message: `Tồn kho mã ${error.sku} vừa thay đổi (có đơn hàng mới), hãy bấm Xem trước lại rồi ghi` });
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Có mã hàng vừa được tạo trùng, hãy bấm Xem trước lại" });
    console.error(`Inventory import failed: ${error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Không thể nhập kho từ file" });
  }
};

// GET /api/admin/inventory/import-template — file Excel mẫu kèm toàn bộ mã hàng hiện có
const downloadTemplate = async (_req, res) => {
  try {
    const variants = await Variant.find().select("sku name price salePrice stock product isActive").populate("product", "name slug").sort({ sku: 1 }).lean();
    const rows = [["Mã hàng", "Sản phẩm", "Dung tích", "Tồn hiện tại", "Số lượng nhập", "Giá bán", "Giá giảm", "Ghi chú"]];
    for (const v of variants) rows.push([v.sku, v.product?.name || "", v.name, v.stock, "", v.price, v.salePrice ?? "", v.isActive ? "" : "Mã hàng đang tắt"]);
    const guide = [
      ["Hướng dẫn nhập kho bằng file Excel"],
      [""],
      ["1. Mỗi dòng ở trang Nhập kho là một mã hàng. Chỉ trang tính đầu tiên được đọc"],
      ["2. Số lượng nhập: số sản phẩm nhập thêm, được cộng vào tồn kho. Để trống hoặc 0 nếu không nhập"],
      ["3. Giá bán, Giá giảm: sửa nếu muốn đổi giá. Giá giảm = 0 để bỏ giảm giá. Đơn hàng đã đặt giữ nguyên giá lúc mua"],
      ["4. Thêm dung tích mới cho sản phẩm có sẵn: thêm dòng với Mã hàng mới, cột Sản phẩm ghi đúng tên hoặc đường dẫn sản phẩm, Dung tích (vd 140ml, 454g) và Giá bán"],
      ["5. Cột Tồn hiện tại chỉ để tham khảo, sửa cột này không có tác dụng"],
      ["6. Trên web: Quản trị → Kho hàng → Nhập từ Excel → chọn file → Xem trước → Ghi vào kho. Có dòng lỗi thì không ghi dòng nào"],
    ];
    const buffer = writeXlsx([{ name: "Nhập kho", rows, widths: [42, 40, 12, 14, 16, 14, 14, 30] }, { name: "Hướng dẫn", rows: guide, widths: [120], headerRows: 1 }]);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="mau-nhap-kho-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    return res.status(200).send(buffer);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Không thể tạo file mẫu" });
  }
};

module.exports = { importInventory, parseImportFile, downloadTemplate, MAX_FILE_BYTES };
