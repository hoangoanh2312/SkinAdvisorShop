"use strict";
require("dotenv").config({ quiet: true });
const { businessUriFrom, businessDatabaseName } = require("../config/businessDatabase");
const { assertTestDatabaseUri, databaseName } = require("../utils/testDatabase");

const demoDatabaseName = () => {
  const name = String(process.env.SKINORA_DEMO_DB_NAME || "skinora_baove_test").trim();
  if (!/^skinora_[a-z0-9_]+_test$/i.test(name) || name.length > 63) {
    throw new Error("DEMO_DATABASE_NAME_MUST_BE_SKINORA_*_TEST");
  }
  return name;
};

function defenseDemoConfig() {
  const sourceName = businessDatabaseName(process.env);
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI_MISSING_CHECK_BACKEND_ENV");
  const productionUri = businessUriFrom(process.env.MONGO_URI, sourceName);
  const demoName = demoDatabaseName();
  const demoUri = assertTestDatabaseUri(productionUri.replace(
    /^(mongodb(?:\+srv)?:\/\/[^/]+\/)[^?]+/i,
    (_match, prefix) => `${prefix}${encodeURIComponent(demoName)}`
  ));
  if (databaseName(productionUri) === databaseName(demoUri)) throw new Error("SOURCE_AND_TARGET_MUST_DIFFER");
  return { sourceName, demoName, productionUri, demoUri };
}

module.exports = { defenseDemoConfig, demoDatabaseName };
