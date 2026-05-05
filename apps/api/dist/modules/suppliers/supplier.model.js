import { Schema, model } from "mongoose";
const supplierSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    contactName: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phoneCountryCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const Supplier = model("Supplier", supplierSchema);
//# sourceMappingURL=supplier.model.js.map