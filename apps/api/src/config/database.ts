import mongoose from "mongoose";

import { env } from "./env.js";

import { FixedCost } from "../modules/accounting/fixed-cost.model.js";
import { ImportCost } from "../modules/accounting/import-cost.model.js";
import { OperationalExpense } from "../modules/accounting/operational-expense.model.js";
import { Category } from "../modules/categories/category.model.js";
import { CatalogClientPricing } from "../modules/catalog/catalog-client-pricing.model.js";
import { CatalogRecord } from "../modules/catalog/catalog-record.model.js";
import { Product } from "../modules/catalog/product.model.js";
import { roleSummary } from "../modules/dashboard/dashboard.service.js";
import { WarehouseLocation } from "../modules/inventory/warehouse-location.model.js";
import { WarehouseStock } from "../modules/inventory/warehouse-stock.model.js";
import { Order } from "../modules/orders/order.model.js";
import { OrderEditLog } from "../modules/orders/order-edit-log.model.js";
import { ExportRequest } from "../modules/procurement/export-request.model.js";
import { SalesRoute } from "../modules/routes/route.model.js";
import { Store } from "../modules/stores/store.model.js";
import { Supplier } from "../modules/suppliers/supplier.model.js";
import { PushNotificationLog } from "../modules/notifications/push-notification-log.model.js";
import { PushToken } from "../modules/notifications/push-token.model.js";
import { User } from "../modules/users/user.model.js";
import { Warehouse } from "../modules/warehouses/warehouse.model.js";

const mongoModels = [
  FixedCost,
  ImportCost,
  OperationalExpense,
  Category,
  CatalogClientPricing,
  CatalogRecord,
  Product,
  WarehouseLocation,
  WarehouseStock,
  Order,
  OrderEditLog,
  ExportRequest,
  SalesRoute,
  Store,
  Supplier,
  PushNotificationLog,
  PushToken,
  User,
  Warehouse,
];

export async function connectDatabase() {
  await mongoose.connect(env.MONGODB_URI);
}

export async function initializeCollections() {
  await Promise.all(
    mongoModels.map(async (model) => {
      await model.createCollection();
      await model.syncIndexes();
    }),
  );

  const userCount = await User.estimatedDocumentCount();

  if (userCount === 0) {
    await User.insertMany(
      roleSummary.map((role) => ({
        name: role.name,
        email: `${role.code}@sps.local`,
        password: "ChangeMe123!",
        role: role.code,
        active: true,
      })),
    );
  }

  await User.findOneAndUpdate(
    { email: "said@spste.com" },
    {
      name: "Said",
      email: "said@spste.com",
      password: "123456",
      role: "management",
      active: true,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
}
