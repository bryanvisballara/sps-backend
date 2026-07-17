import { Schema, Types, model } from "mongoose";

const orderItemSchema = new Schema(
  {
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    stockCurrent: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    stockRowId: { type: Types.ObjectId, ref: "WarehouseStock" },
    salePriceAwg: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { _id: false },
);

const orderGiftItemSchema = new Schema(
  {
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 0 },
    stockRowId: { type: Types.ObjectId, ref: "WarehouseStock" },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const orderSchema = new Schema(
  {
    routeId: { type: String, required: true, trim: true },
    routeName: { type: String, required: true, trim: true },
    routeDay: { type: String, required: true, trim: true },
    storeId: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    salesRepId: { type: String, required: true, trim: true },
    salesRepName: { type: String, required: true, trim: true },
    deliveryZone: { type: String, required: true, trim: true },
    deliveryDate: { type: Date, required: true },
    deliveryOverdue: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["draft", "submitted", "picking", "dispatched", "delivered"],
      default: "submitted",
    },
    items: { type: [orderItemSchema], default: [] },
    giftItems: { type: [orderGiftItemSchema], default: [] },
    invoiceNumber: { type: Number, min: 1 },
    orderNotes: { type: String, trim: true, default: "" },
    internalOrderNotes: { type: String, trim: true, default: "" },
  },
  { timestamps: true },
);

export const Order = model("Order", orderSchema);
