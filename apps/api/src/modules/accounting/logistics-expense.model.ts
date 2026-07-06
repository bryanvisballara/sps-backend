import { Schema, model } from "mongoose";

const logisticsExpenseSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: [
        "payroll",
        "rent",
        "utilities",
        "fuel",
        "maintenance",
        "administration",
        "unforeseen",
        "delivery",
        "tolls",
        "other",
      ],
      required: true,
    },
    amountAwg: { type: Number, required: true, min: 0 },
    expenseDate: { type: Date, required: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const LogisticsExpense = model("LogisticsExpense", logisticsExpenseSchema);
