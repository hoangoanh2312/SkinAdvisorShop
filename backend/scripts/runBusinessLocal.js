require("dotenv").config({ quiet: true });
const { targetUri } = require("./initializeBusinessDatabase");
const name = process.env.BUSINESS_DB_NAME || "skinora_prod";
process.env.MONGO_URI = targetUri(process.env.MONGO_URI, name);
require("../server").startServer({ ensureOrderIdempotencyIndex: true }).catch(error => {
  console.error(`Business server failed: ${error.code || error.name || "UNKNOWN"}`);
  process.exitCode = 1;
});
