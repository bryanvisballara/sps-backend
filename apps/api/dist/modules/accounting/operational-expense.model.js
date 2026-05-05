import { Schema, model } from "mongoose";
const operationalExpenseSchema = new Schema({
    name: { type: String, required: true, trim: true },
    category: {
        type: String,
        enum: ["fuel", "maintenance", "unforeseen", "logistics", "tolls", "other"],
        required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const OperationalExpense = model("OperationalExpense", operationalExpenseSchema);
//# sourceMappingURL=operational-expense.model.js.map