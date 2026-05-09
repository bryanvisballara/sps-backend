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
  productName: string;
  productSku: string;
  quantity: number;
  unitCost: number;
  boxCost: number;
  boxVolume: number;
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
        productName: { type: String, required: true },
        productSku: { type: String, required: true },
        quantity: { type: Number, required: true, min: 0 },
        unitCost: { type: Number, required: true, min: 0 },
        boxCost: { type: Number, required: true, min: 0 },
        boxVolume: { type: Number, required: true, min: 0 },
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
