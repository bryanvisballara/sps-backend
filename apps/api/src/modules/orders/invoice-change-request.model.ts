import { Schema, model } from "mongoose";

const invoiceChangeItemSchema = new Schema(
  {
    productId: { type: String, required: true, trim: true },
    productName: { type: String, trim: true, default: "" },
    productSku: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const invoiceChangeRequestSchema = new Schema(
  {
    orderId: { type: String, required: true, trim: true, index: true },
    storeId: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    salesRepName: { type: String, trim: true, default: "" },
    routeName: { type: String, trim: true, default: "" },
    invoiceNumber: { type: Number, min: 1 },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    requestedByUserId: { type: String, required: true, trim: true },
    requestedByUserName: { type: String, required: true, trim: true },
    requestedByRole: { type: String, required: true, trim: true },
    requestNotes: { type: String, trim: true, default: "" },
    reviewedByUserId: { type: String, trim: true, default: "" },
    reviewedByUserName: { type: String, trim: true, default: "" },
    reviewNotes: { type: String, trim: true, default: "" },
    reviewedAt: { type: Date },
    currentItems: { type: [invoiceChangeItemSchema], default: [] },
    proposedItems: { type: [invoiceChangeItemSchema], default: [] },
    currentInvoiceAmountAwg: { type: Number, required: true, min: 0 },
    proposedInvoiceAmountAwg: { type: Number, required: true, min: 0 },
    currentPaymentMethod: {
      type: String,
      enum: ["credito", "datafono", "transferencia", "efectivo"],
      required: true,
    },
  },
  { timestamps: true },
);

invoiceChangeRequestSchema.index({ orderId: 1, status: 1 });

export const InvoiceChangeRequest = model("InvoiceChangeRequest", invoiceChangeRequestSchema);
