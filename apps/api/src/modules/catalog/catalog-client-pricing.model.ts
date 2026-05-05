import { Schema, Types, model } from "mongoose";

const catalogClientPricingItemSchema = new Schema(
  {
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    productSku: { type: String, required: true, trim: true },
    cost: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const catalogClientPricingSchema = new Schema(
  {
    catalogId: { type: Types.ObjectId, ref: "CatalogRecord", required: true },
    catalogName: { type: String, required: true, trim: true },
    clientId: { type: Types.ObjectId, ref: "Store", required: true },
    clientName: { type: String, required: true, trim: true },
    markupPercent: { type: Number, default: 0 },
    items: { type: [catalogClientPricingItemSchema], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

catalogClientPricingSchema.index({ catalogId: 1, clientId: 1 }, { unique: true });

export const CatalogClientPricing = model("CatalogClientPricing", catalogClientPricingSchema);
