// Live checklist for the password policy (8+ characters, 1 uppercase, 1 special character).
export default function PasswordRules({ value = "", id = "password-rules" }) {
  const rules = [
    ["length", "Ít nhất 8 ký tự", value.length >= 8],
    ["upper", "Có 1 chữ in hoa", /\p{Lu}/u.test(value)],
    ["special", "Có 1 ký tự đặc biệt (! @ # $ %...)", /[^\p{L}\p{N}\s]/u.test(value)],
  ];
  return <ul id={id} className="password-rules">{rules.map(([key, label, ok]) => <li key={key} className={ok ? "ok" : ""}>{ok ? "✓" : "○"} {label}</li>)}</ul>;
}
