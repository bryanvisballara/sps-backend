import { Schema, model } from "mongoose";
const categorySchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    /** colombia = SECOS/REFRIGERADOS for COL/exports; aruba = QuickBooks product groups */
    market: {
        type: String,
        enum: ["colombia", "aruba"],
        default: "colombia",
        trim: true,
        index: true,
    },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const Category = model("Category", categorySchema);
//# sourceMappingURL=category.model.js.map