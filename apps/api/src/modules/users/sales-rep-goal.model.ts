import { Schema, model } from "mongoose";

const salesRepGoalSchema = new Schema(
  {
    salesRepId: { type: String, required: true, unique: true, trim: true },
    weeklyGoalAwg: { type: Number, required: true, min: 0 },
    monthlyGoalAwg: { type: Number, required: true, min: 0 },
    weeklyBonusAwg: { type: Number, default: 0, min: 0 },
    monthlyBonusAwg: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const SalesRepGoal = model("SalesRepGoal", salesRepGoalSchema);
