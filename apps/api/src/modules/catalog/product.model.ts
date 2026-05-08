import { Schema, model } from "mongoose";

function isVariableSalePriceEnabled(context: { variableSalePrice?: boolean; getUpdate?: () => { variableSalePrice?: boolean; $set?: { variableSalePrice?: boolean } } | null }) {
  const update = context.getUpdate?.() ?? null;
  const updatedValue = update?.variableSalePrice ?? update?.$set?.variableSalePrice;

  if (typeof updatedValue === "boolean") {
    return updatedValue;
  }

  return Boolean(context.variableSalePrice);
}

const productSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    supplier: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    cost: { type: Number, default: 0, min: 0 },
    arubaPurchaseCostUsd: { type: Number, default: 0, min: 0 },
    arubaUsdToAwgRate: { type: Number, default: 1.79, min: 0 },
    variableSalePrice: { type: Boolean, default: false },
    salePrice: {
      type: Number,
      min: 0,
      required(this: { variableSalePrice?: boolean; getUpdate?: () => { variableSalePrice?: boolean; $set?: { variableSalePrice?: boolean } } | null }) {
        return !isVariableSalePriceEnabled(this);
      },
      default: null,
    },
    productWeightKg: { type: Number, default: 0, min: 0 },
    expirationDate: { type: Date, default: null },
    unitsPerBox: { type: Number, required: true, min: 1 },
    unitsPerBoxUnit: {
      type: String,
      enum: ["kg", "lb", "unidad", "paquete"],
      default: "unidad",
      trim: true,
    },
    inventoryAlert: { type: Number, required: true, min: 0 },
    boxLengthCm: { type: Number, required: true, min: 0 },
    boxWidthCm: { type: Number, required: true, min: 0 },
    boxHeightCm: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Product = model("Product", productSchema);
