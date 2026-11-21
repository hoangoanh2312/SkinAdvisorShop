class SkinAnalysisProviderError extends Error {
  constructor(code) { super(code); this.code = code; }
}

const analyzeWithGeminiVision = async (image) => {
  if (!process.env.GEMINI_API_KEY?.trim() || !process.env.GEMINI_MODEL?.trim()) {
    throw new SkinAnalysisProviderError("SKIN_ANALYSIS_NOT_CONFIGURED");
  }
  const controller = new AbortController();
  const timeoutMs = Math.min(Math.max(Number(process.env.GEMINI_TIMEOUT_MS) || 60000, 10000), 120000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const model = process.env.GEMINI_MODEL.trim().replace(/^models\//, "");
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [
          { text: [
            "Bạn đang kiểm tra các đặc điểm BỀ MẶT DA NHÌN THẤY trong ảnh để hỗ trợ lựa chọn mỹ phẩm, không phải chẩn đoán y khoa.",
            "Lần lượt xem vùng trán, má trái, má phải và cằm nếu các vùng đó xuất hiện đủ rõ. Kiểm tra DẤU HIỆU MỤN: nốt gồ nhỏ, nốt đỏ giống mụn viêm, đầu trắng/đen có thể nhìn thấy; cùng đỏ da, thâm, lỗ chân lông, độ xỉn màu. Mụn đầu đen, nốt đỏ, vết thâm, nốt ruồi và bóng đổ không phải lúc nào cũng phân biệt được từ ảnh; không khẳng định chắc chắn.",
            "Nếu thực sự thấy dấu hiệu có thể liên quan mụn, trả concern key='acne' kèm confidence và evidence ngắn mô tả vị trí/dấu hiệu quan sát được. Nếu nghi có mụn nhưng không đủ rõ, ghi confidence từ 0.35 đến dưới 0.5 kèm evidence; giao diện sẽ hiển thị 'cần kiểm tra lại', KHÔNG coi là kết luận. Nếu không thấy dấu hiệu, đừng tự thêm acne; nếu không đủ sáng, bị làm đẹp/che khuất, hãy nêu giới hạn trong warnings.",
            "Đừng bỏ qua mụn chỉ vì da có thể khô, dầu hay hỗn hợp; nhận diện loại da và các nốt trên bề mặt là hai việc riêng. Tránh trả danh sách concerns rỗng khi ảnh có dấu hiệu quan sát được rõ ràng, nhưng tuyệt đối không suy đoán để lấp chỗ trống.",
            "Đối với mụn: kiểm tra RIÊNG vùng trán, má trái, má phải, cằm; nếu thấy nốt có thể là mụn, mô tả VỊ TRÍ và hình dạng nhìn thấy trong evidence. Nếu dấu hiệu yếu, vẫn trả acne với confidence thấp và evidence trung thực thay vì xóa khỏi kết quả; hệ thống sẽ hiển thị là chưa chắc chắn, không dùng đề xuất sản phẩm. Nếu không có dấu hiệu đủ nhận biết, không được tự dựng nốt mụn. Không nhận diện danh tính, độ tuổi, không suy đoán bệnh lý.",
            "Chỉ sử dụng các key concern: acne|pigmentation|redness|large_pores|dullness|dehydration.",
            "NGOÀI RA, chấm điểm từng chỉ số theo thang 1–10, trong đó 10 = gần như không thấy dấu hiệu (tình trạng tốt), 1 = dấu hiệu rất rõ và lan rộng. Các chỉ số: texture (độ căng mịn, bề mặt sần/không đều), acne (mụn: nốt viêm, đầu trắng/đen), pores (lỗ chân lông to/rõ), pigmentation (thâm, nám, đốm nâu, không đều màu), redness (vùng đỏ), oiliness (độ bóng dầu nhìn thấy). Với mỗi chỉ số: score, confidence 0..1 (thấp nếu ảnh mờ/tối/bị che hoặc không phân biệt được), regions (chọn trong: forehead|nose|cheek_image_left|cheek_image_right|chin|under_eyes — trái/phải theo GÓC NHÌN CỦA ẢNH), points: tối đa 3 điểm [y, x] trên thang 0–1000 của ảnh, đặt đúng vị trí dấu hiệu rõ nhất trên da (không đặt ngoài khuôn mặt), evidence: 1 câu tiếng Việt mô tả cụ thể điều thấy được. Chấm điểm phải dựa trên điều nhìn thấy, không cho tất cả cùng một điểm; nếu một chỉ số không thể đánh giá, để score=null và confidence<0.35.",
            "Trả faceBox [ymin, xmin, ymax, xmax] thang 0–1000 bao khuôn mặt, và imageQuality {faceDetected: boolean, lighting: good|low|harsh|uneven, sharpness: good|blurry, frontal: boolean, filterSuspected: boolean, makeupSuspected: boolean}.",
            "JSON duy nhất: {skinType: oily|dry|normal|combination|unknown, confidence: 0..1, summary: '1–2 câu tiếng Việt tóm tắt bề mặt da quan sát được', faceBox: [..], imageQuality: {..}, metrics: {texture:{score,confidence,regions,points,evidence}, acne:{..}, pores:{..}, pigmentation:{..}, redness:{..}, oiliness:{..}}, concerns: [{key,confidence:0..1,evidence:'mô tả ngắn dấu hiệu thấy được'}], recommendedIngredients: ['tên thành phần chăm sóc dịu nhẹ'] hoặc [], warnings: ['hạn chế ảnh'] hoặc [], analysisSource:'gemini_vision'}.",
            "Nếu không có mặt rõ ràng hoặc không đủ ánh sáng, dùng skinType=unknown, confidence thấp, imageQuality.faceDetected=false nếu không thấy mặt, concerns=[] và cảnh báo. Không chẩn đoán bệnh, không đoán danh tính/tuổi/chủng tộc hoặc tình trạng sức khỏe. Chỉ gợi ý chăm sóc mỹ phẩm, không kê đơn/điều trị bệnh. Các confidence chỉ là đánh giá không được hiệu chuẩn của mô hình.",
            image.context?.age ? `Người dùng tự khai tuổi: ${image.context.age}. Chỉ dùng làm bối cảnh khi diễn giải (ví dụ nếp nhăn), không thay cho quan sát.` : "",
            image.detectorHint || "",
            image.context?.selfSkinType ? `Người dùng tự nhận loại da: ${image.context.selfSkinType}. Đây chỉ là bối cảnh; nếu ảnh cho thấy khác, hãy theo điều quan sát được và nêu trong warnings.` : "",
          ].filter(Boolean).join(" ") },
          { inlineData: { mimeType: image.mimeType, data: image.buffer.toString("base64") } },
        ] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (!response.ok) throw new SkinAnalysisProviderError(response.status === 429 ? "SKIN_ANALYSIS_RATE_LIMITED" : "SKIN_ANALYSIS_PROVIDER_UNAVAILABLE");
    const body = await response.json();
    const text = body?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!text) throw new SkinAnalysisProviderError("SKIN_ANALYSIS_INVALID_RESPONSE");
    try { return JSON.parse(text); } catch { throw new SkinAnalysisProviderError("SKIN_ANALYSIS_INVALID_RESPONSE"); }
  } catch (error) {
    if (error.name === "AbortError") throw new SkinAnalysisProviderError("SKIN_ANALYSIS_TIMEOUT");
    if (error instanceof SkinAnalysisProviderError) throw error;
    throw new SkinAnalysisProviderError("SKIN_ANALYSIS_PROVIDER_UNAVAILABLE");
  } finally { clearTimeout(timer); }
};

module.exports = { analyzeWithGeminiVision, SkinAnalysisProviderError };
