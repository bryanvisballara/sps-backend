import { Product } from "../modules/catalog/product.model.js";
import { WarehouseStock } from "../modules/inventory/warehouse-stock.model.js";
import {
  clearNotificationLog,
  notifyExpiryThreshold,
  notifyInventoryAlert,
  sendDedupedNotification,
} from "./push-notification.service.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const MONITOR_INTERVAL_MS = 60 * 60 * 1000;

function daysUntil(date: Date, now: Date) {
  return Math.ceil((date.getTime() - now.getTime()) / DAY_MS);
}

function expiryLogKey(thresholdDays: 60 | 30 | 15, productId: string, stockRowId: string) {
  return `expiry-${thresholdDays}-${productId}-${stockRowId}`;
}

function inventoryLogKey(productId: string, stockRowId: string) {
  return `inventory-alert-${productId}-${stockRowId}`;
}

async function checkInventoryAlerts() {
  const [products, stockRows] = await Promise.all([
    Product.find({ active: { $ne: false }, shareWithAruba: { $ne: false } }).lean(),
    WarehouseStock.find({ availableUnits: { $gt: 0 } }).lean(),
  ]);

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const stockByProduct = new Map<string, typeof stockRows>();

  stockRows.forEach((row) => {
    const productId = String(row.productId);
    const current = stockByProduct.get(productId) ?? [];
    current.push(row);
    stockByProduct.set(productId, current);
  });

  for (const product of products) {
    const productId = String(product._id);
    const alertLevel = Number(product.inventoryAlert ?? 0);
    const productStockRows = stockByProduct.get(productId) ?? [];
    const totalQuantity = productStockRows.reduce((sum, row) => sum + Number(row.availableUnits ?? 0), 0);

    if (alertLevel <= 0) {
      continue;
    }

    if (totalQuantity > alertLevel) {
      for (const stockRow of productStockRows) {
        await clearNotificationLog(inventoryLogKey(productId, String(stockRow._id)));
      }
      if (productStockRows.length === 0) {
        await clearNotificationLog(inventoryLogKey(productId, "product"));
      }
      continue;
    }

    const targetStockRowId = productStockRows.length > 0
      ? String(productStockRows[0]._id)
      : "product";

    await sendDedupedNotification(
      inventoryLogKey(productId, targetStockRowId),
      "inventory-alert",
      async () => {
        await notifyInventoryAlert(product.name, product.sku, totalQuantity, alertLevel);
      },
    );
  }
}

async function checkExpiryAlerts(now: Date) {
  const [products, stockRows] = await Promise.all([
    Product.find({ active: { $ne: false }, shareWithAruba: { $ne: false } }).select({
      _id: 1,
      name: 1,
      sku: 1,
      expirationDate: 1,
    }).lean(),
    WarehouseStock.find({ availableUnits: { $gt: 0 } }).lean(),
  ]);

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const lots: Array<{ productId: string; stockRowId: string; expirationDate: Date }> = [];

  stockRows.forEach((row) => {
    const productId = String(row.productId);
    const product = productById.get(productId);

    if (!product) {
      return;
    }

    const expirationValue = row.expirationDate ?? product.expirationDate;

    if (!expirationValue) {
      return;
    }

    const expirationDate = expirationValue instanceof Date ? expirationValue : new Date(expirationValue);

    if (Number.isNaN(expirationDate.getTime()) || expirationDate <= now) {
      return;
    }

    lots.push({
      productId,
      stockRowId: String(row._id),
      expirationDate,
    });
  });

  products.forEach((product) => {
    const productId = String(product._id);
    const hasStockRow = lots.some((lot) => lot.productId === productId);

    if (hasStockRow || !product.expirationDate) {
      return;
    }

    const expirationDate = product.expirationDate instanceof Date
      ? product.expirationDate
      : new Date(product.expirationDate);

    if (Number.isNaN(expirationDate.getTime()) || expirationDate <= now) {
      return;
    }

    lots.push({
      productId,
      stockRowId: "product",
      expirationDate,
    });
  });

  const thresholds: Array<60 | 30 | 15> = [60, 30, 15];

  for (const lot of lots) {
    const product = productById.get(lot.productId);

    if (!product) {
      continue;
    }

    const remainingDays = daysUntil(lot.expirationDate, now);

    for (const threshold of thresholds) {
      if (remainingDays > threshold) {
        continue;
      }

      await sendDedupedNotification(
        expiryLogKey(threshold, lot.productId, lot.stockRowId),
        `expiry-${threshold}`,
        async () => {
          await notifyExpiryThreshold(threshold, product.name, product.sku, lot.expirationDate);
        },
      );
    }
  }
}

export async function runInventoryPushMonitor() {
  const now = new Date();

  try {
    await checkInventoryAlerts();
    await checkExpiryAlerts(now);
  } catch (error) {
    console.error("Inventory push monitor failed", error);
  }
}

let monitorTimer: NodeJS.Timeout | null = null;

export function startInventoryPushMonitor() {
  if (monitorTimer) {
    return;
  }

  void runInventoryPushMonitor();
  monitorTimer = setInterval(() => {
    void runInventoryPushMonitor();
  }, MONITOR_INTERVAL_MS);
}
