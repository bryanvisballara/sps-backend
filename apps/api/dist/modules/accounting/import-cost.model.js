import { Schema, Types, model } from "mongoose";
const importExpenseDocumentSchema = new Schema({
    name: { type: String, trim: true, required: true },
    url: { type: String, trim: true, required: true },
}, { _id: false });
const importExpenseItemSchema = new Schema({
    key: {
        type: String,
        enum: ["freight", "customs", "inlandLogistics", "taxes", "other"],
        required: true,
    },
    label: { type: String, trim: true, required: true },
    amount: { type: Number, required: true, min: 0 },
    documents: { type: [importExpenseDocumentSchema], default: [] },
}, { _id: false });
const importCostSchema = new Schema({
    containerReference: { type: String, required: true, trim: true },
    containerSize: { type: String, required: true, enum: ["20ft", "40ft"] },
    productId: { type: Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true, trim: true },
    productSku: { type: String, required: true, trim: true },
    seasonLabel: { type: String, trim: true, default: "" },
    shipmentReference: { type: String, trim: true, default: "" },
    importDate: { type: Date, required: true, default: () => new Date() },
    importedQuantity: { type: Number, required: true, min: 0, default: 0 },
    purchaseUnitCostOrigin: { type: Number, required: true, min: 0, default: 0 },
    exchangeRate: { type: Number, min: 0.0001, default: 1 },
    seasonalAdjustmentPercent: { type: Number, default: 0 },
    freightCost: { type: Number, default: 0, min: 0 },
    customsCost: { type: Number, default: 0, min: 0 },
    inlandLogisticsCost: { type: Number, default: 0, min: 0 },
    taxesCost: { type: Number, default: 0, min: 0 },
    coldChainCost: { type: Number, default: 0, min: 0 },
    additionalCostName: { type: String, trim: true, default: "" },
    otherImportCosts: { type: Number, default: 0, min: 0 },
    adjustedUnitCostOrigin: { type: Number, required: true, min: 0 },
    purchaseUnitCostLocal: { type: Number, required: true, min: 0 },
    merchandiseCostTotal: { type: Number, required: true, min: 0 },
    totalImportCost: { type: Number, required: true, min: 0 },
    landedUnitCost: { type: Number, required: true, min: 0 },
    expenseItems: { type: [importExpenseItemSchema], default: [] },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const ImportCost = model("ImportCost", importCostSchema);
//# sourceMappingURL=import-cost.model.js.map