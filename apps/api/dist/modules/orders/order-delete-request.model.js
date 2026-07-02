import { Schema, model } from "mongoose";
const orderDeleteRequestSchema = new Schema({
    orderId: { type: String, required: true, trim: true, index: true },
    storeId: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    salesRepName: { type: String, trim: true, default: "" },
    routeName: { type: String, trim: true, default: "" },
    invoiceNumber: { type: Number, min: 1 },
    orderStatus: {
        type: String,
        enum: ["submitted", "dispatched", "delivered"],
        required: true,
    },
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
}, { timestamps: true });
orderDeleteRequestSchema.index({ orderId: 1, status: 1 });
export const OrderDeleteRequest = model("OrderDeleteRequest", orderDeleteRequestSchema);
//# sourceMappingURL=order-delete-request.model.js.map