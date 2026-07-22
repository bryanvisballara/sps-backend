import { Schema, model } from "mongoose";
const orderEditChangeSchema = new Schema({
    field: { type: String, required: true, trim: true },
    summary: { type: String, required: true, trim: true },
    before: { type: String, trim: true, default: "" },
    after: { type: String, trim: true, default: "" },
}, { _id: false });
const orderEditLogSchema = new Schema({
    orderId: { type: String, required: true, trim: true, index: true },
    storeName: { type: String, trim: true, default: "" },
    invoiceNumber: { type: Number, min: 1 },
    editedByUserId: { type: String, required: true, trim: true },
    editedByUserName: { type: String, required: true, trim: true },
    editedByRole: { type: String, required: true, trim: true },
    source: {
        type: String,
        enum: ["seller", "warehouse", "management", "contabilidad", "system"],
        required: true,
        index: true,
    },
    action: {
        type: String,
        enum: ["update_order", "update_invoice_number", "invoice_completed", "reprint", "invoice_voided"],
        required: true,
    },
    changes: { type: [orderEditChangeSchema], default: [] },
    editedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });
orderEditLogSchema.index({ orderId: 1, editedAt: -1 });
export const OrderEditLog = model("OrderEditLog", orderEditLogSchema);
//# sourceMappingURL=order-edit-log.model.js.map