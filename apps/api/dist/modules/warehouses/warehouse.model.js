import { Schema, model } from "mongoose";
const warehouseSchema = new Schema({
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const Warehouse = model("Warehouse", warehouseSchema);
//# sourceMappingURL=warehouse.model.js.map