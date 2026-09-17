import { Bot, Send, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import RecommendationCard from "../components/ai/RecommendationCard";
import { productData } from "../data/mockData";
const quick = [
  "Da tôi thường xuyên đổ dầu",
  "Tôi đang bị mụn",
  "Da tôi dễ kích ứng",
  "Tôi muốn làm sáng da",
  "Tôi muốn xây dựng chu trình chăm sóc da",
];
const greeting = {
  role: "ai",
  text: "Xin chào! Tôi là Skin Advisor AI. Hãy chia sẻ loại da, vấn đề bạn đang quan tâm và nhu cầu chăm sóc để nhận gợi ý sản phẩm phù hợp.",
};
function replyFor(text) {
  const t = text.toLowerCase();
  if (t.includes("mụn") || t.includes("dầu"))
    return {
      product: productData[5],
      text: "Với da dầu hoặc dễ nổi mụn, bạn có thể ưu tiên sản phẩm làm sạch dịu nhẹ và cân nhắc BHA ở tần suất phù hợp. Dưỡng ẩm vẫn là bước cần thiết trong chu trình.",
      reason:
        "BHA hỗ trợ làm sạch lỗ chân lông, Niacinamide giúp cân bằng dầu.",
    };
  if (t.includes("nhạy") || t.includes("kích ứng"))
    return {
      product: productData[3],
      text: "Làn da nhạy cảm cần một chu trình tối giản: làm sạch dịu nhẹ, dưỡng phục hồi và chống nắng. Hãy thử sản phẩm mới trên vùng da nhỏ trước nhé.",
      reason:
        "Ceramide giúp củng cố hàng rào bảo vệ và giảm cảm giác khô căng.",
    };
  if (t.includes("sáng"))
    return {
      product: productData[2],
      text: "Nếu muốn chăm sóc da xỉn màu, bạn có thể tham khảo Vitamin C vào buổi sáng và kết hợp kem chống nắng phổ rộng.",
      reason: "Vitamin C hỗ trợ làm đều màu và mang lại vẻ rạng rỡ.",
    };
  return {
    product: productData[0],
    text: "Bạn có thể bắt đầu với chu trình cơ bản gồm làm sạch, serum cấp ẩm, kem dưỡng và chống nắng. Sản phẩm dưới đây phù hợp để tham khảo khi xây dựng chu trình tối giản.",
    reason: "Công thức cân bằng, phù hợp để bắt đầu một chu trình tối giản.",
  };
}
export default function SkinAdvisor() {
  const [messages, setMessages] = useState([greeting]),
    [input, setInput] = useState(""),
    [loading, setLoading] = useState(false),
    end = useRef();
  useEffect(
    () => end.current?.scrollIntoView({ behavior: "smooth" }),
    [messages, loading],
  );
  const send = (text) => {
    if (!text.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const r = replyFor(text);
      setMessages((m) => [
        ...m,
        { role: "ai", text: r.text, product: r.product, reason: r.reason },
      ]);
      setLoading(false);
    }, 900);
  };
  return (
    <div className="advisor-page">
      <div className="advisor-head">
        <span className="ai-mark">
          <Sparkles />
        </span>
        <div>
          <span className="eyebrow">SKIN ADVISOR AI</span>
          <h1>Tìm sản phẩm phù hợp với làn da của bạn</h1>
          <p>
            Chia sẻ nhu cầu chăm sóc để nhận gợi ý sản phẩm phù hợp cho bạn tham khảo.
          </p>
        </div>
      </div>
      <div className="chat-shell">
        <aside className="chat-aside">
          <Bot />
          <h2>Chào bạn!</h2>
          <p>
            Chia sẻ loại da và vấn đề bạn đang quan tâm để bắt đầu tư vấn.
          </p>
          <div className="privacy-note">
            Cuộc trò chuyện này chỉ dùng để demo và không thay thế tư vấn y
            khoa.
          </div>
        </aside>
        <section className="chat-main">
          <div className="messages">
            {messages.map((m, i) => (
              <div className={`message ${m.role}`} key={i}>
                <span className="message-avatar">
                  {m.role === "ai" ? <Bot /> : <UserRound />}
                </span>
                <div className="bubble">
                  <p>{m.text}</p>
                  {m.product && (
                    <RecommendationCard product={m.product} reason={m.reason} />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="message ai">
                <span className="message-avatar">
                  <Bot />
                </span>
                <div className="typing" aria-label="Đang phân tích">
                  <i />
                  <i />
                  <i />
                  <span>Đang phân tích...</span>
                </div>
              </div>
            )}
            <div ref={end} />
          </div>
          {messages.length < 3 && (
            <div className="quick-list" aria-label="Gợi ý câu hỏi">
              <span className="quick-label">GỢI Ý CÂU HỎI</span>
              {quick.map((q) => (
                <button key={q} onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hãy mô tả làn da của bạn..."
            />
            <button disabled={!input.trim() || loading}>
              <Send />
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
