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
          { text: "Phân tích các đặc điểm phục vụ chăm sóc mỹ phẩm trong ảnh. Không chẩn đoán bệnh hoặc đưa kết luận y khoa. Trả JSON với skinType (oily|dry|normal|combination|unknown), confidence 0-1, concerns gồm key (acne|pigmentation|redness|large_pores|dullness|dehydration), label, confidence, recommendedIngredients, warnings và analysisSource='gemini_vision'. Nếu không chắc chắn, dùng unknown và confidence thấp." },
          { inlineData: { mimeType: image.mimeType, data: image.buffer.toString("base64") } },
        ] }],
        generationConfig: { responseMimeType: "application/json" },
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
