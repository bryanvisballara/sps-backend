import { Schema, model } from "mongoose";

const logisticsInvoiceItemSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true },
    productName: { type: String, required: true, trim: true },
    productSku: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    salePriceAwg: { type: Number, required: true, min: 0 },
    lineTotalAwg: { type: Number, required: true, min: 0 },
    unitCostAwg: { type: Number, default: 0, min: 0 },
    lineUtilityAwg: { type: Number, default: 0 },
  },
  { _id: false },
);

const logisticsInvoiceSchema = new Schema(
  {
    orderId: { type: String, trim: true },
    invoiceDate: { type: Date, required: true },
    storeName: { type: String, required: true, trim: true },
    salesRepName: { type: String, trim: true },
    routeName: { type: String, trim: true },
    notes: { type: String, trim: true },
    items: { type: [logisticsInvoiceItemSchema], required: true },
    totalRevenueAwg: { type: Number, required: true, min: 0 },
    totalCostAwg: { type: Number, default: 0, min: 0 },
    totalUtilityAwg: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    syncExcluded: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const LogisticsInvoice = model("LogisticsInvoice", logisticsInvoiceSchema);
