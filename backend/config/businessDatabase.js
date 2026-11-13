/** One source of truth for which MongoDB database the live backend uses.
 * Old development MONGO_URI values are accepted only as a connection template.
 * Nothing here deletes, copies or migrates records.
 */
const { databaseName, assertTestDatabaseUri } = require("../utils/testDatabase");

const businessDatabaseName = (env = process.env) => {
  const name = String(env.BUSINESS_DB_NAME || "skinora_prod");
  if (!/^[a-z][a-z0-9_]*_prod$/i.test(name)) throw new Error("BUSINESS_DB_NAME_INVALID");
  return name;
};

const businessUriFrom = (sourceUri, name = "skinora_prod") => {
  if (!/^[a-z][a-z0-9_]*_prod$/i.test(name)) throw new Error("BUSINESS_DB_NAME_INVALID");
  const sourceDatabase = databaseName(sourceUri);
  if (!sourceDatabase) throw new Error("MONGO_URI_MUST_INCLUDE_DATABASE_NAME");
  if (/_test$/i.test(sourceDatabase)) throw new Error("REFUSING_TEST_DATABASE_AS_BUSINESS_SOURCE");
  return String(sourceUri).replace(
    /^(mongodb(?:\+srv)?:\/\/[^/]+\/)[^?]+/i,
    (_match, prefix) => `${prefix}${encodeURIComponent(name)}`
  );
};

const configureLiveDatabase = (env = process.env) => {
  // Integration tests remain strictly isolated and never get retargeted to production.
  if (env.NODE_ENV === "test") {
    assertTestDatabaseUri(env.MONGO_URI);
    return databaseName(env.MONGO_URI);
  }
  const name = businessDatabaseName(env);
  env.MONGO_URI = businessUriFrom(env.MONGO_URI, name);
  return name;
};

module.exports = { businessDatabaseName, businessUriFrom, configureLiveDatabase };
