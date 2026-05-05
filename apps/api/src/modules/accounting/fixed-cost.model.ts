import { Schema, model } from "mongoose";

const fixedCostSchema = new Schema(
  {
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
    amount: { type: Number, required: true, min: 0 },
    startDate: { type: Date, required: true },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const FixedCost = model("FixedCost", fixedCostSchema);