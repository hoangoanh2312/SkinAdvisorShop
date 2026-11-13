const mongoose = require("mongoose");
const { createApp } = require("../app");
const { assertTestDatabaseUri, createIsolatedTestMongoUri } = require("./testDatabase");

const startTestServer = async () => {
  const uri = createIsolatedTestMongoUri(process.env, process.pid);
  process.env.NODE_ENV = "test";
  process.env.MONGO_URI = uri;
  await mongoose.connect(uri);
  await Promise.all(mongoose.modelNames().map(name => mongoose.model(name).createIndexes()));
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const close = async () => {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    if (mongoose.connection.readyState !== 0) {
      assertTestDatabaseUri(mongoose.connection.client.s.url);
      await mongoose.connection.dropDatabase();
      await mongoose.connection.close();
    }
  };
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}`, close, databaseName: mongoose.connection.name };
};
module.exports = { startTestServer };
