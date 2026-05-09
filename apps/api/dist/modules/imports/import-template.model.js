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
            productName: { type: String, required: true },
            productSku: { type: String, required: true },
            quantity: { type: Number, required: true, min: 0 },
            unitCost: { type: Number, required: true, min: 0 },
            boxCost: { type: Number, required: true, min: 0 },
            boxVolume: { type: Number, required: true, min: 0 },
        },
    ],
}, {
    timestamps: true,
});
importTemplateSchema.index({ userId: 1, name: 1 }, { unique: true });
export const ImportTemplate = model("ImportTemplate", importTemplateSchema);
//# sourceMappingURL=import-template.model.js.map