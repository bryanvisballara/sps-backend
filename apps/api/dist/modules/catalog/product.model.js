import { Schema, model } from "mongoose";
function isVariableSalePriceEnabled(context) {
    const update = context.getUpdate?.() ?? null;
    const updatedValue = update?.variableSalePrice ?? update?.$set?.variableSalePrice;
    if (typeof updatedValue === "boolean") {
        return updatedValue;
    }
    return Boolean(context.variableSalePrice);
}
const productSchema = new Schema({
    sku: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    /** Exact QuickBooks Online product/service name for CSV/API export. Frontend keeps using `name`. */
    quickbooksName: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    /** Colombia / exports grouping (SECOS, REFRIGERADOS). */
    category: { type: String, required: true, trim: true },
    /** Aruba / QuickBooks product group (e.g. ALQUERIA, BEBIDAS NO ALCOHOLICAS). */
    arubaCategory: { type: String, trim: true, default: "" },
    supplier: { type: String, required: true, trim: true },
    imageUrl: { type: String, trim: true },
    cost: { type: Number, default: 0, min: 0 },
    arubaPurchaseCostUsd: { type: Number, default: 0, min: 0 },
    arubaUsdToAwgRate: { type: Number, default: 1.79, min: 0 },
    variableSalePrice: { type: Boolean, default: false },
    salePrice: {
        type: Number,
        min: 0,
        required() {
            return !isVariableSalePriceEnabled(this);
        },
        default: null,
    },
    presentation: {
        type: String,
        enum: ["kg", "lb", "unidad", "paquete", "caja"],
        default: "unidad",
        trim: true,
    },
    containerType: {
        type: String,
        enum: ["refrigerado", "seco"],
        default: "seco",
        trim: true,
    },
    shareWithAruba: { type: Boolean, default: true },
    productWeightKg: { type: Number, default: 0, min: 0 },
    exportVolumeCubicFeet: { type: Number, default: 0, min: 0 },
    displaysPerBox: { type: Number, default: 1, min: 0 },
    expirationDate: { type: Date, default: null },
    unitsPerBox: { type: Number, default: 0, min: 0 },
    unitsPerBoxUnit: {
        type: String,
        enum: ["kg", "lb", "unidad", "paquete"],
        default: "unidad",
        trim: true,
    },
    inventoryAlert: { type: Number, required: true, min: 0 },
    boxLengthCm: { type: Number, required: true, min: 0 },
    boxWidthCm: { type: Number, required: true, min: 0 },
    boxHeightCm: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
}, { timestamps: true });
export const Product = model("Product", productSchema);
//# sourceMappingURL=product.model.js.map