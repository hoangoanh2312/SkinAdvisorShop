/**
 * Optional, idempotent taxonomy setup for a separate business database.
 * Does not add fake products, orders, stock, prices or media.
 * Dry-run is the default. Explicit --apply is required for inserts.
 */
require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const Brand = require("../models/Brand");
const Category = require("../models/Category");
const { targetUri } = require("./initializeBusinessDatabase");

const categories = [
  ["Serum / Tinh chất", "serum-tinh-chat"],
  ["Sữa rửa mặt", "sua-rua-mat"],
  ["Toner / Nước cân bằng", "toner-nuoc-can-bang"],
  ["Kem dưỡng", "kem-duong"],
  ["Kem chống nắng", "kem-chong-nang"],
  ["Tẩy trang", "tay-trang"],
  ["Mặt nạ", "mat-na"],
  ["Tẩy tế bào chết", "tay-te-bao-chet"],
  ["Chăm sóc mụn", "cham-soc-mun"],
  ["Chăm sóc phục hồi", "cham-soc-phuc-hoi"],
];
const brands = [
  ["Hada Labo", "hada-labo"],
  ["CeraVe", "cerave"],
  ["La Roche-Posay", "la-roche-posay"],
  ["Bioderma", "bioderma"],
  ["Anessa", "anessa"],
  ["COSRX", "cosrx"],
  ["SKIN1004", "skin1004"],
  ["Paula's Choice", "paulas-choice"],
  ["The Ordinary", "the-ordinary"],
  ["Cocoon", "cocoon"],
];

async function prepareList(Model, entries, apply) {
  const existing = await Model.find({ slug: { $in: entries.map(([, slug]) => slug) } }).select("slug").lean();
  const present = new Set(existing.map(row => row.slug));
  const absent = entries.filter(([, slug]) => !present.has(slug));
  if (apply) {
    for (const [name, slug] of absent) {
      // Avoid overwriting operator-managed entries. Ignore unique index races.
      try { await Model.create({ name, slug, isActive: true }); }
      catch (error) { if (error?.code !== 11000) throw error; }
    }
  }
  return { alreadyPresent: existing.length, plannedToCreate: absent.length, entries: absent.map(([name, slug]) => ({ name, slug })) };
}

async function bootstrap({ apply = false, uri } = {}) {
  const uriToUse = uri || targetUri(process.env.MONGO_URI, process.env.BUSINESS_DB_NAME || "skinora_prod");
  const connection = await mongoose.connect(uriToUse, { autoIndex: false, serverSelectionTimeoutMS: 10000 });
  try {
    if (!/_prod$/i.test(connection.connection.name)) throw new Error("REFUSING_NON_BUSINESS_DATABASE");
    const categoryResult = await prepareList(Category, categories, apply);
    const brandResult = await prepareList(Brand, brands, apply);
    return { database: connection.connection.name, apply, categories: categoryResult, brands: brandResult };
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) {
  bootstrap({ apply: process.argv.includes("--apply") })
    .then(report => console.log(JSON.stringify(report, null, 2)))
    .catch(error => { console.error(`Business taxonomy setup stopped: ${error.message}`); process.exitCode = 1; });
}
module.exports = { bootstrap, categories, brands };
