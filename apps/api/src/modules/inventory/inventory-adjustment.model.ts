import { Schema, Types, model } from "mongoose";

const inventoryAdjustmentSchema = new Schema(
  {
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: "" },
    entryGroupId: { type: String, trim: true, default: "" },
    entryWarehouseId: { type: String, trim: true, default: "" },
    entryWarehouseName: { type: String, trim: true, default: "" },
    entryUsdToAwgRate: { type: Number, min: 0, default: 0 },
    entryCostUsd: { type: Number, min: 0, default: 0 },
    source: {
      type: String,
      enum: ["warehouse-stock", "import-fallback", "inventory-entry"],
      required: true,
    },
  },
  { timestamps: true },
);

inventoryAdjustmentSchema.index({ productId: 1, createdAt: -1 });

export const InventoryAdjustment = model("InventoryAdjustment", inventoryAdjustmentSchema);