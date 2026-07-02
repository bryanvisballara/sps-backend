import { Schema, model } from "mongoose";

const carteraEntrySchema = new Schema(
  {
    orderId: { type: String, required: true, trim: true, unique: true },
    storeId: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    salesRepId: { type: String, trim: true },
    salesRepName: { type: String, trim: true },
    routeId: { type: String, trim: true },
    routeName: { type: String, trim: true },
    routeDay: { type: String, trim: true },
    deliveryZone: { type: String, trim: true },
    paymentMethod: {
      type: String,
      enum: ["credito", "datafono", "transferencia", "efectivo"],
      required: true,
    },
    invoiceAmountAwg: { type: Number, required: true, min: 0 },
    invoiceNumber: { type: Number, min: 1 },
    collectedAmountAwg: { type: Number, default: 0, min: 0 },
    outstandingAmountAwg: { type: Number, default: 0, min: 0 },
    invoicedAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CarteraEntry = model("CarteraEntry", carteraEntrySchema);
