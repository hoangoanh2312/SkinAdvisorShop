// Vietnamese display labels for Product.skinTypes / Product.skinConcerns enum values.
export const skinTypeLabels = { normal: "Da thường", dry: "Da khô", oily: "Da dầu", combination: "Da hỗn hợp", sensitive: "Da nhạy cảm" };
export const concernLabels = { acne: "Mụn", dryness: "Khô da", sensitivity: "Dễ kích ứng", aging: "Lão hóa", pigmentation: "Thâm sạm", pores: "Lỗ chân lông", dullness: "Xỉn màu", oiliness: "Tiết dầu" };
export const skinLabel = (value) => skinTypeLabels[value] || concernLabels[value] || value;
