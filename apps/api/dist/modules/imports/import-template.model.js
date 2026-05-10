import { Schema, model } from "mongoose";
const importTemplateSchema = new Schema({
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    containerType: { type: String, required: true },
    containerSize: { type: String, required: true, enum: ["20ft", "40ft"] },
    measurementUnit: { type: String, required: true },
    notes: { type: String, default: "" },
    expenseItems: [
        {
            key: { type: String, required: true },
            label: { type: String, required: true },
            amount: { type: Number, required: true, min: 0 },
            documents: [
                {
                    fileName: { type: String, required: true },
                    url: { type: String, required: true },
                },
            ],
        },
    ],
    products: [
        {
            productId: { type: String, required: true },
            selected: { type: Boolean, default: false },
            boxCount: { type: String, default: "" },
            importedQuantity: { type: String, default: "" },
            purchaseUnitCostOrigin: { type: String, default: "" },
            purchaseBoxCostOrigin: { type: String, default: "" },
            expirationDate: { type: String, default: "" },
        },
    ],
}, {
    timestamps: true,
});
importTemplateSchema.index({ userId: 1, name: 1 }, { unique: true });
export const ImportTemplate = model("ImportTemplate", importTemplateSchema);
//# sourceMappingURL=import-template.model.js.map