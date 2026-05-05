import { Schema, Types, model } from "mongoose";
const exportRequestSchema = new Schema({
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    requestedUnits: { type: Number, required: true, min: 1 },
    status: {
        type: String,
        enum: ["pending", "approved", "in-transit", "received"],
        default: "pending",
    },
    requestedByRole: {
        type: String,
        enum: ["warehouse", "colombia-ops", "management"],
        required: true,
    },
}, { timestamps: true });
export const ExportRequest = model("ExportRequest", exportRequestSchema);
//# sourceMappingURL=export-request.model.js.map