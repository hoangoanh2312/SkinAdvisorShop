"use strict";
// Launch this project's existing Express server connected ONLY to the isolated _test DB.
// Do not change server.js or backend/.env to point production at test.
const { defenseDemoConfig } = require("./defenseDemoConfig");
try {
  const { demoName, demoUri } = defenseDemoConfig();
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = demoUri;
  process.env.BUSINESS_DB_NAME = "skinora_prod"; // ignored in NODE_ENV=test
  console.log(`SKINORA BAO VE DEMO ONLY | Database: ${demoName} | COD testing, no real payments`);
  require("../server").startServer().catch((error) => {
    console.error(`DEMO_SERVER_START_FAILED: ${error.code || "UNKNOWN"}`);
    process.exitCode = 1;
  });
} catch (error) {
  console.error(`DEMO_START_BLOCKED: ${error.message}`);
  process.exitCode = 1;
}
