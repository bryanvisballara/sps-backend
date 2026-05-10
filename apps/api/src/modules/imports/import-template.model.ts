import { Schema, model } from "mongoose";

export interface ImportExpenseItemRecord {
  key: string;
  label: string;
  amount: number;
  documents: Array<{
    fileName: string;
    url: string;
  }>;
}

export interface ContainerImportProductRecord {
  productId: string;
  selected: boolean;
  boxCount: string;
  importedQuantity: string;
  purchaseUnitCostOrigin: string;
  purchaseBoxCostOrigin: string;
  expirationDate: string;
}

export interface ImportTemplateRecord {
  _id?: string;
  userId: string;
  name: string;
  containerType: string;
  containerSize: "20ft" | "40ft";
  measurementUnit: string;
  notes: string;
  expenseItems: ImportExpenseItemRecord[];
  products: ContainerImportProductRecord[];
  createdAt?: Date;
  updatedAt?: Date;
}

const importTemplateSchema = new Schema<ImportTemplateRecord>(
  {
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
  },
  {
    timestamps: true,
  },
);

importTemplateSchema.index({ userId: 1, name: 1 }, { unique: true });

export const ImportTemplate = model<ImportTemplateRecord>(
  "ImportTemplate",
  importTemplateSchema,
);
