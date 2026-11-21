// Shared input rules (mirrored in backend/utils/inputPolicy.js).

// Vietnamese mobile number: exactly 10 digits, prefixes 03/05/07/08/09.
// Accepts spaces, dots, dashes and +84/84 and normalises to 0xxxxxxxxx; returns null when invalid.
export const VN_MOBILE = /^0[35789]\d{8}$/;
export const normalizeVnPhone = (value) => {
  if (typeof value !== "string") return null;
  let digits = value.trim().replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+84")) digits = `0${digits.slice(3)}`;
  else if (/^84\d{9}$/.test(digits)) digits = `0${digits.slice(2)}`;
  return VN_MOBILE.test(digits) ? digits : null;
};
export const PHONE_MESSAGE = "Số điện thoại phải gồm đúng 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09";

// Password: 8–72 characters (bcrypt limit), at least 1 uppercase letter and 1 special character.
export const passwordProblems = (password) => {
  const problems = [];
  if (typeof password !== "string" || password.length < 8) problems.push("ít nhất 8 ký tự");
  if (typeof password === "string" && password.length > 72) problems.push("tối đa 72 ký tự");
  if (!/\p{Lu}/u.test(password || "")) problems.push("1 chữ in hoa");
  if (!/[^\p{L}\p{N}\s]/u.test(password || "")) problems.push("1 ký tự đặc biệt (ví dụ ! @ # $ %)");
  return problems;
};
export const passwordMessage = (problems) => `Mật khẩu cần có ${problems.join(", ")}`;


// Full name: 2–60 characters, letters (incl. Vietnamese), spaces and . ' - only. Returns cleaned value or null.
export const normalizeFullName = (value) => {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 60 && /^[\p{L}][\p{L}\s.'-]*$/u.test(name) ? name : null;
};
export const NAME_MESSAGE = "Họ tên gồm 2–60 ký tự, chỉ chứa chữ cái và khoảng trắng";

// Upper bounds for free-text fields so a single value cannot break order pages, invoices or the admin UI.
export const TEXT_LIMITS = { address: 200, ward: 100, province: 100, label: 30, voucherCode: 30 };
export const tooLong = (value, field) => typeof value === "string" && value.trim().length > TEXT_LIMITS[field];

