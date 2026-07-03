import { Schema, Types, model } from "mongoose";
const warehouseStockSchema = new Schema({
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    warehouseCode: { type: String, required: true, trim: true },
    lotName: { type: String, trim: true, default: "" },
    expirationDate: { type: Date, default: null },
    unitCostUsd: { type: Number, default: 0, min: 0 },
    usdToAwgRate: { type: Number, default: 1.79, min: 0 },
    salePriceAwg: { type: Number, default: 0, min: 0 },
    availableUnits: { type: Number, required: true, min: 0 },
    reservedUnits: { type: Number, default: 0, min: 0 },
    minUnits: { type: Number, required: true, min: 0 },
    status: {
        type: String,
        enum: ["healthy", "low", "critical"],
        default: "healthy",
    },
}, { timestamps: true });
warehouseStockSchema.index({ productId: 1, warehouseCode: 1, expirationDate: 1, unitCostUsd: 1, salePriceAwg: 1 }, { unique: true });
export const WarehouseStock = model("WarehouseStock", warehouseStockSchema);
//# sourceMappingURL=warehouse-stock.model.js.map