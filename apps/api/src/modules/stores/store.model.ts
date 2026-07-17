import { Schema, Types, model } from "mongoose";

const storeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phoneCountryCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    managerName: { type: String, trim: true },
    assignedProductIds: { type: [Types.ObjectId], ref: "Product", default: [] },
    defaultPaymentMethod: { type: String, trim: true, default: "Pago a la recepción del servicio" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Store = model("Store", storeSchema);
