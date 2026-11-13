require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const User = require("../models/User");
const { databaseName } = require("../utils/testDatabase");
const { businessUriFrom } = require("../config/businessDatabase");

const targetName = process.env.BUSINESS_DB_NAME || "skinora_prod";
const sourceName = databaseName(process.env.MONGO_URI);

function targetUri(sourceUri, name) {
  return businessUriFrom(sourceUri, name);
}

async function initialize({ apply = false } = {}) {
  // This is ONLY a one-time Admin copy. Never copy into the current database.
  if (!sourceName || /_test$/i.test(sourceName) || sourceName === targetName) throw new Error("SOURCE_DATABASE_UNSAFE");
  const uri = targetUri(process.env.MONGO_URI, targetName);
  const source = await mongoose.createConnection(process.env.MONGO_URI).asPromise();
  const target = await mongoose.createConnection(uri).asPromise();
  try {
    const SourceUser = source.model("User", User.schema);
    const TargetUser = target.model("User", User.schema);
    const admin = await SourceUser.findOne({ email: "admin@skinora.com", role: "admin", isActive: true }).select("+password fullName email role isActive").lean();
    if (!admin?.password?.startsWith("$2")) throw new Error("ACTIVE_ADMIN_WITH_BCRYPT_HASH_REQUIRED");
    const collections = await target.db.listCollections().toArray();
    const existing = {};
    for (const collection of collections) existing[collection.name] = await target.db.collection(collection.name).estimatedDocumentCount();
    const hasData = Object.values(existing).some(count => count > 0);
    if (apply && hasData) throw new Error("TARGET_DATABASE_NOT_EMPTY");
    if (apply) {
      await TargetUser.createIndexes();
      await TargetUser.create({ fullName: admin.fullName, email: admin.email, password: admin.password, role: "admin", isActive: true });
    }
    return { sourceDatabase: source.name, targetDatabase: target.name, targetCollections: existing, adminAvailable: Boolean(admin), adminCopied: apply };
  } finally { await Promise.all([source.close(), target.close()]); }
}

if (require.main === module) initialize({ apply: process.argv.includes("--apply") }).then(result => console.log(JSON.stringify(result, null, 2))).catch(error => { console.error(`Business database setup stopped: ${error.message}`); process.exitCode = 1; });
module.exports = { initialize, targetUri };
