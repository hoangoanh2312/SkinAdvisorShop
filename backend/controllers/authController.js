const bcrypt = require("bcryptjs");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publicUser = (user) => ({
  _id: user._id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  avatar: user.avatar,
  role: user.role,
  skinProfile: user.skinProfile,
  addresses: user.addresses,
  isActive: user.isActive,
  createdAt: user.createdAt,
});

const register = async (req, res) => {
  try {
    const fullName = typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Họ tên, email và mật khẩu là bắt buộc",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ" });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Mật khẩu phải có ít nhất 6 ký tự",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Máy chủ chưa được cấu hình xác thực",
      });
    }

    const existingUser = await User.exists({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email đã được sử dụng",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: "customer",
    });

    return res.status(201).json({
      success: true,
      message: "Đăng ký tài khoản thành công",
      data: {
        user: publicUser(user),
        token: generateToken(user),
      },
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email đã được sử dụng",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Không thể đăng ký tài khoản",
    });
  }
};

const login = async (req, res) => {
  try {
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (!email || !password || !EMAIL_PATTERN.test(email)) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        success: false,
        message: "Máy chủ chưa được cấu hình xác thực",
      });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: "Email hoặc mật khẩu không chính xác",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Tài khoản đã bị vô hiệu hóa",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: {
        user: publicUser(user),
        token: generateToken(user),
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      message: "Không thể đăng nhập",
    });
  }
};

const getMe = (req, res) =>
  res.status(200).json({
    success: true,
    data: { user: publicUser(req.user) },
  });

module.exports = { register, login, getMe };
