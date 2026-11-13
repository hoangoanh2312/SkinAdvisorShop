const mongoose = require('mongoose');
const SkinAnalysis = require('../models/SkinAnalysis');

// Only the signed-in user may read/delete their own analysis results.
const listSkinAnalysisHistory = async (req, res) => {
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 10, 1), 20);
  try {
    const items = await SkinAnalysis.find({ user: req.user._id })
      .select('source createdAt result.skinType result.skinTypeLabel result.warnings result.analysisSource recommendedProducts')
      .sort({ createdAt: -1 }).limit(limit).lean();
    return res.set('Cache-Control', 'no-store').json({ success: true, data: { items } });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Không thể đọc lịch sử phân tích da' });
  }
};

const deleteSkinAnalysisHistory = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Mã kết quả không hợp lệ' });
  try {
    const deleted = await SkinAnalysis.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) return res.status(404).json({ success: false, message: 'Không tìm thấy kết quả trong tài khoản' });
    return res.set('Cache-Control', 'no-store').json({ success: true, message: 'Đã xóa kết quả phân tích da' });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Không thể xóa kết quả phân tích da' });
  }
};
module.exports = { listSkinAnalysisHistory, deleteSkinAnalysisHistory };
