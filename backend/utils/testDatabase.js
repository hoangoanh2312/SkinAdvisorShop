const databaseName = uri => {
  const value = String(uri || "");
  const match = value.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/i);
  return match ? decodeURIComponent(match[1]) : "";
};

const withDatabase = (uri, name) => {
  if (!databaseName(uri)) throw new Error("TEST_DATABASE_URI_INVALID");
  return String(uri).replace(/^(mongodb(?:\+srv)?:\/\/[^/]+\/)[^?]+/i, `$1${encodeURIComponent(name)}`);
};

const assertTestDatabaseUri = uri => {
  const name = databaseName(uri);
  if (!name.toLowerCase().endsWith("_test")) throw new Error(`REFUSING_NON_TEST_DATABASE:${name || "missing"}`);
  return uri;
};

const resolveTestMongoUri = (env = process.env) => {
  const explicit = env.TEST_MONGO_URI;
  if (explicit) return assertTestDatabaseUri(explicit);
  const source = env.MONGO_URI;
  const sourceName = databaseName(source);
  if (!sourceName) throw new Error("TEST_MONGO_URI_NOT_CONFIGURED");
  return assertTestDatabaseUri(withDatabase(source, `${sourceName}_test`));
};

const createIsolatedTestMongoUri = (env = process.env, token = String(process.pid)) => {
  const base = resolveTestMongoUri(env);
  const baseName = databaseName(base).replace(/_test$/i, "");
  const safeToken = String(token).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || String(process.pid);
  return assertTestDatabaseUri(withDatabase(base, `${baseName}_${safeToken}_test`));
};

const connectTestDatabase = async mongoose => {
  const uri = resolveTestMongoUri();
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = uri;
  return mongoose.connect(uri);
};

module.exports = { assertTestDatabaseUri, connectTestDatabase, createIsolatedTestMongoUri, databaseName, resolveTestMongoUri };
