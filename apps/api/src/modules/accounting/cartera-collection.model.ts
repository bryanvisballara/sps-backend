import { Schema, model } from "mongoose";

const carteraCollectionSchema = new Schema(
  {
    carteraEntryId: { type: String, required: true, trim: true },
    storeId: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    relatedOrderId: { type: String, trim: true },
    amountAwg: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ["datafono", "transferencia", "efectivo"],
      required: true,
    },
    collectedAt: { type: Date, required: true },
    salesRepId: { type: String, trim: true },
    salesRepName: { type: String, trim: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CarteraCollection = model("CarteraCollection", carteraCollectionSchema);
