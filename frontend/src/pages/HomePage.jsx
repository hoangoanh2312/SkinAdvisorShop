import EditorialHero from "../components/layout/EditorialHero";
import HomeSections from "./HomeContentVi";
const values = [
  ["01", "CẢM HỨNG DA LIỄU"],
  ["02", "THÀNH PHẦN MINH BẠCH"],
  ["03", "AI CÁ NHÂN HÓA"],
  ["04", "SẢN PHẨM CHỌN LỌC"],
];
export default function HomePage() {
  return (
    <>
      <EditorialHero />
      <section className="hero-transition" aria-label="Giá trị của SKINORA">
        <div>
          {values.map(([number, label]) => (
            <span key={label}>
              <small>{number}</small>
              {label}
            </span>
          ))}
        </div>
      </section>
      <HomeSections />
    </>
  );
}
