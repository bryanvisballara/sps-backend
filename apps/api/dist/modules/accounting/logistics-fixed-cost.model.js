import { Schema, model } from "mongoose";
const logisticsFixedCostSchema = new Schema({
    name: { type: String, required: true, trim: true },
    category: {
        type: String,
        enum: ["payroll", "rent", "utilities", "administration", "other"],
        required: true,
    },
    frequency: {
        type: String,
        enum: ["monthly", "biweekly", "weekly", "annual", "one-time"],
        required: true,
    },
    amountAwg: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const LogisticsFixedCost = model("LogisticsFixedCost", logisticsFixedCostSchema);
//# sourceMappingURL=logistics-fixed-cost.model.js.map