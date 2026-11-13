require("dotenv").config({ quiet: true });
const assert = require("assert");

async function run() {
  const cleanup = require("./cleanupTestFixtures");
  assert.strictEqual(typeof cleanup.buildCleanupManifest, "function", "cleanup manifest builder must exist");
  assert.strictEqual(cleanup.isProtectedUser({ email: "admin@skinora.com" }), true);
  assert.strictEqual(cleanup.queries.Product.name.$regex.includes("SKN-DEMO"), false, "demo catalog must not be fixture cleanup data");

  const Brand = require("../models/Brand");
  const Product = require("../models/Product");
  const Voucher = require("../models/Voucher");
  const VoucherRedemption = require("../models/VoucherRedemption");
  assert(Brand.schema.path("name") && Brand.schema.path("slug") && Brand.schema.path("isActive"));
  assert(Product.schema.path("brand").instance === "String");
  assert(Product.schema.path("brandRef"), "Product.brandRef must be optional and backward compatible");
  assert(Voucher.schema.path("perUserLimit"));
  assert(VoucherRedemption.schema.indexes().some(([fields]) => fields.voucher === 1 && fields.order === 1));

  const eligibility = require("../services/voucherEligibilityService");
  const now = new Date("2026-10-09T00:00:00.000Z");
  const base = { isActive: true, startDate: new Date("2026-10-01"), endDate: new Date("2026-10-31"), usageLimit: 10, usedCount: 0, minOrderValue: 299000, discountType: "percent", discountValue: 10, maxDiscount: 50000 };
  assert.strictEqual(eligibility.calculateVoucherDiscount(base, 1000000, now), 50000);
  assert.throws(() => eligibility.calculateVoucherDiscount({ ...base, startDate: new Date("2026-10-10") }, 500000, now), /VOUCHER_EXPIRED/);
  assert.throws(() => eligibility.calculateVoucherDiscount(base, 100000, now), /VOUCHER_MIN_ORDER/);
  assert.throws(() => eligibility.calculateVoucherDiscount({ ...base, usedCount: 10 }, 500000, now), /VOUCHER_LIMIT/);

  console.log("Admin production model, cleanup manifest and voucher eligibility tests passed");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
