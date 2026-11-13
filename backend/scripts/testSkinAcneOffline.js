/* Kiểm thử phân tích mụn không truy cập MongoDB và không gọi Gemini thật. */
const assert = require('node:assert/strict');
const { normalizeSkinAnalysis } = require('../services/skinAnalysis/skinAnalysisNormalizer');
const { analyzeWithGeminiVision } = require('../services/skinAnalysis/providers/geminiVisionProvider');

async function main() {
  const visible = normalizeSkinAnalysis({skinType:'oily',confidence:'0.77', concerns:[{key:'acne',confidence:'79%',evidence:'Vài nốt nhỏ trên má'}]});
  assert.equal(visible.concerns[0].key, 'acne');
  assert.equal(visible.concerns[0].confidence, .79);
  assert(visible.concerns[0].evidence.includes('má'));
  const uncertain = normalizeSkinAnalysis({skinType:'unknown',confidence:.1, concerns:[{key:'mụn',confidence:.43,evidence:'Có thể có vài nốt ở cằm'}]});
  assert.equal(uncertain.concerns.length,0);
  assert.equal(uncertain.possibleConcerns[0].key,'acne');
  const noSignal = normalizeSkinAnalysis({skinType:'unknown',confidence:0,concerns:[]});
  assert.equal(noSignal.concerns.length,0);
  assert.equal(noSignal.possibleConcerns.length,0);
  const originalFetch = global.fetch;
  const origKey = process.env.GEMINI_API_KEY, origModel=process.env.GEMINI_MODEL;
  try {
    process.env.GEMINI_API_KEY='MOCK-OFFLINE'; process.env.GEMINI_MODEL='MOCK-OFFLINE';
    global.fetch=async(_url,config)=>{
      const request=JSON.parse(config.body);
      const prompt=request.contents[0].parts[0].text;
      assert(prompt.includes('DẤU HIỆU MỤN'));
      assert(prompt.toLowerCase().includes('không chẩn đoán'));
      assert(request.contents[0].parts[1].inlineData.mimeType==='image/jpeg');
      return {ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({skinType:'unknown',confidence:0,concerns:[{key:'acne',confidence:.4,evidence:'Vài nốt trên trán'}],warnings:['Ánh sáng yếu']})}]}}]})};
    };
    const raw = await analyzeWithGeminiVision({buffer:Buffer.from([0xff,0xd8,0xff]),mimeType:'image/jpeg'});
    assert.equal(normalizeSkinAnalysis(raw).possibleConcerns[0].key,'acne');
  } finally {
    global.fetch=originalFetch;
    if(origKey===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=origKey;
    if(origModel===undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL=origModel;
  }
  console.log('SKINORA_SKIN_ACNE_OFFLINE_PASS: acne, uncertain observations, no fabricated acne, provider prompt (mocked HTTP)');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
