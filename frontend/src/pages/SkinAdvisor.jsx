import { Bot, Send, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import RecommendationCard from "../components/ai/RecommendationCard";
import axiosClient from "../api/axiosClient";
import { useAuth } from "../contexts/AuthContext";

const quick = [
  "Da dầu mụn nên chăm sóc thế nào?",
  "Da nhạy cảm nên tránh thành phần nào?",
  "Tôi nên chọn sản phẩm nào cho da khô?",
  "Niacinamide phù hợp với loại da nào?",
];
const greeting = { role: "ai", text: "Xin chào! Tôi là Skin Advisor AI. Hãy chia sẻ loại da, vấn đề bạn đang quan tâm và nhu cầu chăm sóc để nhận gợi ý phù hợp." };

export default function SkinAdvisor() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState([greeting]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastFailed, setLastFailed] = useState("");
  const end = useRef();

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (value) => {
    const text = value.trim();
    if (!text || loading || !isAuthenticated) return;
    const history = messages.filter((item) => item.role === "user" || item.role === "ai").slice(-12)
      .map((item) => ({ role: item.role === "ai" ? "assistant" : "user", content: item.text }));
    setMessages((current) => [...current, { role: "user", text }]);
    setInput("");
    setError("");
    setLastFailed("");
    setLoading(true);
    try {
      const response = await axiosClient.post("/ai/advisor", {
        message: text,
        history,
        ...(user?.skinProfile ? { skinProfile: user.skinProfile } : {}),
      }, { sessionProtected: true });
      const data = response.data.data;
      setMessages((current) => [...current, {
        role: "ai", text: data.reply, warnings: data.warnings || [], recommendations: data.recommendations || [],
      }]);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể kết nối trợ lý tư vấn. Vui lòng thử lại.");
      setLastFailed(text);
    } finally {
      setLoading(false);
    }
  };

  if (!authLoading && !isAuthenticated) {
    return (
      <div className="advisor-page">
        <div className="advisor-login">
          <span className="ai-mark"><Sparkles /></span>
          <h1>Đăng nhập để trò chuyện với Skin Advisor AI</h1>
          <p>Hồ sơ làn da trong tài khoản giúp trợ lý đưa ra gợi ý phù hợp và an toàn hơn.</p>
          <Link className="btn btn-primary" to="/login" state={{ from: location.pathname }}>Đăng nhập</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="advisor-page">
      <div className="advisor-head">
        <span className="ai-mark"><Sparkles /></span>
        <div><span className="eyebrow">SKIN ADVISOR AI</span><h1>Tìm sản phẩm phù hợp với làn da của bạn</h1><p>Chia sẻ nhu cầu chăm sóc để nhận gợi ý sản phẩm thực tế từ SKINORA.</p></div>
      </div>
      <div className="chat-shell">
        <aside className="chat-aside">
          <Bot /><h2>Chào bạn!</h2><p>Chia sẻ loại da và vấn đề bạn đang quan tâm để bắt đầu tư vấn.</p>
          <div className="privacy-note">Nội dung mang tính tham khảo và không thay thế tư vấn y khoa.</div>
        </aside>
        <section className="chat-main">
          <div className="messages">
            {messages.map((message, index) => (
              <div className={`message ${message.role}`} key={`${message.role}-${index}`}>
                <span className="message-avatar">{message.role === "ai" ? <Bot /> : <UserRound />}</span>
                <div className="bubble">
                  <p>{message.text}</p>
                  {message.warnings?.map((warning) => <p className="advisor-warning" key={warning}>{warning}</p>)}
                  {message.recommendations?.map((product) => <RecommendationCard key={product.id} product={product} />)}
                </div>
              </div>
            ))}
            {loading && <div className="message ai"><span className="message-avatar"><Bot /></span><div className="typing" aria-label="Đang phân tích"><i /><i /><i /><span>Đang phân tích...</span></div></div>}
            <div ref={end} />
          </div>
          {messages.length < 3 && <div className="quick-list" aria-label="Gợi ý câu hỏi"><span className="quick-label">GỢI Ý CÂU HỎI</span>{quick.map((question) => <button type="button" key={question} disabled={loading} onClick={() => send(question)}>{question}</button>)}</div>}
          {error && <div className="advisor-error" role="alert"><span>{error}</span><button type="button" disabled={loading} onClick={() => send(lastFailed)}>Thử lại</button></div>}
          <form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(input); }}>
            <textarea value={input} maxLength={2000} rows={1} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(input); } }} placeholder="Hãy mô tả làn da của bạn..." />
            <button aria-label="Gửi câu hỏi" disabled={!input.trim() || loading || authLoading}><Send /></button>
          </form>
        </section>
      </div>
    </div>
  );
}
