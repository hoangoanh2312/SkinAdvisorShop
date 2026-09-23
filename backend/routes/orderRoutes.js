const express = require("express");
const { createOrder, getMyOrders, getOrder, cancelOrder, listAdminOrders, updateOrderStatus } = require("../controllers/orderController");
const { protect, authorize } = require("../middleware/authMiddleware");

const orderRouter = express.Router();
orderRouter.use(protect);
orderRouter.post("/", createOrder);
orderRouter.get("/my-orders", getMyOrders);
orderRouter.put("/:id/cancel", cancelOrder);
orderRouter.get("/:id", getOrder);

const adminOrderRouter = express.Router();
adminOrderRouter.use(protect, authorize("admin"));
adminOrderRouter.get("/", listAdminOrders);
adminOrderRouter.put("/:id/status", updateOrderStatus);

module.exports = { orderRouter, adminOrderRouter };
