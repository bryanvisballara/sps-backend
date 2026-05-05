import { Schema, model } from "mongoose";

const routeStoreSchema = new Schema(
  {
    storeId: { type: String, required: true, trim: true },
    storeName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
  },
  { _id: false },
);

const routeDaySchema = new Schema(
  {
    day: {
      type: String,
      enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
      required: true,
    },
    stores: {
      type: [routeStoreSchema],
      required: true,
      validate: {
        validator: (stores: unknown[]) => Array.isArray(stores) && stores.length > 0,
        message: "Cada dia debe tener al menos una tienda asignada.",
      },
    },
  },
  { _id: false },
);

const salesRouteSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    salesRepId: { type: String, required: true, trim: true },
    salesRepName: { type: String, required: true, trim: true },
    weekStart: { type: Date, required: true },
    weekLabel: { type: String, required: true, trim: true },
    days: {
      type: [routeDaySchema],
      required: true,
      validate: {
        validator: (days: unknown[]) => Array.isArray(days) && days.length > 0,
        message: "La ruta debe incluir al menos un dia asignado.",
      },
    },
    assignedDays: { type: Number, required: true, min: 1 },
    plannedStops: { type: Number, required: true, min: 1 },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const SalesRoute = model("SalesRoute", salesRouteSchema);