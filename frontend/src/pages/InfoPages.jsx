import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Mail, MapPin, Phone } from "lucide-react";
import { STORE_INFO, hasContact } from "../config/storeInfo";

// Nội dung các trang này mô tả đúng cách hệ thống đang vận hành (phí vận chuyển, trạng thái đơn,
// thời gian giữ hàng, quy trình trả hàng trong trang quản trị), không phải văn bản mẫu.

function InfoShell({ eyebrow, title, intro, children }) {
  return (
    <main className="container info-page">
      <nav className="info-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><span>{title}</span></nav>
      <header className="info-head"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{intro && <p>{intro}</p>}</header>
      <div className="info-body">{children}</div>
      <ContactBox />
    </main>
  );
}

export function ContactBox() {
  if (!hasContact()) return null;
  const { hotline, email, address, workingHours } = STORE_INFO;
  return (
    <aside className="info-contact" aria-label="Liên hệ hỗ trợ">
      <h2>Liên hệ hỗ trợ</h2>
      {hotline && <p><Phone size={16} /> Hotline: <a href={`tel:${hotline.replace(/\s/g, "")}`}>{hotline}</a></p>}
      {email && <p><Mail size={16} /> Email: <a href={`mailto:${email}`}>{email}</a></p>}
      {address && <p><MapPin size={16} /> {address}</p>}
      {workingHours && <p>Thời gian hỗ trợ: {workingHours}</p>}
    </aside>
  );
}

const contactLine = () => {
  const { hotline, email } = STORE_INFO;
  if (hotline && email) return <>qua hotline <a href={`tel:${hotline.replace(/\s/g, "")}`}>{hotline}</a> hoặc email <a href={`mailto:${email}`}>{email}</a></>;
  if (hotline) return <>qua hotline <a href={`tel:${hotline.replace(/\s/g, "")}`}>{hotline}</a></>;
  if (email) return <>qua email <a href={`mailto:${email}`}>{email}</a></>;
  return <>qua kênh hỗ trợ của cửa hàng</>;
};

export function ShippingReturnsPage() {
  const { returnDays, paymentHoldMinutes, bankTransferHoldHours } = STORE_INFO;
  return (
    <InfoShell eyebrow="HỖ TRỢ KHÁCH HÀNG" title="Giao hàng và đổi trả" intro="Cách đơn hàng được xử lý từ lúc đặt đến khi bạn nhận hàng, và cách yêu cầu trả hàng">
      <section>
        <h2>Phí vận chuyển</h2>
        <p>Miễn phí vận chuyển cho mọi đơn hàng. Tổng tiền bạn thấy ở bước thanh toán là số tiền cuối cùng cần trả.</p>
      </section>
      <section>
        <h2>Các bước xử lý đơn hàng</h2>
        <ol className="info-steps">
          <li><strong>Chờ xác nhận</strong>: đơn vừa được tạo, hàng đã được giữ riêng cho bạn trong kho</li>
          <li><strong>Đang chuẩn bị</strong>: cửa hàng đã xác nhận và đóng gói đơn hàng</li>
          <li><strong>Đang giao</strong>: đơn đã được bàn giao cho đơn vị vận chuyển</li>
          <li><strong>Hoàn thành</strong>: bạn đã nhận hàng; từ lúc này bạn có thể viết đánh giá sản phẩm</li>
        </ol>
        <p>Bạn theo dõi trạng thái trong mục <Link to="/orders">Đơn hàng của tôi</Link>. Thời gian giao phụ thuộc đơn vị vận chuyển và địa chỉ nhận hàng.</p>
      </section>
      <section>
        <h2>Thanh toán và thời gian giữ hàng</h2>
        <ul>
          <li>Thanh toán khi nhận hàng (COD): đơn được ghi nhận ngay, không cần trả trước</li>
          <li>Thanh toán qua ZaloPay: hàng được giữ {paymentHoldMinutes} phút để bạn hoàn tất thanh toán</li>
          <li>Chuyển khoản ngân hàng: hàng được giữ {bankTransferHoldHours} giờ để bạn chuyển khoản và gửi xác nhận</li>
        </ul>
        <p>Quá thời gian trên mà chưa thanh toán, đơn sẽ tự hủy và sản phẩm được trả lại kho cho khách khác. Nếu thanh toán không thành công, đơn cũng được hủy ngay.</p>
      </section>
      <section>
        <h2>Hủy đơn hàng</h2>
        <p>Bạn tự hủy được khi đơn còn ở trạng thái Chờ xác nhận, bằng nút Hủy đơn hàng trong trang chi tiết đơn. Sau khi cửa hàng đã xác nhận, vui lòng liên hệ hỗ trợ để được xử lý.</p>
      </section>
      <section>
        <h2>Trả hàng và hoàn tiền</h2>
        <ol className="info-steps">
          <li>Liên hệ {contactLine()} trong vòng {returnDays} ngày kể từ khi nhận hàng, kèm mã đơn hàng và lý do trả hàng</li>
          <li>Cửa hàng tạo hồ sơ trả hàng và xem xét yêu cầu (được duyệt hoặc từ chối kèm lý do)</li>
          <li>Khi yêu cầu được duyệt, bạn gửi sản phẩm về; cửa hàng kiểm tra tình trạng khi nhận lại</li>
          <li>Cửa hàng hoàn tiền và ghi mã giao dịch hoàn tiền vào hồ sơ để đối soát</li>
        </ol>
        <p>Sản phẩm còn nguyên vẹn được nhập lại kho; sản phẩm đã mở hoặc hư hỏng vẫn được ghi nhận nhưng không bán lại.</p>
      </section>
    </InfoShell>
  );
}

const FAQ = [
  ["Phân tích da bằng AI có lưu ảnh khuôn mặt của tôi không?", "Không. Ảnh chỉ được dùng trong lúc phân tích. Hệ thống chỉ lưu kết quả như loại da, điểm các chỉ số và số nốt mụn để bạn xem lại trong lịch sử."],
  ["Kết quả phân tích da chính xác đến đâu?", "Chỉ số mụn được đếm bằng mô hình phát hiện mụn tự huấn luyện; các chỉ số khác do Gemini ước lượng từ ảnh. Kết quả dùng để tham khảo khi chọn mỹ phẩm, không thay thế chẩn đoán của bác sĩ da liễu."],
  ["Cửa hàng có những cách thanh toán nào?", "Thanh toán khi nhận hàng (COD), ví ZaloPay và chuyển khoản ngân hàng qua mã VietQR. Phương thức nào đang tạm ngừng sẽ không hiện ở bước thanh toán."],
  ["Tôi chọn thanh toán trực tuyến nhưng chưa trả tiền thì sao?", `Hàng được giữ ${STORE_INFO.paymentHoldMinutes} phút với ZaloPay và ${STORE_INFO.bankTransferHoldHours} giờ với chuyển khoản. Quá thời gian này đơn tự hủy và sản phẩm được trả lại kho.`],
  ["Vì sao tôi không đặt được số lượng mong muốn?", "Hệ thống chỉ bán trong phạm vi tồn kho thực tế. Nếu có khách khác vừa đặt trước, bạn sẽ được báo chính xác số lượng còn lại để điều chỉnh giỏ hàng."],
  ["Phí vận chuyển là bao nhiêu?", "Miễn phí vận chuyển cho mọi đơn hàng."],
  ["Làm sao để hủy đơn?", "Vào Đơn hàng của tôi, mở đơn đang ở trạng thái Chờ xác nhận và bấm Hủy đơn hàng. Đơn đã được xác nhận thì cần liên hệ hỗ trợ."],
  ["Vì sao tôi chưa viết được đánh giá?", "Chỉ khách đã nhận hàng (đơn ở trạng thái Hoàn thành) mới viết được đánh giá cho sản phẩm trong đơn đó, để đánh giá phản ánh trải nghiệm thật."],
  ["Mã giảm giá dùng như thế nào?", "Nhập mã ở bước thanh toán. Mỗi mã có thời hạn, giá trị đơn tối thiểu và giới hạn số lượt dùng; hệ thống kiểm tra lại các điều kiện này khi tạo đơn."],
  ["Tôi quên mật khẩu thì làm sao?", "Chọn Quên mật khẩu ở trang đăng nhập và nhập email đã đăng ký. Liên kết đặt lại mật khẩu có hiệu lực trong 30 phút."],
];

export function FaqPage() {
  const [open, setOpen] = useState(0);
  return (
    <InfoShell eyebrow="HỖ TRỢ KHÁCH HÀNG" title="Câu hỏi thường gặp" intro="Giải đáp nhanh về phân tích da, đặt hàng, thanh toán và tài khoản">
      <div className="info-faq">
        {FAQ.map(([q, a], index) => (
          <section key={q} className={open === index ? "is-open" : ""}>
            <h2><button type="button" aria-expanded={open === index} onClick={() => setOpen(open === index ? -1 : index)}>{q}<ChevronDown aria-hidden="true" /></button></h2>
            {open === index && <p>{a}</p>}
          </section>
        ))}
      </div>
      <p className="info-note">Chưa thấy câu trả lời bạn cần? Hãy trò chuyện với <Link to="/skin-advisor">Trợ lý da AI</Link> hoặc liên hệ cửa hàng {contactLine()}.</p>
    </InfoShell>
  );
}

export function AboutPage() {
  return (
    <InfoShell eyebrow="VỀ CHÚNG TÔI" title="Câu chuyện sandwich beauty" intro="Hiểu làn da trước, chọn mỹ phẩm sau">
      <section>
        <h2>Vì sao có sandwich beauty</h2>
        <p>Nhiều người mua mỹ phẩm theo lời quảng cáo hoặc theo người khác, rồi mới phát hiện sản phẩm không hợp với làn da của mình. sandwich beauty được xây dựng để đảo lại thứ tự đó: giúp bạn hiểu làn da của mình trước, sau đó mới chọn sản phẩm.</p>
      </section>
      <section>
        <h2>Cách chúng tôi làm</h2>
        <ul>
          <li>Phân tích da từ một tấm ảnh: chấm sáu chỉ số và khoanh từng nốt mụn</li>
          <li>Trợ lý da AI trò chuyện và gợi ý sản phẩm theo loại da, vấn đề da và thành phần cần tránh</li>
          <li>Gợi ý chu trình bốn bước chỉ từ những sản phẩm đang bán và còn hàng</li>
          <li>Thông tin thành phần kèm nguồn tham khảo để bạn tự kiểm chứng</li>
        </ul>
      </section>
      <section>
        <h2>Về dự án</h2>
        <p>sandwich beauty là sản phẩm của đồ án tốt nghiệp “Xây dựng website bán mỹ phẩm tích hợp trợ lý ảo phân tích da và gợi ý sản phẩm cá nhân hóa” do Trần Hoàng Oanh thực hiện năm 2026.</p>
      </section>
    </InfoShell>
  );
}

export function CommitmentsPage() {
  const items = [
    ["Không bán vượt tồn kho", "Mỗi đơn chỉ được tạo khi kho còn đủ hàng; nhiều người đặt cùng lúc vẫn không bị bán quá số lượng thực tế."],
    ["Giá được kiểm tra lại khi đặt hàng", "Giá, mã giảm giá và tồn kho luôn được máy chủ xác nhận lại tại thời điểm tạo đơn, không dựa vào dữ liệu cũ trong giỏ hàng."],
    ["Thông tin thành phần có nguồn", "Mô tả công dụng thành phần đi kèm đường dẫn nguồn tham khảo để bạn tự kiểm chứng."],
    ["AI minh bạch về giới hạn", "Kết quả phân tích luôn ghi rõ là tham khảo, kèm độ tin cậy và chất lượng ảnh; không đưa ra chẩn đoán y khoa."],
    ["Không lưu ảnh khuôn mặt", "Ảnh dùng để phân tích da không được lưu lại; chỉ kết quả phân tích được lưu vào lịch sử của bạn."],
    ["Bảo vệ tài khoản", "Mật khẩu được mã hóa một chiều, liên kết đặt lại mật khẩu có hạn dùng, và đổi mật khẩu sẽ đăng xuất các phiên đăng nhập cũ."],
    ["Đánh giá từ người đã mua", "Chỉ khách đã nhận hàng mới được đánh giá sản phẩm, để đánh giá phản ánh trải nghiệm thật."],
  ];
  return (
    <InfoShell eyebrow="VỀ CHÚNG TÔI" title="Cam kết của chúng tôi" intro="Những điều website thực sự làm để bạn mua sắm an tâm">
      <div className="info-commitments">
        {items.map(([title, text], index) => (
          <section key={title}><span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><h2>{title}</h2><p>{text}</p></section>
        ))}
      </div>
    </InfoShell>
  );
}
