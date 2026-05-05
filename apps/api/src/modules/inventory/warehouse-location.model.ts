import { Schema, Types, model } from "mongoose";

const warehouseLocationSchema = new Schema(
  {
    warehouseId: { type: Types.ObjectId, ref: "Warehouse", required: true },
    warehouseName: { type: String, required: true, trim: true },
    warehouseCode: { type: String, required: true, trim: true },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    productSku: { type: String, required: true, trim: true },
    shelf: { type: String, required: true, trim: true },
    floor: { type: String, required: true, trim: true },
    rack: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

warehouseLocationSchema.index({ warehouseId: 1, productId: 1 }, { unique: true });

export const WarehouseLocation = model("WarehouseLocation", warehouseLocationSchema);