export default function BrandLogo({ light = false, className = "" }) {
  return <span className={`brand-logo ${light ? "brand-logo-light" : ""} ${className}`} aria-label="sandwich beauty"><span>sandwich</span><span>beauty</span></span>;
}
