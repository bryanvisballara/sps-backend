import { Schema, model } from "mongoose";
const operationsClientSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phoneCountryCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    managerName: { type: String, trim: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const OperationsClient = model("OperationsClient", operationsClientSchema);
//# sourceMappingURL=operations-client.model.js.map