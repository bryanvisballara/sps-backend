import { Schema, Types, model } from "mongoose";

const catalogRecordSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    categoryNames: { type: [String], default: [] },
    productIds: { type: [Types.ObjectId], ref: "Product", default: [] },
    excludedProductIds: { type: [Types.ObjectId], ref: "Product", default: [] },
    availableForOrders: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CatalogRecord = model("CatalogRecord", catalogRecordSchema);
