import { Schema, Types, model } from "mongoose";
const lotPromotionSchema = new Schema({
    stockRowId: { type: Types.ObjectId, ref: "WarehouseStock", required: true, unique: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    discountPercent: { type: Number, required: true, min: 0, max: 100 },
    active: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "" },
}, { timestamps: true });
lotPromotionSchema.index({ productId: 1, active: 1 });
export const LotPromotion = model("LotPromotion", lotPromotionSchema);
//# sourceMappingURL=lot-promotion.model.js.map