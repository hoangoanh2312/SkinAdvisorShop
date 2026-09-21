const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Vui lòng đăng nhập để tiếp tục",
    });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: "Máy chủ chưa được cấu hình xác thực",
    });
  }

  const token = authorization.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token xác thực không hợp lệ hoặc đã hết hạn",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Tài khoản không còn tồn tại",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị vô hiệu hóa",
      });
    }

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Token xác thực không hợp lệ hoặc đã hết hạn",
    });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Bạn không có quyền thực hiện thao tác này",
    });
  }

  return next();
};

module.exports = { protect, authorize };
