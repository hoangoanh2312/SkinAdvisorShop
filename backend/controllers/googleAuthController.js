const bcrypt = require("bcryptjs");
const { randomBytes } = require("node:crypto");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");
const { verifyGoogleCode } = require("../services/googleOAuthService");

const safeUser = user => ({ _id: user._id, fullName: user.fullName, email: user.email, phone: user.phone, avatar: user.avatar, role: user.role, skinProfile: user.skinProfile, addresses: user.addresses, isActive: user.isActive, createdAt: user.createdAt });
const safeError = (res, error) => {
  if (error.message === "GOOGLE_NOT_CONFIGURED") return res.status(503).json({ success: false, message: "Đăng nhập Google chưa được cấu hình." });
  if (error.message === "GOOGLE_ORIGIN_NOT_ALLOWED") return res.status(403).json({ success: false, message: "Nguồn đăng nhập Google không được phép." });
  if (["GOOGLE_CODE_INVALID", "GOOGLE_ID_TOKEN_MISSING", "GOOGLE_EMAIL_UNVERIFIED"].includes(error.message) || error.response?.status === 400) return res.status(401).json({ success: false, message: "Không thể xác minh tài khoản Google. Vui lòng thử lại." });
  return res.status(503).json({ success: false, message: "Google tạm thời không khả dụng. Vui lòng thử lại sau." });
};

const googleLogin = async (req, res) => {
  if (!process.env.JWT_SECRET) return res.status(503).json({ success: false, message: "Xác thực chưa được cấu hình." });
  let profile;
  try { profile = await verifyGoogleCode(req.body?.code, req.get("Origin")); }
  catch (error) { return safeError(res, error); }
  try {
    let user = await User.findOne({ googleSub: profile.sub }).select("+googleSub");
    if (user && user.email !== profile.email) return res.status(409).json({ success: false, message: "Email Google đã thay đổi; cần hỗ trợ tài khoản." });
    if (!user) {
      if (await User.exists({ email: profile.email })) return res.status(409).json({ success: false, message: "Email đã tồn tại. Hãy đăng nhập bằng mật khẩu rồi liên kết Google trong hồ sơ." });
      const password = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
      user = await User.create({ fullName: profile.name, email: profile.email, password, googleSub: profile.sub, role: "customer" });
    }
    if (!user.isActive) return res.status(403).json({ success: false, message: "Tài khoản đã bị vô hiệu hóa." });
    if (user.role !== "customer") return res.status(403).json({ success: false, message: "Tài khoản quản trị không đăng nhập qua Google." });
    return res.json({ success: true, data: { user: safeUser(user), token: generateToken(user) } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Tài khoản đã tồn tại. Vui lòng thử đăng nhập lại." });
    return res.status(500).json({ success: false, message: "Không thể đăng nhập Google lúc này." });
  }
};

const linkGoogle = async (req, res) => {
  if (req.user.role !== "customer") return res.status(403).json({ success: false, message: "Không thể liên kết Google cho tài khoản quản trị." });
  let profile;
  try { profile = await verifyGoogleCode(req.body?.code, req.get("Origin")); }
  catch (error) { return safeError(res, error); }
  if (profile.email !== req.user.email) return res.status(409).json({ success: false, message: "Email Google phải trùng email tài khoản hiện tại." });
  try {
    const existing = await User.findOne({ googleSub: profile.sub }).select("+googleSub");
    if (existing && String(existing._id) !== String(req.user._id)) return res.status(409).json({ success: false, message: "Google đã liên kết với tài khoản khác." });
    const current = await User.findById(req.user._id).select("+googleSub");
    if (current.googleSub && current.googleSub !== profile.sub) return res.status(409).json({ success: false, message: "Tài khoản đã liên kết Google khác." });
    if (!current.googleSub) { current.googleSub = profile.sub; await current.save(); }
    return res.json({ success: true, data: { user: safeUser(current), token: generateToken(current) } });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ success: false, message: "Google đã liên kết với tài khoản khác." });
    return res.status(500).json({ success: false, message: "Không thể liên kết Google lúc này." });
  }
};

module.exports = { googleLogin, linkGoogle };
