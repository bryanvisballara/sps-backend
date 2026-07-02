import { Schema, Types, model } from "mongoose";
const orderItemSchema = new Schema({
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    stockCurrent: { type: Number, min: 0 },
    quantity: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
}, { _id: false });
const orderSchema = new Schema({
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
}, { timestamps: true });
export const Order = model("Order", orderSchema);
//# sourceMappingURL=order.model.js.map