const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { passwordProblems, passwordMessage, normalizeFullName, NAME_MESSAGE, normalizeVnPhone, PHONE_MESSAGE } = require("../utils/inputPolicy");
const { sendPasswordResetMail, sendVerifyMail } = require("../services/mailService");
const User = require("../models/User");
const generateToken = require("../utils/generateToken");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Random one-time token; only its SHA-256 hash is stored.
const hashToken = (token) => crypto.createHash("sha256").update(String(token)).digest("hex");
const newToken = () => { const token = crypto.randomBytes(32).toString("hex"); return { token, hash: hashToken(token) }; };
const isToken = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);

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
  // Tài khoản admin do hệ thống tạo nên luôn coi là đã xác minh.
  emailVerified: user.emailVerified === true || user.role === "admin",
  hasGoogle: Boolean(user.googleSub),
  createdAt: user.createdAt,
});

const register = async (req, res) => {
  try {
    const rawName = typeof req.body.fullName === "string" ? req.body.fullName : "";
    const fullName = normalizeFullName(rawName);
    const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const password = typeof req.body.password === "string" ? req.body.password : "";

    if (rawName.trim() && !fullName) {
      return res.status(400).json({ success: false, message: NAME_MESSAGE });
    }
    if (!fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Họ tên, email và mật khẩu là bắt buộc",
      });
    }

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ" });
    }

    const problems = passwordProblems(password);
    if (problems.length) {
      return res.status(400).json({ success: false, message: passwordMessage(problems) });
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
    const verify = newToken();
    const user = await User.create({
      fullName,
      email,
      password: hashedPassword,
      role: "customer",
      emailVerified: false,
      emailVerifyTokenHash: verify.hash,
      emailVerifyExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    // Registration never fails because of e-mail delivery; the user can resend from the profile page.
    sendVerifyMail(user, verify.token).catch((error) => console.error(`Verify mail failed: ${error.code || error.name}`));

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

// POST /auth/forgot-password — same answer whether or not the e-mail exists (no account enumeration).
const forgotPassword = async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!EMAIL_PATTERN.test(email)) return res.status(400).json({ success: false, message: "Email không hợp lệ" });
  const generic = { success: true, message: "Nếu email đã đăng ký, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Vui lòng kiểm tra hộp thư (cả mục Spam)." };
  try {
    const user = await User.findOne({ email });
    if (!user || !user.isActive) return res.status(200).json(generic);
    const reset = newToken();
    user.passwordResetTokenHash = reset.hash;
    user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    await sendPasswordResetMail(user, reset.token);
    return res.status(200).json(generic);
  } catch (error) {
    console.error(`Forgot password failed: ${error.code || error.name || "Error"}`);
    return res.status(error.code === "MAIL_NOT_CONFIGURED" ? 503 : 500).json({ success: false, message: "Chưa gửi được email đặt lại mật khẩu. Vui lòng thử lại sau." });
  }
};

// POST /auth/reset-password { token, password }
const resetPassword = async (req, res) => {
  const { token, password } = req.body || {};
  if (!isToken(token)) return res.status(400).json({ success: false, message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn" });
  const problems = passwordProblems(password);
  if (problems.length) return res.status(400).json({ success: false, message: passwordMessage(problems) });
  try {
    const user = await User.findOne({ passwordResetTokenHash: hashToken(token), passwordResetExpires: { $gt: new Date() } }).select("+passwordResetTokenHash +passwordResetExpires");
    if (!user || !user.isActive) return res.status(400).json({ success: false, message: "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn" });
    user.password = await bcrypt.hash(password, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date(Date.now() - 1000); // JWT iat has 1s resolution; an immediate re-login must work
    user.emailVerified = true; // the link proved access to the inbox
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ success: true, message: "Đã đặt lại mật khẩu. Vui lòng đăng nhập bằng mật khẩu mới." });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể đặt lại mật khẩu" });
  }
};

// POST /auth/verify-email { token }
const verifyEmail = async (req, res) => {
  const { token } = req.body || {};
  if (!isToken(token)) return res.status(400).json({ success: false, message: "Liên kết xác minh không hợp lệ hoặc đã hết hạn" });
  try {
    const user = await User.findOne({ emailVerifyTokenHash: hashToken(token), emailVerifyExpires: { $gt: new Date() } }).select("+emailVerifyTokenHash +emailVerifyExpires");
    if (!user) return res.status(400).json({ success: false, message: "Liên kết xác minh không hợp lệ hoặc đã hết hạn" });
    user.emailVerified = true;
    user.emailVerifyTokenHash = undefined;
    user.emailVerifyExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ success: true, message: "Email đã được xác minh" });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể xác minh email" });
  }
};

// POST /auth/resend-verification (signed in)
const resendVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user.emailVerified === true || user.role === "admin") return res.status(200).json({ success: true, message: "Email đã được xác minh" });
    const verify = newToken();
    user.emailVerifyTokenHash = verify.hash;
    user.emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });
    await sendVerifyMail(user, verify.token);
    return res.status(200).json({ success: true, message: `Đã gửi email xác minh tới ${user.email}` });
  } catch (error) {
    console.error(`Resend verification failed: ${error.code || error.name || "Error"}`);
    return res.status(500).json({ success: false, message: "Chưa gửi được email xác minh. Vui lòng thử lại sau." });
  }
};

// PUT /auth/me { fullName, phone } — phone may be empty to remove it.
const updateMe = async (req, res) => {
  const fullName = normalizeFullName(req.body?.fullName);
  if (!fullName) return res.status(400).json({ success: false, message: NAME_MESSAGE });
  const rawPhone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const phone = rawPhone ? normalizeVnPhone(rawPhone) : "";
  if (phone === null) return res.status(400).json({ success: false, message: PHONE_MESSAGE });
  try {
    const user = await User.findById(req.user._id);
    user.fullName = fullName;
    user.phone = phone;
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ success: true, message: "Đã cập nhật hồ sơ", data: { user: publicUser(user) } });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể cập nhật hồ sơ" });
  }
};

// PUT /auth/me/password { currentPassword, newPassword } — returns a fresh token; other sessions are logged out.
const changePassword = async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === "string" ? req.body.currentPassword : "";
  const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
  if (!currentPassword) return res.status(400).json({ success: false, message: "Vui lòng nhập mật khẩu hiện tại" });
  const problems = passwordProblems(newPassword);
  if (problems.length) return res.status(400).json({ success: false, message: passwordMessage(problems) });
  if (currentPassword === newPassword) return res.status(400).json({ success: false, message: "Mật khẩu mới phải khác mật khẩu hiện tại" });
  try {
    const user = await User.findById(req.user._id).select("+password +googleSub");
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ success: false, message: user.googleSub ? "Mật khẩu hiện tại không đúng. Nếu bạn đăng ký bằng Google, hãy dùng “Quên mật khẩu” để tạo mật khẩu." : "Mật khẩu hiện tại không đúng" });
    }
    user.password = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date(Date.now() - 1000); // the token issued below stays valid
    await user.save({ validateBeforeSave: false });
    return res.status(200).json({ success: true, message: "Đã đổi mật khẩu", data: { user: publicUser(user), token: generateToken(user) } });
  } catch {
    return res.status(500).json({ success: false, message: "Không thể đổi mật khẩu" });
  }
};

module.exports = {
  forgotPassword, resetPassword, verifyEmail, resendVerification, updateMe, changePassword, publicUser, register, login, getMe };
