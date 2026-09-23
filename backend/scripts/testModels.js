require("dotenv").config({ quiet: true });

const mongoose = require("mongoose");
const connectDB = require("../config/db");

// This verification script must not create indexes or otherwise mutate Atlas.
mongoose.set("autoIndex", false);

const models = [
  ["User", require("../models/User")],
  ["Category", require("../models/Category")],
  ["Product", require("../models/Product")],
  ["Variant", require("../models/Variant")],
  ["Review", require("../models/Review")],
  ["Voucher", require("../models/Voucher")],
  ["Order", require("../models/Order")],
];

const testModels = async () => {
  try {
    await connectDB();

    for (const [name, model] of models) {
      if (model.modelName !== name) {
        throw new Error(`${name} model failed to load`);
      }
      console.log(`${name} model loaded`);
    }

    console.log("All models loaded successfully");
  } catch (error) {
    console.error(`Model test failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  }
};

testModels();
