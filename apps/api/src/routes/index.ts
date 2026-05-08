import { createHash } from "node:crypto";

import { Response, Router } from "express";
import twilio from "twilio";
import * as XLSX from "xlsx";

import { env } from "../config/env.js";
import { FixedCost } from "../modules/accounting/fixed-cost.model.js";
import { ImportCost } from "../modules/accounting/import-cost.model.js";
import { LogisticsExpense } from "../modules/accounting/logistics-expense.model.js";
import { LogisticsFixedCost } from "../modules/accounting/logistics-fixed-cost.model.js";
import { LogisticsInvoice } from "../modules/accounting/logistics-invoice.model.js";
import { OperationalExpense } from "../modules/accounting/operational-expense.model.js";
import { Category } from "../modules/categories/category.model.js";
import { CatalogClientPricing } from "../modules/catalog/catalog-client-pricing.model.js";
import { CatalogRecord } from "../modules/catalog/catalog-record.model.js";
import { roleSummary } from "../modules/dashboard/dashboard.service.js";
import { InventoryAdjustment } from "../modules/inventory/inventory-adjustment.model.js";
import { WarehouseLocation } from "../modules/inventory/warehouse-location.model.js";
import { WarehouseStock } from "../modules/inventory/warehouse-stock.model.js";
import { Order } from "../modules/orders/order.model.js";
import { Product } from "../modules/catalog/product.model.js";
import { SalesRoute } from "../modules/routes/route.model.js";
import { Store } from "../modules/stores/store.model.js";
import { Supplier } from "../modules/suppliers/supplier.model.js";
import { User } from "../modules/users/user.model.js";
import { Warehouse } from "../modules/warehouses/warehouse.model.js";

export const apiRouter = Router();

const cloudinaryProductFolder = "spste/products";
const cloudinaryImportDocumentsFolder = "spste/import-documents";
const cloudinaryCatalogPdfFolder = "spste/catalog-pdfs";

function buildInternalCode(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function buildCloudinarySignature(params: Record<string, string | number>, apiSecret: string) {
  const serializedParams = Object.entries(params)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  return createHash("sha1").update(`${serializedParams}${apiSecret}`).digest("hex");
}

function buildWeekLabel(weekStart: Date) {
  return `Semana del ${weekStart.toISOString().slice(0, 10)}`;
}

function normalizeSalesRoutePayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("La ruta enviada no es valida.");
  }

  const payload = body as {
    name?: unknown;
    salesRepId?: unknown;
    salesRepName?: unknown;
    weekStart?: unknown;
    notes?: unknown;
    days?: unknown;
  };

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const salesRepId = typeof payload.salesRepId === "string" ? payload.salesRepId.trim() : "";
  const salesRepName = typeof payload.salesRepName === "string" ? payload.salesRepName.trim() : "";
  const weekStartValue = typeof payload.weekStart === "string" ? payload.weekStart.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";

  if (!name || !salesRepId || !salesRepName || !weekStartValue) {
    throw new Error("Nombre, vendedor y semana son obligatorios para crear la ruta.");
  }

  const weekStart = new Date(weekStartValue);

  if (Number.isNaN(weekStart.getTime())) {
    throw new Error("La fecha de inicio de semana no es valida.");
  }

  if (!Array.isArray(payload.days) || payload.days.length === 0) {
    throw new Error("Asigna al menos un dia de visita con tiendas asociadas.");
  }

  const seenDays = new Set<string>();
  const normalizedDays = payload.days.map((dayEntry) => {
    if (typeof dayEntry !== "object" || dayEntry === null) {
      throw new Error("El detalle diario de la ruta no es valido.");
    }

    const routeDay = dayEntry as { day?: unknown; stores?: unknown };
    const day = typeof routeDay.day === "string" ? routeDay.day.trim() : "";

    if (!day) {
      throw new Error("Cada dia asignado debe indicar su nombre.");
    }

    if (seenDays.has(day)) {
      throw new Error("No se puede repetir el mismo dia dentro de una ruta semanal.");
    }
    seenDays.add(day);

    if (!Array.isArray(routeDay.stores) || routeDay.stores.length === 0) {
      throw new Error("Cada dia asignado debe tener al menos una tienda.");
    }

    const stores = routeDay.stores.map((storeEntry) => {
      if (typeof storeEntry !== "object" || storeEntry === null) {
        throw new Error("La tienda asignada no es valida.");
      }

      const routeStore = storeEntry as {
        storeId?: unknown;
        storeName?: unknown;
        address?: unknown;
      };
      const storeId = typeof routeStore.storeId === "string" ? routeStore.storeId.trim() : "";
      const storeName = typeof routeStore.storeName === "string" ? routeStore.storeName.trim() : "";
      const address = typeof routeStore.address === "string" ? routeStore.address.trim() : "";

      if (!storeId || !storeName) {
        throw new Error("Cada tienda asignada debe tener identificador y nombre.");
      }

      return {
        storeId,
        storeName,
        address,
      };
    });

    return { day, stores };
  });

  const assignedDays = normalizedDays.length;
  const plannedStops = normalizedDays.reduce((total, day) => total + day.stores.length, 0);

  return {
    name,
    salesRepId,
    salesRepName,
    weekStart,
    weekLabel: buildWeekLabel(weekStart),
    notes,
    days: normalizedDays,
    assignedDays,
    plannedStops,
  };
}

function normalizeWarehouseLocationPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("La ubicacion enviada no es valida.");
  }

  const payload = body as {
    warehouseId?: unknown;
    productId?: unknown;
    shelf?: unknown;
    floor?: unknown;
    rack?: unknown;
  };

  const warehouseId = typeof payload.warehouseId === "string" ? payload.warehouseId.trim() : "";
  const productId = typeof payload.productId === "string" ? payload.productId.trim() : "";
  const shelf = typeof payload.shelf === "string" ? payload.shelf.trim() : "";
  const floor = typeof payload.floor === "string" ? payload.floor.trim() : "";
  const rack = typeof payload.rack === "string" ? payload.rack.trim() : "";

  if (!warehouseId || !productId || !shelf || !floor || !rack) {
    throw new Error("Selecciona bodega, producto, estante, piso y rack antes de guardar.");
  }

  return {
    warehouseId,
    productId,
    shelf: shelf.toUpperCase(),
    floor,
    rack,
  };
}

function getCloudinaryFolder(purpose: string) {
  if (purpose === "import-documents") {
    return cloudinaryImportDocumentsFolder;
  }

  if (purpose === "catalog-pdfs") {
    return cloudinaryCatalogPdfFolder;
  }

  return cloudinaryProductFolder;
}

function normalizePhoneForWhatsApp(value: unknown) {
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue) {
    return "";
  }

  const compactValue = normalizedValue
    .replace(/[\s()-]/g, "")
    .replace(/(?!^)\+/g, "");

  if (!compactValue) {
    return "";
  }

  return compactValue.startsWith("+") ? compactValue : `+${compactValue}`;
}

function normalizeImportExpenseItems(payload: Record<string, unknown>) {
  if (Array.isArray(payload.expenseItems)) {
    return payload.expenseItems.map((expenseEntry, index) => {
      if (typeof expenseEntry !== "object" || expenseEntry === null) {
        throw new Error(`El gasto #${index + 1} no es valido.`);
      }

      const expense = expenseEntry as {
        key?: unknown;
        label?: unknown;
        amount?: unknown;
        documents?: unknown;
      };
      const key = typeof expense.key === "string" ? expense.key.trim() : "";
      const label = typeof expense.label === "string" ? expense.label.trim() : "";
      const amount = Number(expense.amount ?? 0);

      if (!["freight", "customs", "inlandLogistics", "taxes", "other"].includes(key)) {
        throw new Error("Selecciona un tipo de gasto valido antes de agregarlo.");
      }

      if (!label) {
        throw new Error(`El gasto #${index + 1} debe tener un nombre.`);
      }

      if (amount < 0) {
        throw new Error(`El gasto #${index + 1} debe tener un valor valido.`);
      }

      const documents = Array.isArray(expense.documents)
        ? expense.documents.map((documentEntry, documentIndex) => {
            if (typeof documentEntry !== "object" || documentEntry === null) {
              throw new Error(`La factura #${documentIndex + 1} del gasto ${label} no es valida.`);
            }

            const document = documentEntry as { name?: unknown; url?: unknown };
            const name = typeof document.name === "string" ? document.name.trim() : "";
            const url = typeof document.url === "string" ? document.url.trim() : "";

            if (!name || !url) {
              throw new Error(`Cada factura del gasto ${label} debe incluir nombre y enlace.`);
            }

            return { name, url };
          })
        : [];

      return {
        key: key as "freight" | "customs" | "inlandLogistics" | "taxes" | "other",
        label,
        amount,
        documents,
      };
    });
  }

  const legacyAdditionalCostName = typeof payload.additionalCostName === "string" ? payload.additionalCostName.trim() : "";
  const legacyAdditionalCostValue = Number(payload.additionalCostValue ?? 0);
  const legacyExpenseItems = [
    { key: "freight", label: "Flete", amount: Number(payload.freightCost ?? 0) },
    { key: "customs", label: "Nacionalizacion", amount: Number(payload.customsCost ?? 0) },
    { key: "inlandLogistics", label: "Transporte a bodega", amount: Number(payload.inlandLogisticsCost ?? 0) },
    { key: "taxes", label: "Impuestos", amount: Number(payload.taxesCost ?? 0) },
    { key: "other", label: legacyAdditionalCostName || "Otro", amount: legacyAdditionalCostValue },
  ] as const;

  return legacyExpenseItems
    .filter((expense) => expense.amount > 0)
    .map((expense) => ({ ...expense, documents: [] }));
}

function summarizeImportExpenses(expenseItems: Array<{ key: string; label: string; amount: number }>) {
  return expenseItems.reduce(
    (summary, expense) => {
      switch (expense.key) {
        case "freight":
          summary.freightCost += expense.amount;
          break;
        case "customs":
          summary.customsCost += expense.amount;
          break;
        case "inlandLogistics":
          summary.inlandLogisticsCost += expense.amount;
          break;
        case "taxes":
          summary.taxesCost += expense.amount;
          break;
        case "other":
          summary.otherImportCosts += expense.amount;
          summary.additionalCostName = summary.additionalCostName || expense.label;
          break;
      }

      return summary;
    },
    {
      freightCost: 0,
      customsCost: 0,
      inlandLogisticsCost: 0,
      taxesCost: 0,
      otherImportCosts: 0,
      additionalCostName: "",
    },
  );
}

function normalizeCatalogPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("El catalogo enviado no es valido.");
  }

  const payload = body as {
    name?: unknown;
    description?: unknown;
    categoryNames?: unknown;
    productIds?: unknown;
  };

  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const description = typeof payload.description === "string" ? payload.description.trim() : "";
  const categoryNames = Array.isArray(payload.categoryNames)
    ? payload.categoryNames
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const productIds = Array.isArray(payload.productIds)
    ? payload.productIds
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  if (!name) {
    throw new Error("El nombre del catalogo es obligatorio.");
  }

  if (categoryNames.length === 0 && productIds.length === 0) {
    throw new Error("Selecciona al menos una categoria o un producto para armar el catalogo.");
  }

  return {
    name,
    description,
    categoryNames: [...new Set(categoryNames)],
    productIds: [...new Set(productIds)],
  };
}

function normalizeCatalogClientPricingPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("La propuesta del cliente no es valida.");
  }

  const payload = body as {
    clientIds?: unknown;
    clientId?: unknown;
    markupPercent?: unknown;
    items?: unknown;
  };

  const clientIds = Array.isArray(payload.clientIds)
    ? payload.clientIds
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const fallbackClientId = typeof payload.clientId === "string" ? payload.clientId.trim() : "";
  const markupPercent = Number(payload.markupPercent ?? 0);
  const normalizedClientIds = [...new Set(clientIds.length > 0 ? clientIds : (fallbackClientId ? [fallbackClientId] : []))];

  if (normalizedClientIds.length === 0) {
    throw new Error("Selecciona al menos un cliente antes de guardar el catalogo.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("El catalogo del cliente debe incluir al menos un producto.");
  }

  const items = payload.items.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`El producto #${index + 1} del catalogo no es valido.`);
    }

    const currentItem = item as {
      productId?: unknown;
      cost?: unknown;
      salePrice?: unknown;
    };

    const productId = typeof currentItem.productId === "string" ? currentItem.productId.trim() : "";
    const cost = Number(currentItem.cost ?? 0);
    const salePrice = Number(currentItem.salePrice ?? 0);

    if (!productId) {
      throw new Error(`El producto #${index + 1} no tiene identificador valido.`);
    }

    if (cost < 0 || salePrice < 0) {
      throw new Error("Los costos y precios de venta deben ser valores positivos.");
    }

    return { productId, cost, salePrice };
  });

  return {
    clientIds: normalizedClientIds,
    markupPercent: Number.isFinite(markupPercent) ? markupPercent : 0,
    items,
  };
}

function normalizeCatalogWhatsappPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("La solicitud de WhatsApp no es valida.");
  }

  const payload = body as {
    clientIds?: unknown;
    pdfUrl?: unknown;
    fileName?: unknown;
    message?: unknown;
  };

  const clientIds = Array.isArray(payload.clientIds)
    ? payload.clientIds
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const pdfUrl = typeof payload.pdfUrl === "string" ? payload.pdfUrl.trim() : "";
  const fileName = typeof payload.fileName === "string" ? payload.fileName.trim() : "catalogo-general.pdf";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  if (clientIds.length === 0) {
    throw new Error("Selecciona al menos un cliente antes de enviar el catalogo por WhatsApp.");
  }

  if (!pdfUrl) {
    throw new Error("No fue posible identificar el PDF del catalogo para enviar.");
  }

  try {
    new URL(pdfUrl);
  } catch {
    throw new Error("El link del PDF del catalogo no es valido.");
  }

  return {
    clientIds: [...new Set(clientIds)],
    pdfUrl,
    fileName,
    message,
  };
}

async function normalizeClientPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("La informacion del cliente no es valida.");
  }

  const payload = body as {
    name?: unknown;
    managerName?: unknown;
    email?: unknown;
    phoneCountryCode?: unknown;
    phone?: unknown;
    address?: unknown;
    assignedProductIds?: unknown;
  };

  const name = typeof payload.name === "string" ? payload.name.trim() : "";

  if (!name) {
    throw new Error("El nombre comercial del cliente es obligatorio.");
  }

  const assignedProductIds = Array.isArray(payload.assignedProductIds)
    ? payload.assignedProductIds
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
  const uniqueAssignedProductIds = [...new Set(assignedProductIds)];

  if (uniqueAssignedProductIds.length > 0) {
    const assignedProducts = await Product.find({ _id: { $in: uniqueAssignedProductIds }, active: { $ne: false } }).select({ _id: 1 }).lean();

    if (assignedProducts.length !== uniqueAssignedProductIds.length) {
      throw new Error("Uno o varios productos asignados al cliente ya no existen o estan inactivos.");
    }
  }

  return {
    name,
    managerName: typeof payload.managerName === "string" ? payload.managerName.trim() : "",
    email: typeof payload.email === "string" ? payload.email.trim() : "",
    phoneCountryCode: typeof payload.phoneCountryCode === "string" ? payload.phoneCountryCode.trim() : "",
    phone: typeof payload.phone === "string" ? payload.phone.trim() : "",
    address: typeof payload.address === "string" ? payload.address.trim() : "",
    assignedProductIds: uniqueAssignedProductIds,
  };
}

async function resolveCatalogProducts(catalog: {
  productIds?: Array<unknown>;
  categoryNames?: Array<string>;
}) {
  const explicitProductIds = Array.isArray(catalog.productIds)
    ? catalog.productIds.map((entry) => String(entry)).filter(Boolean)
    : [];
  const categoryNames = Array.isArray(catalog.categoryNames)
    ? catalog.categoryNames.map((entry) => entry.trim()).filter(Boolean)
    : [];

  const filters: Array<Record<string, unknown>> = [];

  if (explicitProductIds.length > 0) {
    filters.push({ _id: { $in: explicitProductIds } });
  }

  if (categoryNames.length > 0) {
    filters.push({ category: { $in: categoryNames } });
  }

  if (filters.length === 0) {
    return [];
  }

  const products = await Product.find({
    active: { $ne: false },
    $or: filters,
  })
    .sort({ name: 1 })
    .lean();

  const latestImportCosts = await ImportCost.find({
    productId: { $in: products.map((product) => product._id) },
  })
    .sort({ importDate: -1, createdAt: -1 })
    .lean();

  const latestCostMap = new Map<string, number>();

  latestImportCosts.forEach((row) => {
    const productId = String(row.productId);

    if (!latestCostMap.has(productId)) {
      latestCostMap.set(productId, Number(row.landedUnitCost ?? 0));
    }
  });

  return products.map((product) => {
    const arubaPurchaseCostUsd = Number(product.arubaPurchaseCostUsd ?? 0);
    const arubaUsdToAwgRate = Number(product.arubaUsdToAwgRate ?? 1.79);
    const arubaCostAwg = arubaPurchaseCostUsd * arubaUsdToAwgRate;

    return {
      productId: String(product._id),
      name: product.name,
      sku: product.sku,
      category: product.category,
      imageUrl: String(product.imageUrl ?? ""),
      cost: arubaCostAwg > 0 ? arubaCostAwg : latestCostMap.get(String(product._id)) ?? Number(product.cost ?? 0),
      salePrice: Number(product.salePrice ?? 0),
    };
  });
}

function normalizeImportCostPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("El costo de exportacion enviado no es valido.");
  }

  const payload = body as Record<string, unknown>;
  const containerTypeValue = typeof payload.containerType === "string" ? payload.containerType.trim().toLowerCase() : "seco";
  const containerSizeValue = typeof payload.containerSize === "string" ? payload.containerSize.trim() : "20ft";
  const measurementUnitValue = typeof payload.measurementUnit === "string" ? payload.measurementUnit.trim().toLowerCase() : "m3";
  const importDateValue = typeof payload.importDate === "string" ? payload.importDate.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const shipmentReference = typeof payload.shipmentReference === "string" ? payload.shipmentReference.trim() : "";
  const expenseItems = normalizeImportExpenseItems(payload);

  const rawProducts = Array.isArray(payload.products) && payload.products.length > 0 ? payload.products : [payload];
  const products = rawProducts.map((productEntry, index) => {
    if (typeof productEntry !== "object" || productEntry === null) {
      throw new Error(`El producto #${index + 1} no es valido.`);
    }

    const currentProduct = productEntry as Record<string, unknown>;
    const productId = typeof currentProduct.productId === "string" ? currentProduct.productId.trim() : "";
    const importedQuantity = Number(currentProduct.importedQuantity ?? 0);
    const purchaseUnitCostOrigin = Number(currentProduct.purchaseUnitCostOrigin ?? 0);
    const purchaseBoxCostOrigin = Number(currentProduct.purchaseBoxCostOrigin ?? 0);

    if (!productId || importedQuantity < 0 || purchaseUnitCostOrigin < 0 || purchaseBoxCostOrigin < 0) {
      throw new Error("Cada producto debe incluir referencia valida, cantidad y costos validos.");
    }

    return {
      productId,
      importedQuantity,
      purchaseUnitCostOrigin,
      purchaseBoxCostOrigin,
    };
  });

  const containerType = containerTypeValue === "refrigerado" ? "refrigerado" : "seco";
  const containerSize = containerSizeValue === "40ft" ? "40ft" : "20ft";
  const measurementUnit = measurementUnitValue === "pie3" || measurementUnitValue === "kg" ? measurementUnitValue : "m3";

  if (!shipmentReference) {
    throw new Error("Ingresa el nombre o tracking del envio antes de guardar.");
  }

  if (products.length === 0) {
    throw new Error("Selecciona productos del contenedor antes de guardar.");
  }

  const importDate = new Date(importDateValue || new Date().toISOString());

  if (Number.isNaN(importDate.getTime())) {
    throw new Error("La fecha de exportacion no es valida.");
  }

  return {
    containerType,
    containerSize,
    measurementUnit,
    importDate,
    shipmentReference,
    expenseItems,
    notes,
    products,
  };
}

async function buildImportCostRows(
  payload: ReturnType<typeof normalizeImportCostPayload>,
  containerReference: string,
) {
  const productIds = [...new Set(payload.products.map((product) => product.productId))];
  const products = await Product.find({ _id: { $in: productIds }, active: { $ne: false } }).lean();
  const productMap = new Map(products.map((product) => [String(product._id), product]));

  if (productMap.size !== productIds.length) {
    throw new Error("Uno o varios productos del contenedor no existen o estan inactivos.");
  }

  const baseRows = payload.products.map((productPayload) => {
    const product = productMap.get(productPayload.productId);

    if (!product) {
      throw new Error("Uno o varios productos del contenedor no existen o estan inactivos.");
    }

    if (productPayload.purchaseBoxCostOrigin > 0 && Number(product.unitsPerBox ?? 0) <= 0) {
      throw new Error(`Configura unidades por caja para ${product.name} antes de usar costo x caja.`);
    }

    const adjustedUnitCostOrigin = productPayload.purchaseBoxCostOrigin > 0
      ? productPayload.purchaseBoxCostOrigin / Number(product.unitsPerBox ?? 1)
      : productPayload.purchaseUnitCostOrigin;
    const purchaseUnitCostLocal = adjustedUnitCostOrigin;
    const merchandiseCostTotal = purchaseUnitCostLocal * productPayload.importedQuantity;

    return {
      ...productPayload,
      adjustedUnitCostOrigin,
      purchaseUnitCostLocal,
      merchandiseCostTotal,
    };
  });

  const totalMerchandiseCost = baseRows.reduce((sum, row) => sum + row.merchandiseCostTotal, 0);
  const allocationBase = totalMerchandiseCost > 0 ? totalMerchandiseCost : Math.max(baseRows.length, 1);
  const expenseSummary = summarizeImportExpenses(payload.expenseItems);

  return baseRows.map((row) => {
    const product = productMap.get(row.productId);

    if (!product) {
      throw new Error("Uno o varios productos del contenedor no existen o estan inactivos.");
    }

    const share = totalMerchandiseCost > 0 ? row.merchandiseCostTotal / allocationBase : 1 / allocationBase;
    const freightCost = expenseSummary.freightCost * share;
    const customsCost = expenseSummary.customsCost * share;
    const inlandLogisticsCost = expenseSummary.inlandLogisticsCost * share;
    const taxesCost = expenseSummary.taxesCost * share;
    const otherImportCosts = expenseSummary.otherImportCosts * share;
    const totalImportCost =
      row.merchandiseCostTotal + freightCost + customsCost + inlandLogisticsCost + taxesCost + otherImportCosts;
    const landedUnitCost = row.importedQuantity > 0 ? totalImportCost / row.importedQuantity : 0;

    return {
      containerReference,
      containerType: payload.containerType,
      containerSize: payload.containerSize,
      measurementUnit: payload.measurementUnit,
      shipmentReference: payload.shipmentReference,
      productId: product._id,
      productName: product.name,
      productSku: product.sku,
      seasonLabel: "",
      importDate: payload.importDate,
      importedQuantity: row.importedQuantity,
      purchaseUnitCostOrigin: row.purchaseUnitCostOrigin,
      exchangeRate: 1,
      seasonalAdjustmentPercent: 0,
      freightCost,
      customsCost,
      inlandLogisticsCost,
      taxesCost,
      coldChainCost: 0,
      additionalCostName: expenseSummary.additionalCostName,
      otherImportCosts,
      adjustedUnitCostOrigin: row.adjustedUnitCostOrigin,
      purchaseUnitCostLocal: row.purchaseUnitCostLocal,
      merchandiseCostTotal: row.merchandiseCostTotal,
      totalImportCost,
      landedUnitCost,
      expenseItems: payload.expenseItems,
      notes: payload.notes,
    };
  });
}

function normalizeFixedCostPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("El costo fijo enviado no es valido.");
  }

  const payload = body as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const frequency = typeof payload.frequency === "string" ? payload.frequency.trim() : "";
  const startDateValue = typeof payload.startDate === "string" ? payload.startDate.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const amount = Number(payload.amount ?? 0);

  if (!name || !category || !frequency || !startDateValue || amount < 0) {
    throw new Error("Nombre, categoria, frecuencia, fecha y monto del costo fijo son obligatorios.");
  }

  const startDate = new Date(startDateValue);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("La fecha del costo fijo no es valida.");
  }

  return { name, category, frequency, amount, startDate, notes };
}

function normalizeOperationalExpensePayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("El gasto operacional enviado no es valido.");
  }

  const payload = body as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const expenseDateValue = typeof payload.expenseDate === "string" ? payload.expenseDate.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const amount = Number(payload.amount ?? 0);

  if (!name || !category || !expenseDateValue || amount < 0) {
    throw new Error("Nombre, categoria, fecha y monto del gasto operacional son obligatorios.");
  }

  const expenseDate = new Date(expenseDateValue);

  if (Number.isNaN(expenseDate.getTime())) {
    throw new Error("La fecha del gasto operacional no es valida.");
  }

  return { name, category, amount, expenseDate, notes };
}

function normalizeSalesOrderPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("El pedido enviado no es valido.");
  }

  const payload = body as {
    routeId?: unknown;
    routeName?: unknown;
    routeDay?: unknown;
    storeId?: unknown;
    salesRepId?: unknown;
    items?: unknown;
  };

  const routeId = typeof payload.routeId === "string" ? payload.routeId.trim() : "";
  const routeName = typeof payload.routeName === "string" ? payload.routeName.trim() : "";
  const routeDay = typeof payload.routeDay === "string" ? payload.routeDay.trim() : "";
  const storeId = typeof payload.storeId === "string" ? payload.storeId.trim() : "";
  const salesRepId = typeof payload.salesRepId === "string" ? payload.salesRepId.trim() : "";

  if (!routeId || !routeName || !routeDay || !storeId || !salesRepId) {
    throw new Error("Selecciona cliente y vendedor antes de enviar el pedido.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Agrega al menos un producto al pedido antes de enviarlo a bodega.");
  }

  const items = payload.items.map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`El producto #${index + 1} del pedido no es valido.`);
    }

    const currentItem = item as {
      productId?: unknown;
      stockCurrent?: unknown;
      quantity?: unknown;
      notes?: unknown;
    };

    const productId = typeof currentItem.productId === "string" ? currentItem.productId.trim() : "";
    const stockCurrentValue = currentItem.stockCurrent;
    const hasStockCurrent = stockCurrentValue !== undefined && stockCurrentValue !== null && String(stockCurrentValue).trim() !== "";
    const stockCurrent = hasStockCurrent ? Number(stockCurrentValue) : null;
    const quantity = Number(currentItem.quantity ?? 0);
    const notes = typeof currentItem.notes === "string" ? currentItem.notes.trim() : "";

    if (!productId) {
      throw new Error(`El producto #${index + 1} no tiene identificador valido.`);
    }

    if (hasStockCurrent && (!Number.isFinite(stockCurrent) || (stockCurrent ?? 0) < 0)) {
      throw new Error(`El stock actual del producto #${index + 1} debe ser cero o mayor.`);
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`La cantidad del producto #${index + 1} debe ser cero o mayor.`);
    }

    if ((stockCurrent === null || !Number.isFinite(stockCurrent)) && quantity <= 0) {
      throw new Error(`El producto #${index + 1} debe incluir stock actual o cantidad solicitada.`);
    }

    return {
      productId,
      stockCurrent,
      quantity,
      notes,
    };
  });

  return {
    routeId,
    routeName,
    routeDay,
    storeId,
    salesRepId,
    items,
  };
}

function isDuplicateKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}

function sendCreationError(response: Response, error: unknown) {
  if (isDuplicateKeyError(error)) {
    response.status(409).json({ message: "Ya existe un registro con ese identificador." });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected error";
  response.status(400).json({ message });
}

function canEditSellerOrder(createdAt: Date) {
  return Date.now() - createdAt.getTime() <= 6 * 60 * 60 * 1000;
}

function resolveWarehouseStockStatus(availableUnits: number, minUnits: number) {
  if (availableUnits <= 0) {
    return "critical" as const;
  }

  if (availableUnits <= minUnits) {
    return "low" as const;
  }

  return "healthy" as const;
}

async function applyOrderInventoryDeduction(order: {
  _id: unknown;
  items: Array<{ productId?: unknown; quantity?: unknown }>;
}) {
  const quantitiesByProductId = order.items.reduce<Map<string, number>>((map, item) => {
    const productId = String(item.productId ?? "").trim();
    const quantity = Number(item.quantity ?? 0);

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return map;
    }

    map.set(productId, (map.get(productId) ?? 0) + quantity);
    return map;
  }, new Map());

  for (const [productId, quantityToDeduct] of quantitiesByProductId.entries()) {
    const existingAutomaticDeduction = await InventoryAdjustment.findOne({
      productId,
      reason: "Despacho de pedido completado",
      notes: `Salida automatica por pedido ${String(order._id)}`,
    }).lean();

    if (existingAutomaticDeduction) {
      continue;
    }

    const stockRows = await WarehouseStock.find({ productId }).sort({ availableUnits: -1, createdAt: 1 });

    if (stockRows.length > 0) {
      const availableUnits = stockRows.reduce((sum, row) => sum + Number(row.availableUnits ?? 0), 0);

      if (quantityToDeduct > availableUnits) {
        throw new Error(
          `No hay inventario suficiente para completar el pedido de ${productId}. Disponible: ${availableUnits}, solicitado: ${quantityToDeduct}.`,
        );
      }

      let remaining = quantityToDeduct;

      for (const stockRow of stockRows) {
        if (remaining <= 0) {
          break;
        }

        const rowAvailable = Number(stockRow.availableUnits ?? 0);
        const nextAvailable = Math.max(rowAvailable - remaining, 0);
        const deductedFromRow = rowAvailable - nextAvailable;

        if (deductedFromRow <= 0) {
          continue;
        }

        remaining -= deductedFromRow;
        await WarehouseStock.findByIdAndUpdate(stockRow._id, { availableUnits: nextAvailable }, { runValidators: true });
      }
    }

    await InventoryAdjustment.create({
      productId,
      quantity: quantityToDeduct,
      reason: "Despacho de pedido completado",
      notes: `Salida automatica por pedido ${String(order._id)}`,
      source: stockRows.length > 0 ? "warehouse-stock" : "import-fallback",
    });
  }
}

apiRouter.get("/health", (_request, response) => {
  response.json({ status: "ok" });
});

apiRouter.get("/uploads/cloudinary/signature", (request, response) => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    response.status(500).json({ message: "Cloudinary no esta configurado en el backend." });
    return;
  }

  const purpose = typeof request.query.purpose === "string" ? request.query.purpose.trim() : "products";
  const folder = getCloudinaryFolder(purpose);

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = buildCloudinarySignature(
    {
      folder,
      timestamp,
    },
    env.CLOUDINARY_API_SECRET,
  );

  response.json({
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    folder,
    timestamp,
    signature,
  });
});

apiRouter.get("/bootstrap", (_request, response) => {
  response.json({
    company: "SPS Export",
    route: "Colombia -> Aruba",
    roles: roleSummary,
    modules: [
      "catalog",
      "orders",
      "inventory",
      "procurement",
      "management-dashboard",
    ],
  });
});

apiRouter.post("/auth/login", async (request, response) => {
  const { email, password, role } = request.body as {
    email?: string;
    password?: string;
    role?: string;
  };

  if (!email || !password) {
    response.status(400).json({ message: "email and password are required" });
    return;
  }

  const query = role ? { email, password, role, active: true } : { email, password, active: true };
  const user = await User.findOne(query).lean();

  if (!user) {
    response.status(401).json({ message: "Invalid credentials" });
    return;
  }

  response.json({
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
});

apiRouter.get("/sales/routes", async (request, response) => {
  const salesRepId = typeof request.query.salesRepId === "string" ? request.query.salesRepId.trim() : "";

  if (!salesRepId) {
    response.status(400).json({ message: "Indica el vendedor para consultar sus rutas." });
    return;
  }

  const routes = await SalesRoute.find({ salesRepId, active: { $ne: false } })
    .sort({ weekStart: -1, createdAt: -1 })
    .lean();
  response.json(routes);
});

apiRouter.get("/sales/stores/:id/products", async (request, response) => {
  try {
    const store = await Store.findById(request.params.id).lean();

    if (!store) {
      response.status(404).json({ message: "El cliente no existe." });
      return;
    }

    const assignedProductIds = Array.isArray(store.assignedProductIds)
      ? store.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
      : [];

    if (assignedProductIds.length === 0) {
      response.json({
        store: {
          id: String(store._id),
          name: store.name,
          address: store.address ?? "",
          managerName: store.managerName ?? "",
        },
        products: [],
      });
      return;
    }

    const products = await Product.find({ _id: { $in: assignedProductIds }, active: { $ne: false } })
      .sort({ name: 1 })
      .lean();

    response.json({
      store: {
        id: String(store._id),
        name: store.name,
        address: store.address ?? "",
        managerName: store.managerName ?? "",
      },
      products: products.map((product) => ({
        productId: String(product._id),
        sku: product.sku,
        name: product.name,
        category: product.category,
        imageUrl: product.imageUrl ?? "",
        salePrice: Number(product.salePrice ?? 0),
      })),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/sales/orders", async (request, response) => {
  const salesRepId = typeof request.query.salesRepId === "string" ? request.query.salesRepId.trim() : "";

  if (!salesRepId) {
    response.status(400).json({ message: "Indica el vendedor para consultar sus pedidos." });
    return;
  }

  try {
    const orders = await Order.find({ salesRepId })
      .sort({ createdAt: -1, updatedAt: -1 })
      .lean();

    const productIds = Array.from(new Set(orders.flatMap((order) => order.items.map((item) => String(item.productId)).filter(Boolean))));
    const products = productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1 }).lean()
      : [];
    const productsById = new Map(products.map((product) => [String(product._id), product]));

    response.json(
      orders.map((order) => ({
        _id: String(order._id),
        routeId: order.routeId ?? "",
        routeName: order.routeName ?? "",
        routeDay: order.routeDay ?? "",
        storeId: order.storeId,
        storeName: order.storeName,
        salesRepId: order.salesRepId,
        salesRepName: order.salesRepName,
        deliveryZone: order.deliveryZone,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((item) => {
          const relatedProduct = productsById.get(String(item.productId));

          return {
            productId: String(item.productId),
            stockCurrent: item.stockCurrent === undefined || item.stockCurrent === null ? null : Number(item.stockCurrent),
            quantity: Number(item.quantity ?? 0),
            notes: item.notes ?? "",
            productName: relatedProduct?.name ?? "Producto eliminado",
            productSku: relatedProduct?.sku ?? "-",
          };
        }),
      })),
    );
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/sales/orders", async (request, response) => {
  try {
    const payload = normalizeSalesOrderPayload(request.body);
    const [store, salesRep, products] = await Promise.all([
      Store.findById(payload.storeId).lean(),
      User.findById(payload.salesRepId).lean(),
      Product.find({ _id: { $in: payload.items.map((item) => item.productId) }, active: { $ne: false } }).select({ _id: 1 }).lean(),
    ]);

    if (!store) {
      response.status(404).json({ message: "El cliente no existe." });
      return;
    }

    if (!salesRep || salesRep.role !== "sales-rep-aruba") {
      response.status(404).json({ message: "El vendedor no existe o no esta habilitado." });
      return;
    }

    const validAssignedProductIds = new Set(
      Array.isArray(store.assignedProductIds)
        ? store.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
        : [],
    );
    const availableProductIds = new Set(products.map((product) => String(product._id)));
    const invalidItem = payload.items.find((item) => !validAssignedProductIds.has(item.productId) || !availableProductIds.has(item.productId));

    if (invalidItem) {
      throw new Error("Uno o varios productos del pedido ya no estan asignados a este cliente.");
    }

    const order = await Order.create({
      routeId: payload.routeId,
      routeName: payload.routeName,
      routeDay: payload.routeDay,
      storeId: String(store._id),
      storeName: store.name,
      salesRepId: String(salesRep._id),
      salesRepName: salesRep.name,
      deliveryZone: store.address?.trim() || store.name,
      status: "submitted",
      items: payload.items,
    });

    response.status(201).json({
      message: `Pedido enviado a bodega para ${store.name}.`,
      order,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/sales/orders/:id", async (request, response) => {
  try {
    const payload = normalizeSalesOrderPayload(request.body);
    const order = await Order.findById(request.params.id);

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    if (
      order.salesRepId !== payload.salesRepId ||
      order.storeId !== payload.storeId ||
      order.routeId !== payload.routeId ||
      order.routeDay !== payload.routeDay
    ) {
      response.status(400).json({ message: "El pedido no coincide con la ruta o cliente seleccionados." });
      return;
    }

    if (!canEditSellerOrder(order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt))) {
      response.status(400).json({ message: "El tiempo para modificar el pedido ha caducado." });
      return;
    }

    const [store, products] = await Promise.all([
      Store.findById(payload.storeId).lean(),
      Product.find({ _id: { $in: payload.items.map((item) => item.productId) }, active: { $ne: false } }).select({ _id: 1 }).lean(),
    ]);

    if (!store) {
      response.status(404).json({ message: "El cliente no existe." });
      return;
    }

    const validAssignedProductIds = new Set(
      Array.isArray(store.assignedProductIds)
        ? store.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
        : [],
    );
    const availableProductIds = new Set(products.map((product) => String(product._id)));
    const invalidItem = payload.items.find((item) => !validAssignedProductIds.has(item.productId) || !availableProductIds.has(item.productId));

    if (invalidItem) {
      throw new Error("Uno o varios productos del pedido ya no estan asignados a este cliente.");
    }

    await Order.findByIdAndUpdate(order._id, { items: payload.items }, { runValidators: true });

    response.json({
      message: "Pedido actualizado correctamente.",
      order: {
        ...order.toObject(),
        items: payload.items,
      },
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/warehouse/orders", async (_request, response) => {
  try {
    const orders = await Order.find()
      .sort({ createdAt: -1, updatedAt: -1 })
      .lean();

    const productIds = Array.from(new Set(orders.flatMap((order) => order.items.map((item) => String(item.productId)).filter(Boolean))));
    const products = productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1 }).lean()
      : [];
    const productsById = new Map(products.map((product) => [String(product._id), product]));

    response.json(
      orders.map((order) => ({
        _id: String(order._id),
        routeId: order.routeId ?? "",
        routeName: order.routeName ?? "",
        routeDay: order.routeDay ?? "",
        storeId: order.storeId,
        storeName: order.storeName,
        salesRepId: order.salesRepId,
        salesRepName: order.salesRepName,
        deliveryZone: order.deliveryZone,
        status: order.status,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((item) => {
          const relatedProduct = productsById.get(String(item.productId));

          return {
            productId: String(item.productId),
            stockCurrent: item.stockCurrent === undefined || item.stockCurrent === null ? null : Number(item.stockCurrent),
            quantity: Number(item.quantity ?? 0),
            notes: item.notes ?? "",
            productName: relatedProduct?.name ?? "Producto eliminado",
            productSku: relatedProduct?.sku ?? "-",
          };
        }),
      })),
    );
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/warehouse/orders/:id/complete", async (request, response) => {
  try {
    const order = await Order.findById(request.params.id).lean();

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    await applyOrderInventoryDeduction({
      _id: order._id,
      items: Array.isArray(order.items) ? order.items : [],
    });

    if (order.status === "delivered") {
      response.json({
        message: "El pedido ya estaba completado; inventario sincronizado correctamente.",
        order: {
          _id: String(order._id),
          status: order.status,
          updatedAt: order.updatedAt,
        },
      });
      return;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      request.params.id,
      {
        status: "delivered",
      },
      {
        new: true,
        runValidators: true,
      },
    ).lean();

    if (!updatedOrder) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    response.json({
      message: "Pedido completado correctamente.",
      order: {
        _id: String(updatedOrder._id),
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt,
      },
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/kpis", async (_request, response) => {
  const [users, clients, categories, products, suppliers, warehouses, routes] = await Promise.all([
    User.countDocuments({ active: true }),
    Store.countDocuments({ active: true }),
    Category.countDocuments({ active: true }),
    Product.countDocuments({ active: true }),
    Supplier.countDocuments({ active: true }),
    Warehouse.countDocuments({ active: true }),
    SalesRoute.countDocuments({ active: true }),
  ]);

  response.json({
    cards: [
      { label: "Usuarios activos", value: users, tone: "cyan" },
      { label: "Clientes", value: clients, tone: "amber" },
      { label: "Categorias", value: categories, tone: "slate" },
      { label: "Productos", value: products, tone: "cyan" },
      { label: "Proveedores", value: suppliers, tone: "amber" },
      { label: "Bodegas", value: warehouses, tone: "slate" },
      { label: "Rutas semanales", value: routes, tone: "cyan" },
    ],
  });
});

apiRouter.get("/management/users", async (_request, response) => {
  const users = await User.find().sort({ createdAt: -1 }).lean();
  response.json(users);
});

apiRouter.get("/management/clients", async (_request, response) => {
  const clients = await Store.find().sort({ createdAt: -1 }).lean();
  response.json(clients);
});

apiRouter.get("/management/categories", async (_request, response) => {
  const categories = await Category.find().sort({ createdAt: -1 }).lean();
  response.json(categories);
});

apiRouter.get("/management/products", async (_request, response) => {
  const products = await Product.find().sort({ createdAt: -1 }).lean();
  response.json(products);
});

apiRouter.get("/management/catalogs", async (_request, response) => {
  const catalogs = await CatalogRecord.find().sort({ createdAt: -1 }).lean();
  response.json(catalogs);
});

apiRouter.get("/management/catalogs/:id/preview", async (request, response) => {
  try {
    const catalog = await CatalogRecord.findById(request.params.id).lean();

    if (!catalog) {
      response.status(404).json({ message: "El catalogo no existe." });
      return;
    }

    const catalogId = catalog._id;

    const clientId = typeof request.query.clientId === "string" ? request.query.clientId.trim() : "";
    const [items, clientPricing] = await Promise.all([
      resolveCatalogProducts(catalog),
      clientId
        ? CatalogClientPricing.findOne({ catalogId: catalog._id, clientId }).lean()
        : CatalogClientPricing.findOne({ catalogId: catalog._id, active: { $ne: false } }).sort({ updatedAt: -1 }).lean(),
    ]);

    const savedPricingMap = new Map(
      (clientPricing?.items ?? []).map((item) => [String(item.productId), Number(item.salePrice ?? 0)]),
    );

    response.json({
      catalog,
      clientPricing,
      items: items.map((item) => ({
        ...item,
        salePrice: savedPricingMap.get(item.productId) ?? item.salePrice,
      })),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/suppliers", async (_request, response) => {
  const suppliers = await Supplier.find().sort({ createdAt: -1 }).lean();
  response.json(suppliers);
});

apiRouter.get("/management/warehouses", async (_request, response) => {
  const warehouses = await Warehouse.find().sort({ createdAt: -1 }).lean();
  response.json(warehouses);
});

apiRouter.get("/management/routes", async (_request, response) => {
  const routes = await SalesRoute.find().sort({ weekStart: -1, createdAt: -1 }).lean();
  response.json(routes);
});

apiRouter.get("/management/accounting/import-costs", async (_request, response) => {
  const importCosts = await ImportCost.find().sort({ importDate: -1, createdAt: -1 }).lean();
  response.json(importCosts);
});

apiRouter.get("/management/accounting/fixed-costs", async (_request, response) => {
  const fixedCosts = await FixedCost.find().sort({ createdAt: -1 }).lean();
  response.json(fixedCosts);
});

apiRouter.get("/management/accounting/operational-expenses", async (_request, response) => {
  const operationalExpenses = await OperationalExpense.find().sort({ expenseDate: -1, createdAt: -1 }).lean();
  response.json(operationalExpenses);
});

apiRouter.get("/management/inventory-summary", async (request, response) => {
  const businessUnit = typeof request.query.businessUnit === "string" && request.query.businessUnit.trim().toLowerCase() === "aruba"
    ? "aruba"
    : "colombia";

  const [products, importCosts, warehouseStocks, inventoryAdjustments] = await Promise.all([
    Product.find({ active: { $ne: false } }).sort({ name: 1 }).lean(),
    ImportCost.find({ active: { $ne: false } }).sort({ importDate: -1, createdAt: -1 }).lean(),
    WarehouseStock.find().lean(),
    InventoryAdjustment.find().lean(),
  ]);

  const importCostRowsByProduct = new Map<string, typeof importCosts>();

  importCosts.forEach((row: (typeof importCosts)[number]) => {
    const productId = String(row.productId);
    const currentRows = importCostRowsByProduct.get(productId) ?? [];
    currentRows.push(row);
    importCostRowsByProduct.set(productId, currentRows);
  });

  const stockRowsByProduct = new Map<string, typeof warehouseStocks>();

  warehouseStocks.forEach((row: (typeof warehouseStocks)[number]) => {
    const productId = String(row.productId);
    const currentRows = stockRowsByProduct.get(productId) ?? [];
    currentRows.push(row);
    stockRowsByProduct.set(productId, currentRows);
  });

  const adjustmentsByProduct = inventoryAdjustments.reduce((map, adjustment) => {
    const productId = String(adjustment.productId);
    map.set(productId, (map.get(productId) ?? 0) + Number(adjustment.quantity ?? 0));
    return map;
  }, new Map<string, number>());

  const now = new Date();
  const twoMonthsLater = new Date(now);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

  const rows = products.map((product: (typeof products)[number]) => {
    const productId = String(product._id);
    const productImportRows = importCostRowsByProduct.get(productId) ?? [];
    const productStockRows = stockRowsByProduct.get(productId) ?? [];
    const latestImportRow = productImportRows[0] ?? null;
    const importedQuantity = productImportRows.reduce(
      (sum: number, row: (typeof productImportRows)[number]) => sum + Number(row.importedQuantity ?? 0),
      0,
    );
    const availableUnitsFromStocks = productStockRows.reduce(
      (sum: number, row: (typeof productStockRows)[number]) => sum + Number(row.availableUnits ?? 0),
      0,
    );
    const deductedUnits = adjustmentsByProduct.get(productId) ?? 0;
    const quantity = productStockRows.length > 0 ? availableUnitsFromStocks : Math.max(importedQuantity - deductedUnits, 0);
    const arubaPurchaseCostUsd = Number(product.arubaPurchaseCostUsd ?? 0);
    const arubaUsdToAwgRate = Number(product.arubaUsdToAwgRate ?? 1.79);
    const arubaUnitCostAwg = arubaPurchaseCostUsd * arubaUsdToAwgRate;
    const unitCost = businessUnit === "aruba"
      ? Number(arubaUnitCostAwg > 0 ? arubaUnitCostAwg : product.cost ?? 0)
      : Number(latestImportRow?.landedUnitCost ?? product.cost ?? 0);
    const salePrice = Number(product.salePrice ?? 0);
    const totalCost = quantity * unitCost;
    const totalSale = quantity * salePrice;
    const importRowQuantity = Number(latestImportRow?.importedQuantity ?? 0);
    const expenseCategoryTotals = (latestImportRow?.expenseItems ?? []).reduce(
      (sum, expense) => {
        const key = String(expense?.key ?? "other");
        sum.set(key, (sum.get(key) ?? 0) + Number(expense?.amount ?? 0));
        return sum;
      },
      new Map<string, number>(),
    );
    const categorizedAllocatedTotals = {
      freight: Number(latestImportRow?.freightCost ?? 0),
      customs: Number(latestImportRow?.customsCost ?? 0),
      inlandLogistics: Number(latestImportRow?.inlandLogisticsCost ?? 0),
      taxes: Number(latestImportRow?.taxesCost ?? 0),
      other: Number(latestImportRow?.otherImportCosts ?? 0),
    };
    const unitCostBreakdown = businessUnit === "colombia" && latestImportRow
      ? {
          containerReference: latestImportRow.containerReference ?? "",
          shipmentReference: latestImportRow.shipmentReference ?? "",
          importDate: latestImportRow.importDate,
          importQuantity: importRowQuantity,
          purchaseUnitCost: Number(latestImportRow.purchaseUnitCostLocal ?? latestImportRow.purchaseUnitCostOrigin ?? product.cost ?? 0),
          expenseRows: (latestImportRow.expenseItems ?? []).map((expense, index) => {
            const key = String(expense?.key ?? "other");
            const expenseAmount = Number(expense?.amount ?? 0);
            const categoryTotal = expenseCategoryTotals.get(key) ?? 0;
            const allocatedTotal = categoryTotal > 0
              ? categorizedAllocatedTotals[key as keyof typeof categorizedAllocatedTotals] * (expenseAmount / categoryTotal)
              : 0;

            return {
              id: `${productId}-${key}-${index}`,
              label: String(expense?.label ?? "Gasto"),
              totalAmount: allocatedTotal,
              unitAmount: importRowQuantity > 0 ? allocatedTotal / importRowQuantity : 0,
            };
          }),
          totalUnitCost: unitCost,
        }
      : null;
    const expirationDate = product.expirationDate instanceof Date
      ? product.expirationDate
      : product.expirationDate
        ? new Date(product.expirationDate)
        : null;
    const isExpiringSoon = Boolean(
      expirationDate &&
      !Number.isNaN(expirationDate.getTime()) &&
      expirationDate >= now &&
      expirationDate <= twoMonthsLater,
    );

    return {
      productId,
      sku: product.sku,
      name: product.name,
      quantity,
      unitCost,
      totalCost,
      salePrice,
      totalSale,
      unitCostBreakdown,
      expirationDate: expirationDate ? expirationDate.toISOString() : null,
      isExpiringSoon,
    };
  });

  const kpis = {
    totalProducts: rows.length,
    totalUnits: rows.reduce((sum: number, row: (typeof rows)[number]) => sum + row.quantity, 0),
    totalInventoryCost: rows.reduce((sum: number, row: (typeof rows)[number]) => sum + row.totalCost, 0),
    expiringSoon: rows.filter((row: (typeof rows)[number]) => row.isExpiringSoon).length,
  };

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const history = [...inventoryAdjustments]
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
    .map((adjustment) => {
      const product = productById.get(String(adjustment.productId));
      const source = String(adjustment.source ?? "");

      return {
        id: String(adjustment._id),
        productId: String(adjustment.productId),
        productName: String(product?.name ?? "Producto"),
        productSku: String(product?.sku ?? ""),
        quantity: Number(adjustment.quantity ?? 0),
        reason: String(adjustment.reason ?? ""),
        notes: String(adjustment.notes ?? ""),
        source,
        movementType: source === "inventory-entry" ? "entry" : "output",
        entryGroupId: String(adjustment.entryGroupId ?? ""),
        entryWarehouseId: String(adjustment.entryWarehouseId ?? ""),
        entryWarehouseName: String(adjustment.entryWarehouseName ?? ""),
        entryUsdToAwgRate: Number(adjustment.entryUsdToAwgRate ?? 0) > 0
          ? Number(adjustment.entryUsdToAwgRate)
          : Number(product?.arubaUsdToAwgRate ?? 1.79),
        entryCostUsd: Number(adjustment.entryCostUsd ?? 0) > 0
          ? Number(adjustment.entryCostUsd)
          : Number(product?.arubaPurchaseCostUsd ?? 0),
        createdAt: String(adjustment.createdAt ?? new Date().toISOString()),
      };
    });

  response.json({ rows, kpis, history });
});

apiRouter.post("/management/inventory-adjustments", async (request, response) => {
  try {
    const productId = typeof request.body?.productId === "string" ? request.body.productId.trim() : "";
    const quantity = Number(request.body?.quantity ?? 0);
    const reason = typeof request.body?.reason === "string" ? request.body.reason.trim() : "";
    const notes = typeof request.body?.notes === "string" ? request.body.notes.trim() : "";

    if (!productId) {
      response.status(400).json({ message: "Selecciona un producto del inventario." });
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      response.status(400).json({ message: "Ingresa una cantidad valida para sacar del inventario." });
      return;
    }

    if (!reason) {
      response.status(400).json({ message: "Selecciona o escribe un motivo para la salida." });
      return;
    }

    const [product, stockRows, importRows, previousAdjustments] = await Promise.all([
      Product.findById(productId).lean(),
      WarehouseStock.find({ productId }).sort({ availableUnits: -1, createdAt: 1 }),
      ImportCost.find({ productId, active: { $ne: false } }).lean(),
      InventoryAdjustment.find({ productId }).lean(),
    ]);

    if (!product) {
      response.status(404).json({ message: "El producto no existe." });
      return;
    }

    const currentStock = stockRows.reduce((sum, row) => sum + Number(row.availableUnits ?? 0), 0);
    const importedQuantity = importRows.reduce((sum, row) => sum + Number(row.importedQuantity ?? 0), 0);
    const deductedQuantity = previousAdjustments.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    const availableQuantity = stockRows.length > 0 ? currentStock : Math.max(importedQuantity - deductedQuantity, 0);

    if (quantity > availableQuantity) {
      response.status(400).json({ message: `Solo hay ${availableQuantity} unidades disponibles para sacar.` });
      return;
    }

    if (stockRows.length > 0) {
      let remaining = quantity;

      for (const stockRow of stockRows) {
        if (remaining <= 0) {
          break;
        }

        const rowAvailable = Number(stockRow.availableUnits ?? 0);
        const nextAvailable = Math.max(rowAvailable - remaining, 0);
        const deductedFromRow = rowAvailable - nextAvailable;

        if (deductedFromRow <= 0) {
          continue;
        }

        remaining -= deductedFromRow;
        await WarehouseStock.findByIdAndUpdate(stockRow._id, { availableUnits: nextAvailable }, { runValidators: true });
      }
    }

    const createdAdjustment = await InventoryAdjustment.create({
      productId,
      quantity,
      reason,
      notes,
      source: stockRows.length > 0 ? "warehouse-stock" : "import-fallback",
    });

    response.status(201).json({
      message: "Salida de inventario registrada correctamente.",
      adjustment: createdAdjustment,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/inventory-entries", async (request, response) => {
  try {
    const warehouseId = typeof request.body?.warehouseId === "string" ? request.body.warehouseId.trim() : "";
    const usdToAwgRate = Number(request.body?.usdToAwgRate ?? 0);
    const rawItems: unknown[] = Array.isArray(request.body?.items) ? request.body.items : [];

    if (!Number.isFinite(usdToAwgRate) || usdToAwgRate <= 0) {
      response.status(400).json({ message: "Ingresa una tasa valida en USD@AWG mayor a cero." });
      return;
    }

    if (rawItems.length === 0) {
      response.status(400).json({ message: "Agrega al menos un producto para registrar inventario." });
      return;
    }

    const items = rawItems.map((entry: unknown, index: number) => {
      if (typeof entry !== "object" || entry === null) {
        throw new Error(`El producto #${index + 1} no es valido.`);
      }

      const item = entry as { productId?: unknown; quantity?: unknown; costUsd?: unknown };
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const quantity = Number(item.quantity ?? 0);
      const costUsd = Number(item.costUsd ?? 0);

      if (!productId) {
        throw new Error(`El producto #${index + 1} no tiene identificador valido.`);
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`La cantidad del producto #${index + 1} debe ser mayor a cero.`);
      }

      if (!Number.isFinite(costUsd) || costUsd < 0) {
        throw new Error(`El costo del producto #${index + 1} debe ser cero o mayor.`);
      }

      return { productId, quantity, costUsd };
    });

    const uniqueProductIds = Array.from(new Set(items.map((item: (typeof items)[number]) => item.productId)));

    if (uniqueProductIds.length !== items.length) {
      response.status(400).json({ message: "No repitas el mismo producto dentro del mismo registro de inventario." });
      return;
    }

    const warehouse = warehouseId
      ? await Warehouse.findById(warehouseId).lean()
      : await Warehouse.findOne({ active: { $ne: false } }).sort({ createdAt: 1 }).lean();

    if (!warehouse || warehouse.active === false) {
      response.status(400).json({ message: "Selecciona una bodega activa para registrar inventario." });
      return;
    }

    const products = await Product.find({ _id: { $in: uniqueProductIds }, active: { $ne: false } }).lean();
    const productsById = new Map(products.map((product) => [String(product._id), product]));

    const entryGroupId = `inventory-entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    for (const item of items) {
      const product = productsById.get(item.productId);

      if (!product) {
        response.status(404).json({ message: `El producto ${item.productId} no existe o esta inactivo.` });
        return;
      }

      const existingStockRow = await WarehouseStock.findOne({
        productId: product._id,
        warehouseCode: warehouse.code,
      }).lean();

      const currentAvailableUnits = Number(existingStockRow?.availableUnits ?? 0);
      const nextAvailableUnits = currentAvailableUnits + item.quantity;
      const minUnits = Number(existingStockRow?.minUnits ?? product.inventoryAlert ?? 0);

      await WarehouseStock.findOneAndUpdate(
        {
          productId: product._id,
          warehouseCode: warehouse.code,
        },
        {
          productId: product._id,
          warehouseCode: warehouse.code,
          availableUnits: nextAvailableUnits,
          minUnits,
          status: resolveWarehouseStockStatus(nextAvailableUnits, minUnits),
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          runValidators: true,
        },
      );

      const unitCostUsd = item.quantity > 0 ? item.costUsd / item.quantity : item.costUsd;

      await Product.findByIdAndUpdate(product._id, {
        arubaPurchaseCostUsd: unitCostUsd,
        arubaUsdToAwgRate: usdToAwgRate,
      }, {
        runValidators: true,
      });

      await InventoryAdjustment.create({
        productId: product._id,
        quantity: item.quantity,
        reason: "Entrada de inventario",
        notes: "Registro de entrada manual o por carga de Excel.",
        entryGroupId,
        entryWarehouseId: String(warehouse._id),
        entryWarehouseName: String(warehouse.name ?? ""),
        entryUsdToAwgRate: usdToAwgRate,
        entryCostUsd: unitCostUsd,
        source: "inventory-entry",
      });
    }

    response.status(201).json({
      message: `Inventario registrado para ${items.length} producto${items.length === 1 ? "" : "s"} en ${warehouse.name}.`,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/inventory-entries/fix-legacy-unit-costs", async (_request, response) => {
  try {
    const legacyAdjustments = await InventoryAdjustment.find({
      source: "inventory-entry",
      $or: [{ entryGroupId: { $exists: false } }, { entryGroupId: "" }],
    }).lean();

    const latestByProduct = new Map<string, { entryCostUsd: number; quantity: number; entryUsdToAwgRate: number }>();

    for (const adj of legacyAdjustments) {
      const productId = String(adj.productId);
      const entryCostUsd = Number((adj as unknown as Record<string, unknown>).entryCostUsd ?? 0);
      const quantity = Number(adj.quantity ?? 0);
      const entryUsdToAwgRate = Number((adj as unknown as Record<string, unknown>).entryUsdToAwgRate ?? 0);

      if (!latestByProduct.has(productId) && quantity > 0 && entryCostUsd > 0) {
        latestByProduct.set(productId, { entryCostUsd, quantity, entryUsdToAwgRate });
      }
    }

    let fixed = 0;

    for (const [productId, data] of latestByProduct.entries()) {
      const unitCostUsd = data.entryCostUsd / data.quantity;
      const usdToAwgRate = data.entryUsdToAwgRate > 0 ? data.entryUsdToAwgRate : 1.79;

      await Product.findByIdAndUpdate(productId, {
        arubaPurchaseCostUsd: unitCostUsd,
        arubaUsdToAwgRate: usdToAwgRate,
      }, { runValidators: true });

      await InventoryAdjustment.updateMany(
        { productId, $or: [{ entryGroupId: { $exists: false } }, { entryGroupId: "" }] },
        { $set: { entryCostUsd: unitCostUsd } },
      );

      fixed += 1;
    }

    response.json({ message: `Costo unitario corregido para ${fixed} producto${fixed === 1 ? "" : "s"}.`, fixed });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/inventory-entries/import-excel", async (request, response) => {
  try {
    const fileBase64 = typeof request.body?.fileBase64 === "string" ? request.body.fileBase64.trim() : "";

    if (!fileBase64) {
      response.status(400).json({ message: "Adjunta un archivo Excel valido para importar." });
      return;
    }

    const buffer = Buffer.from(fileBase64, "base64");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];

    if (!firstSheetName) {
      response.status(400).json({ message: "El archivo Excel no contiene hojas de calculo." });
      return;
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: "" });

    if (rows.length === 0) {
      response.status(400).json({ message: "El Excel no contiene filas para importar." });
      return;
    }

    const normalizeText = (value: unknown) => String(value ?? "").trim();
    const getRowField = (row: Record<string, unknown>, candidates: string[]) => {
      for (const key of candidates) {
        if (key in row && String(row[key] ?? "").trim().length > 0) {
          return row[key];
        }
      }

      return "";
    };

    const parsedRows = rows.map((row, index) => ({
      index,
      productId: normalizeText(getRowField(row, ["PRODUCT_ID", "productId", "producto_id"])),
      sku: normalizeText(getRowField(row, ["SKU", "sku"])),
      productName: normalizeText(getRowField(row, ["PRODUCTO", "Producto", "productName", "PRODUCT_NAME"])),
      quantity: Number(getRowField(row, ["CANTIDAD", "cantidad", "quantity", "UNIDADES"])),
      saleUsd: Number(getRowField(row, ["PRECIO_VENTA_USD", "VENTA_USD", "venta_usd", "SALE_USD", "VENTA"])),
    }));

    const productIds = parsedRows.map((row) => row.productId).filter(Boolean);
    const skus = parsedRows.map((row) => row.sku.toLowerCase()).filter(Boolean);
    const names = parsedRows.map((row) => row.productName.toLowerCase()).filter(Boolean);
    const products = await Product.find({ active: { $ne: false } }).lean();
    const productsById = new Map(products.map((product) => [String(product._id), product]));
    const productsBySku = new Map(products.map((product) => [String(product.sku ?? "").toLowerCase(), product]));
    const productsByName = new Map(products.map((product) => [String(product.name ?? "").toLowerCase(), product]));

    const detectedItems = parsedRows.map((row, index) => {
      const product =
        (row.productId ? productsById.get(row.productId) : undefined)
        ?? (row.sku ? productsBySku.get(row.sku.toLowerCase()) : undefined)
        ?? (row.productName ? productsByName.get(row.productName.toLowerCase()) : undefined);

      if (!product) {
        throw new Error(`No se encontro el producto en la fila ${index + 1}. Usa PRODUCT_ID o SKU valido.`);
      }

      if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
        throw new Error(`La cantidad de la fila ${index + 1} debe ser mayor a cero.`);
      }

      if (!Number.isFinite(row.saleUsd) || row.saleUsd < 0) {
        throw new Error(`El precio de venta USD de la fila ${index + 1} debe ser cero o mayor.`);
      }

      return {
        productId: String(product._id),
        quantity: row.quantity,
        costUsd: row.saleUsd,
        productName: String(product.name ?? ""),
        productSku: String(product.sku ?? ""),
      };
    });

    const uniqueProductCount = new Set(detectedItems.map((item) => item.productId)).size;

    if (uniqueProductCount !== detectedItems.length) {
      response.status(400).json({ message: "El Excel tiene productos repetidos. Deja una sola fila por producto." });
      return;
    }

    response.json({
      message: `Excel procesado con ${detectedItems.length} producto${detectedItems.length === 1 ? "" : "s"}.`,
      items: detectedItems,
      matchedBy: {
        productId: productIds.length,
        sku: skus.length,
        productName: names.length,
      },
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/warehouse-locations", async (request, response) => {
  const warehouseId = typeof request.query.warehouseId === "string" ? request.query.warehouseId.trim() : "";
  const filter = warehouseId ? { warehouseId } : {};
  const locations = await WarehouseLocation.find(filter)
    .sort({ shelf: 1, floor: 1, rack: 1, productName: 1 })
    .lean();

  response.json(locations);
});

apiRouter.post("/management/users", async (request, response) => {
  try {
    const user = await User.create(request.body);
    response.status(201).json(user);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/users/:id", async (request, response) => {
  try {
    const user = await User.findByIdAndUpdate(request.params.id, request.body, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      response.status(404).json({ message: "El usuario no existe." });
      return;
    }

    response.json(user);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/users/:id", async (request, response) => {
  try {
    const user = await User.findByIdAndDelete(request.params.id);

    if (!user) {
      response.status(404).json({ message: "El usuario no existe." });
      return;
    }

    response.json({ message: "Usuario borrado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/clients", async (request, response) => {
  try {
    const payload = await normalizeClientPayload(request.body);
    const client = await Store.create({
      code: buildInternalCode("CLI"),
      ...payload,
    });
    response.status(201).json(client);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/clients/:id", async (request, response) => {
  try {
    const payload = await normalizeClientPayload(request.body);
    const client = await Store.findByIdAndUpdate(request.params.id, payload, {
      new: true,
      runValidators: true,
    });

    if (!client) {
      response.status(404).json({ message: "El cliente no existe." });
      return;
    }

    response.json(client);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/clients/:id", async (request, response) => {
  try {
    const client = await Store.findByIdAndDelete(request.params.id);

    if (!client) {
      response.status(404).json({ message: "El cliente no existe." });
      return;
    }

    response.json({ message: "Cliente borrado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/categories", async (request, response) => {
  try {
    const payload = typeof request.body === "object" && request.body !== null ? request.body as Record<string, unknown> : {};
    const name = typeof payload.name === "string" ? payload.name.trim() : "";

    if (!name) {
      throw new Error("El nombre de la categoria es obligatorio.");
    }

    const category = await Category.create({
      code: buildInternalCode("CAT"),
      name,
      description: typeof payload.description === "string" ? payload.description.trim() : "",
    });
    response.status(201).json(category);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/categories/:id", async (request, response) => {
  try {
    const category = await Category.findByIdAndUpdate(request.params.id, request.body, {
      new: true,
      runValidators: true,
    });

    if (!category) {
      response.status(404).json({ message: "La categoria no existe." });
      return;
    }

    response.json(category);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/categories/:id", async (request, response) => {
  try {
    const category = await Category.findByIdAndDelete(request.params.id);

    if (!category) {
      response.status(404).json({ message: "La categoria no existe." });
      return;
    }

    response.json({ message: "Categoria borrada correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/products", async (request, response) => {
  try {
    const product = await Product.create(request.body);
    response.status(201).json(product);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/products/:id", async (request, response) => {
  try {
    const product = await Product.findByIdAndUpdate(request.params.id, request.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      response.status(404).json({ message: "El producto no existe." });
      return;
    }

    response.json(product);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/products/:id", async (request, response) => {
  try {
    const product = await Product.findByIdAndDelete(request.params.id);

    if (!product) {
      response.status(404).json({ message: "El producto no existe." });
      return;
    }

    response.json({ message: "Producto borrado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/catalogs", async (request, response) => {
  try {
    const payload = normalizeCatalogPayload(request.body);
    const catalog = await CatalogRecord.create({
      code: buildInternalCode("CTL"),
      ...payload,
      availableForOrders: false,
    });

    response.status(201).json(catalog);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/catalogs/:id", async (request, response) => {
  try {
    const payload = normalizeCatalogPayload(request.body);
    const catalog = await CatalogRecord.findByIdAndUpdate(request.params.id, {
      ...payload,
      availableForOrders: false,
    }, {
      new: true,
      runValidators: true,
    });

    if (!catalog) {
      response.status(404).json({ message: "El catalogo no existe." });
      return;
    }

    response.json(catalog);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/catalogs/:id", async (request, response) => {
  try {
    const catalog = await CatalogRecord.findByIdAndDelete(request.params.id);

    if (!catalog) {
      response.status(404).json({ message: "El catalogo no existe." });
      return;
    }

    await CatalogClientPricing.deleteMany({ catalogId: catalog._id });
    response.json({ message: "Catalogo borrado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/catalogs/:id/client-pricing", async (request, response) => {
  try {
    const catalog = await CatalogRecord.findById(request.params.id).lean();

    if (!catalog) {
      response.status(404).json({ message: "El catalogo no existe." });
      return;
    }

    const payload = normalizeCatalogClientPricingPayload(request.body);
    const clients = await Store.find({ _id: { $in: payload.clientIds } }).lean();
    const clientsById = new Map(clients.map((client) => [String(client._id), client]));
    const missingClientId = payload.clientIds.find((clientId) => !clientsById.has(clientId));

    if (missingClientId) {
      throw new Error("El cliente seleccionado no existe.");
    }

    const catalogProducts = await resolveCatalogProducts(catalog);
    const catalogProductMap = new Map(catalogProducts.map((item) => [item.productId, item]));
    const items = payload.items.map((item) => {
      const product = catalogProductMap.get(item.productId);

      if (!product) {
        throw new Error("Uno o varios productos ya no hacen parte del catalogo seleccionado.");
      }

      return {
        productId: item.productId,
        productName: product.name,
        productSku: product.sku,
        cost: item.cost,
        salePrice: item.salePrice,
      };
    });

    await Promise.all(
      payload.clientIds.map(async (clientId) => {
        const client = clientsById.get(clientId);

        if (!client) {
          return;
        }

        await CatalogClientPricing.findOneAndUpdate(
          { catalogId: catalog._id, clientId: client._id },
          {
            catalogId: catalog._id,
            catalogName: catalog.name,
            clientId: client._id,
            clientName: client.name,
            markupPercent: payload.markupPercent,
            items,
            active: true,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            runValidators: true,
          },
        );
      }),
    );

    await CatalogRecord.findByIdAndUpdate(catalog._id, {
      availableForOrders: true,
    }, {
      runValidators: true,
    });

    response.json({ message: "Catalogo del cliente guardado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/catalogs/:id/send-whatsapp", async (request, response) => {
  try {
    if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN) {
      throw new Error("Configura TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN para enviar catalogos por WhatsApp.");
    }

    const catalog = await CatalogRecord.findById(request.params.id).lean();

    if (!catalog) {
      response.status(404).json({ message: "El catalogo no existe." });
      return;
    }

    const payload = normalizeCatalogWhatsappPayload(request.body);
    const clients = await Store.find({ _id: { $in: payload.clientIds } }).lean();
    const clientsById = new Map(clients.map((client) => [String(client._id), client]));
    const missingClientId = payload.clientIds.find((clientId) => !clientsById.has(clientId));

    if (missingClientId) {
      throw new Error("Uno o varios clientes seleccionados ya no existen.");
    }

    const fromNumber = normalizePhoneForWhatsApp(env.TWILIO_WHATSAPP_FROM_NUMBER);

    if (!fromNumber) {
      throw new Error("El numero de WhatsApp configurado para la empresa no es valido.");
    }

    const twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
    const deliveryResults = await Promise.allSettled(
      payload.clientIds.map(async (clientId) => {
        const client = clientsById.get(clientId);

        if (!client) {
          throw new Error("Cliente no encontrado.");
        }

        const destinationNumber = normalizePhoneForWhatsApp(client.phone);

        if (!destinationNumber) {
          throw new Error(`El cliente ${client.name} no tiene un telefono valido.`);
        }

        const messageBody = (payload.message || "Hola {{cliente}}, te compartimos el catalogo general {{catalogo}} de SPS Trading Enterprises. Archivo: {{archivo}}")
          .replace(/\{\{\s*cliente\s*\}\}/gi, client.name)
          .replace(/\{\{\s*catalogo\s*\}\}/gi, catalog.name)
          .replace(/\{\{\s*archivo\s*\}\}/gi, payload.fileName);

        await twilioClient.messages.create({
          from: `whatsapp:${fromNumber}`,
          to: `whatsapp:${destinationNumber}`,
          body: messageBody,
          mediaUrl: [payload.pdfUrl],
        });

        return client.name;
      }),
    );

    const failedClients = deliveryResults.flatMap((result, index) => {
      if (result.status === "fulfilled") {
        return [];
      }

      const client = clientsById.get(payload.clientIds[index]);
      return [client?.name ?? payload.clientIds[index]];
    });
    const sentCount = payload.clientIds.length - failedClients.length;

    if (sentCount === 0) {
      response.status(400).json({
        message: "No fue posible enviar el catalogo por WhatsApp a los clientes seleccionados.",
        sentCount,
        failedClients,
      });
      return;
    }

    response.json({
      message: failedClients.length === 0
        ? `Catalogo enviado por WhatsApp a ${sentCount} cliente${sentCount === 1 ? "" : "s"}.`
        : `Catalogo enviado a ${sentCount} cliente${sentCount === 1 ? "" : "s"}. No fue posible entregarlo a ${failedClients.length}.`,
      sentCount,
      failedClients,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/suppliers", async (request, response) => {
  try {
    const supplier = await Supplier.create({
      code: buildInternalCode("SUP"),
      ...request.body,
    });
    response.status(201).json(supplier);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/suppliers/:id", async (request, response) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(request.params.id, request.body, {
      new: true,
      runValidators: true,
    });

    if (!supplier) {
      response.status(404).json({ message: "El proveedor no existe." });
      return;
    }

    response.json(supplier);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/suppliers/:id", async (request, response) => {
  try {
    const supplier = await Supplier.findByIdAndDelete(request.params.id);

    if (!supplier) {
      response.status(404).json({ message: "El proveedor no existe." });
      return;
    }

    response.json({ message: "Proveedor borrado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/warehouses", async (request, response) => {
  try {
    const warehouse = await Warehouse.create({
      code: buildInternalCode("WH"),
      ...request.body,
    });
    response.status(201).json(warehouse);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/warehouses/:id", async (request, response) => {
  try {
    const warehouse = await Warehouse.findByIdAndUpdate(request.params.id, request.body, {
      new: true,
      runValidators: true,
    });

    if (!warehouse) {
      response.status(404).json({ message: "La bodega no existe." });
      return;
    }

    response.json(warehouse);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/warehouses/:id", async (request, response) => {
  try {
    const warehouse = await Warehouse.findByIdAndDelete(request.params.id);

    if (!warehouse) {
      response.status(404).json({ message: "La bodega no existe." });
      return;
    }

    response.json({ message: "Bodega borrada correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/routes", async (request, response) => {
  try {
    const route = await SalesRoute.create({
      code: buildInternalCode("RTE"),
      ...normalizeSalesRoutePayload(request.body),
    });
    response.status(201).json(route);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/routes/:id", async (request, response) => {
  try {
    const route = await SalesRoute.findByIdAndUpdate(request.params.id, normalizeSalesRoutePayload(request.body), {
      new: true,
      runValidators: true,
    });

    if (!route) {
      response.status(404).json({ message: "La ruta no existe." });
      return;
    }

    response.json(route);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/routes/:id", async (request, response) => {
  try {
    const route = await SalesRoute.findByIdAndDelete(request.params.id);

    if (!route) {
      response.status(404).json({ message: "La ruta no existe." });
      return;
    }

    response.json({ message: "Ruta borrada correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/accounting/import-costs", async (request, response) => {
  try {
    const payload = normalizeImportCostPayload(request.body);
    const containerReference = buildInternalCode(payload.containerSize === "40ft" ? "CONT40" : "CONT20");
    const importCosts = await buildImportCostRows(payload, containerReference);

    const createdImportCosts = await ImportCost.insertMany(importCosts);
    response.status(201).json(createdImportCosts);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/accounting/import-batches/:containerReference", async (request, response) => {
  try {
    const batchRows = await ImportCost.find({ containerReference: request.params.containerReference })
      .sort({ createdAt: 1 })
      .lean();

    if (batchRows.length === 0) {
      response.status(404).json({ message: "El lote de exportacion no existe." });
      return;
    }

    const firstRow = batchRows[0];
    response.json({
      containerReference: firstRow.containerReference,
      containerType: firstRow.containerType ?? "seco",
      containerSize: firstRow.containerSize,
      measurementUnit: firstRow.measurementUnit ?? "m3",
      shipmentReference: firstRow.shipmentReference ?? "",
      importDate: firstRow.importDate,
      notes: firstRow.notes ?? "",
      expenseItems: firstRow.expenseItems ?? [],
      products: batchRows.map((row) => ({
        productId: String(row.productId),
        importedQuantity: Number(row.importedQuantity ?? 0),
        purchaseUnitCostOrigin: Number(row.purchaseUnitCostOrigin ?? 0),
      })),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/accounting/import-batches/:containerReference", async (request, response) => {
  try {
    const existingRows = await ImportCost.find({ containerReference: request.params.containerReference }).lean();

    if (existingRows.length === 0) {
      response.status(404).json({ message: "El lote de exportacion no existe." });
      return;
    }

    const payload = normalizeImportCostPayload(request.body);
    const nextRows = await buildImportCostRows(payload, request.params.containerReference);

    await ImportCost.deleteMany({ containerReference: request.params.containerReference });
    const updatedRows = await ImportCost.insertMany(nextRows);
    response.json(updatedRows);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/accounting/import-batches/:containerReference/invoice-pricing", async (request, response) => {
  try {
    const parseDecimalValue = (value: unknown) => {
      if (typeof value === "number") {
        return Number.isFinite(value) ? value : Number.NaN;
      }

      if (typeof value !== "string") {
        return Number.NaN;
      }

      const trimmed = value.trim();

      if (!trimmed) {
        return Number.NaN;
      }

      let normalized = trimmed.replace(/\s+/g, "");

      if (normalized.includes(",") && normalized.includes(".")) {
        if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
          normalized = normalized.replace(/\./g, "").replace(",", ".");
        } else {
          normalized = normalized.replace(/,/g, "");
        }
      } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
      }

      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : Number.NaN;
    };

    const containerReference = typeof request.params.containerReference === "string" ? request.params.containerReference.trim() : "";
    const trmCopPerUsd = parseDecimalValue(request.body?.trmCopPerUsd);
    const rawRows: Array<Record<string, unknown>> = Array.isArray(request.body?.rows)
      ? request.body.rows as Array<Record<string, unknown>>
      : [];

    if (!containerReference) {
      response.status(400).json({ message: "El contenedor de la factura no es valido." });
      return;
    }

    if (!Number.isFinite(trmCopPerUsd) || trmCopPerUsd <= 0) {
      response.status(400).json({ message: "Define una TRM valida (COP por 1 USD) para guardar la factura." });
      return;
    }

    if (rawRows.length === 0) {
      response.status(400).json({ message: "La factura no contiene productos para guardar." });
      return;
    }

    const batchRows = await ImportCost.find({ containerReference, active: { $ne: false } }).lean();

    if (batchRows.length === 0) {
      response.status(404).json({ message: "El lote de exportacion no existe." });
      return;
    }

    const saleUsdByProductId = new Map<string, number>();

    rawRows.forEach((entry: Record<string, unknown>, index: number) => {
      const current = typeof entry === "object" && entry !== null ? entry : {};
      const productId = typeof current.productId === "string" ? current.productId.trim() : "";
      const saleUsd = parseDecimalValue(current.saleUsd);

      if (!productId) {
        throw new Error(`La fila ${index + 1} no tiene productId valido.`);
      }

      if (!Number.isFinite(saleUsd) || saleUsd < 0) {
        throw new Error(`El precio de venta USD de la fila ${index + 1} debe ser cero o mayor.`);
      }

      saleUsdByProductId.set(productId, saleUsd);
    });

    const now = new Date();
    const operations = batchRows.map((row) => {
      const productId = String(row.productId);
      const importedQuantity = Number(row.importedQuantity ?? 0);
      const totalImportCost = Number(row.totalImportCost ?? 0);

      if (!saleUsdByProductId.has(productId)) {
        throw new Error(`Falta el precio facturado para el producto ${productId}.`);
      }

      const saleUnitUsd = Number(saleUsdByProductId.get(productId));
      const saleUnitCop = saleUnitUsd * trmCopPerUsd;
      const lineTotalCop = saleUnitCop * importedQuantity;
      const lineUtilityCop = lineTotalCop - totalImportCost;

      return {
        updateOne: {
          filter: { _id: row._id },
          update: {
            $set: {
              invoicedSaleUnitUsd: saleUnitUsd,
              invoicedSaleUnitCop: saleUnitCop,
              invoicedLineTotalCop: lineTotalCop,
              invoicedLineUtilityCop: lineUtilityCop,
              invoiceGeneratedAt: now,
            },
          },
        },
      };
    });

    if (operations.length > 0) {
      await ImportCost.bulkWrite(operations);
    }

    response.json({
      message: `Factura guardada para ${operations.length} producto${operations.length === 1 ? "" : "s"}.`,
      updated: operations.length,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/accounting/import-batches/:containerReference", async (request, response) => {
  try {
    const result = await ImportCost.deleteMany({ containerReference: request.params.containerReference });

    if (!result.deletedCount) {
      response.status(404).json({ message: "El lote de exportacion no existe." });
      return;
    }

    response.json({ message: "Exportacion borrada correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/accounting/fixed-costs", async (request, response) => {
  try {
    const fixedCost = await FixedCost.create(normalizeFixedCostPayload(request.body));
    response.status(201).json(fixedCost);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/accounting/operational-expenses", async (request, response) => {
  try {
    const operationalExpense = await OperationalExpense.create(normalizeOperationalExpensePayload(request.body));
    response.status(201).json(operationalExpense);
  } catch (error) {
    sendCreationError(response, error);
  }
});

// ─── Logística: facturas de pedidos (AWG) ────────────────────────────────────

function normalizeLogisticsInvoicePayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("La factura logistica enviada no es valida.");
  }

  const payload = body as Record<string, unknown>;
  const invoiceDateValue = typeof payload.invoiceDate === "string" ? payload.invoiceDate.trim() : "";
  const storeName = typeof payload.storeName === "string" ? payload.storeName.trim() : "";
  const salesRepName = typeof payload.salesRepName === "string" ? payload.salesRepName.trim() : "";
  const routeName = typeof payload.routeName === "string" ? payload.routeName.trim() : "";
  const orderId = typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";

  if (!invoiceDateValue || !storeName) {
    throw new Error("Fecha y cliente son obligatorios en la factura logistica.");
  }

  const invoiceDate = new Date(invoiceDateValue);

  if (Number.isNaN(invoiceDate.getTime())) {
    throw new Error("La fecha de la factura logistica no es valida.");
  }

  const rawItems = Array.isArray(payload.items) ? payload.items as Array<Record<string, unknown>> : [];

  if (rawItems.length === 0) {
    throw new Error("La factura debe tener al menos un producto.");
  }

  const items = rawItems.map((item, index) => {
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const productName = typeof item.productName === "string" ? item.productName.trim() : "";
    const productSku = typeof item.productSku === "string" ? item.productSku.trim() : "";
    const quantity = Number(item.quantity ?? 0);
    const salePriceAwg = Number(item.salePriceAwg ?? 0);
    const unitCostAwg = Number(item.unitCostAwg ?? 0);

    if (!productId || !productName || quantity <= 0 || salePriceAwg < 0) {
      throw new Error(`El producto en la fila ${index + 1} tiene datos invalidos.`);
    }

    const lineTotalAwg = salePriceAwg * quantity;
    const lineUtilityAwg = lineTotalAwg - unitCostAwg * quantity;

    return { productId, productName, productSku, quantity, salePriceAwg, lineTotalAwg, unitCostAwg, lineUtilityAwg };
  });

  const totalRevenueAwg = items.reduce((sum, item) => sum + item.lineTotalAwg, 0);
  const totalCostAwg = items.reduce((sum, item) => sum + item.unitCostAwg * item.quantity, 0);
  const totalUtilityAwg = totalRevenueAwg - totalCostAwg;

  return { invoiceDate, storeName, salesRepName, routeName, orderId, notes, items, totalRevenueAwg, totalCostAwg, totalUtilityAwg };
}

function normalizeLogisticsFixedCostPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("El costo fijo logistico enviado no es valido.");
  }

  const payload = body as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const frequency = typeof payload.frequency === "string" ? payload.frequency.trim() : "";
  const startDateValue = typeof payload.startDate === "string" ? payload.startDate.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const amountAwg = Number(payload.amountAwg ?? 0);

  if (!name || !category || !frequency || !startDateValue || amountAwg < 0) {
    throw new Error("Nombre, categoria, frecuencia, fecha y monto del costo fijo son obligatorios.");
  }

  const startDate = new Date(startDateValue);

  if (Number.isNaN(startDate.getTime())) {
    throw new Error("La fecha del costo fijo no es valida.");
  }

  return { name, category, frequency, amountAwg, startDate, notes };
}

function normalizeLogisticsExpensePayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    throw new Error("El gasto logistico enviado no es valido.");
  }

  const payload = body as Record<string, unknown>;
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const category = typeof payload.category === "string" ? payload.category.trim() : "";
  const expenseDateValue = typeof payload.expenseDate === "string" ? payload.expenseDate.trim() : "";
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : "";
  const amountAwg = Number(payload.amountAwg ?? 0);

  if (!name || !category || !expenseDateValue || amountAwg < 0) {
    throw new Error("Nombre, categoria, fecha y monto del gasto logistico son obligatorios.");
  }

  const expenseDate = new Date(expenseDateValue);

  if (Number.isNaN(expenseDate.getTime())) {
    throw new Error("La fecha del gasto logistico no es valida.");
  }

  return { name, category, amountAwg, expenseDate, notes };
}

async function syncDeliveredOrdersIntoLogisticsInvoices() {
  const deliveredOrders = await Order.find({ status: "delivered" })
    .select({
      _id: 1,
      storeId: 1,
      storeName: 1,
      salesRepName: 1,
      routeName: 1,
      items: 1,
      updatedAt: 1,
      createdAt: 1,
    })
    .lean();

  if (deliveredOrders.length === 0) {
    return;
  }

  const productIds = Array.from(
    new Set(
      deliveredOrders.flatMap((order) =>
        (order.items ?? [])
          .map((item) => String(item.productId ?? "").trim())
          .filter(Boolean),
      ),
    ),
  );
  const clientIds = Array.from(
    new Set(
      deliveredOrders
        .map((order) => String(order.storeId ?? "").trim())
        .filter(Boolean),
    ),
  );

  const [products, latestImportCosts, clientPricingRows] = await Promise.all([
    productIds.length > 0
      ? Product.find({ _id: { $in: productIds } })
          .select({ _id: 1, name: 1, sku: 1, salePrice: 1, cost: 1, arubaPurchaseCostUsd: 1, arubaUsdToAwgRate: 1 })
          .lean()
      : Promise.resolve([]),
    productIds.length > 0
      ? ImportCost.find({ productId: { $in: productIds } }).sort({ importDate: -1, createdAt: -1 }).lean()
      : Promise.resolve([]),
    clientIds.length > 0
      ? CatalogClientPricing.find({ clientId: { $in: clientIds } })
          .sort({ updatedAt: -1, createdAt: -1 })
          .lean()
      : Promise.resolve([]),
  ]);

  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const latestCostMap = new Map<string, number>();
  const clientProductSalePriceMap = new Map<string, number>();

  latestImportCosts.forEach((row) => {
    const productId = String(row.productId ?? "");

    if (productId && !latestCostMap.has(productId)) {
      latestCostMap.set(productId, Number(row.landedUnitCost ?? 0));
    }
  });

  clientPricingRows.forEach((pricingRow) => {
    const clientId = String(pricingRow.clientId ?? "").trim();

    if (!clientId || !Array.isArray(pricingRow.items)) {
      return;
    }

    pricingRow.items.forEach((item) => {
      const productId = String(item.productId ?? "").trim();

      if (!productId) {
        return;
      }

      const key = `${clientId}:${productId}`;
      const candidateSalePrice = Number(item.salePrice ?? 0);
      const currentSalePrice = clientProductSalePriceMap.get(key);

      if (currentSalePrice === undefined) {
        clientProductSalePriceMap.set(key, candidateSalePrice);
        return;
      }

      if (currentSalePrice <= 0 && candidateSalePrice > 0) {
        clientProductSalePriceMap.set(key, candidateSalePrice);
      }
    });
  });

  const now = new Date();
  const upsertOperations = deliveredOrders.map(async (order) => {
    const orderId = String(order._id);
    const storeId = String(order.storeId ?? "").trim();
    const normalizedItems = (order.items ?? []).flatMap((item) => {
      const productId = String(item.productId ?? "").trim();
      const quantity = Number(item.quantity ?? 0);

      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        return [];
      }

      const product = productsById.get(productId);
  const clientSalePriceKey = storeId ? `${storeId}:${productId}` : "";
  const catalogSalePrice = clientSalePriceKey ? Number(clientProductSalePriceMap.get(clientSalePriceKey) ?? NaN) : NaN;
  const baseSalePrice = Number(product?.salePrice ?? 0);
  const salePriceAwg = Math.max(0, Number.isFinite(catalogSalePrice) ? catalogSalePrice : baseSalePrice);
      const arubaPurchaseCostUsd = Number(product?.arubaPurchaseCostUsd ?? 0);
      const arubaUsdToAwgRate = Number(product?.arubaUsdToAwgRate ?? 1.79);
      const arubaCostAwg = arubaPurchaseCostUsd * arubaUsdToAwgRate;
      const fallbackCostAwg = Number(latestCostMap.get(productId) ?? Number(product?.cost ?? 0));
      const unitCostAwg = Math.max(0, arubaCostAwg > 0 ? arubaCostAwg : (Number.isFinite(fallbackCostAwg) ? fallbackCostAwg : 0));
      const lineTotalAwg = salePriceAwg * quantity;
      const lineUtilityAwg = lineTotalAwg - unitCostAwg * quantity;

      return [{
        productId,
        productName: String(product?.name ?? "Producto"),
        productSku: String(product?.sku ?? "-"),
        quantity,
        salePriceAwg,
        lineTotalAwg,
        unitCostAwg,
        lineUtilityAwg,
      }];
    });

    if (normalizedItems.length === 0) {
      return;
    }

    const totalRevenueAwg = normalizedItems.reduce((sum, item) => sum + Number(item.lineTotalAwg ?? 0), 0);
    const totalCostAwg = normalizedItems.reduce((sum, item) => sum + Number(item.unitCostAwg ?? 0) * Number(item.quantity ?? 0), 0);
    const totalUtilityAwg = totalRevenueAwg - totalCostAwg;
    const invoiceDateCandidate = order.updatedAt ?? order.createdAt;
    const invoiceDate = invoiceDateCandidate ? new Date(invoiceDateCandidate) : now;

    await LogisticsInvoice.findOneAndUpdate(
      { orderId },
      {
        orderId,
        invoiceDate: Number.isNaN(invoiceDate.getTime()) ? now : invoiceDate,
        storeName: String(order.storeName ?? "Cliente"),
        salesRepName: String(order.salesRepName ?? ""),
        routeName: String(order.routeName ?? ""),
        notes: "Generada automaticamente desde pedido facturado.",
        items: normalizedItems,
        totalRevenueAwg,
        totalCostAwg,
        totalUtilityAwg,
        active: true,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    );
  });

  await Promise.all(upsertOperations);
}

apiRouter.get("/management/logistics-accounting/invoices", async (_request, response) => {
  await syncDeliveredOrdersIntoLogisticsInvoices();
  const invoices = await LogisticsInvoice.find({ active: { $ne: false } }).sort({ invoiceDate: -1, createdAt: -1 }).lean();
  response.json(invoices);
});

apiRouter.get("/management/logistics-accounting/billed-orders", async (_request, response) => {
  await syncDeliveredOrdersIntoLogisticsInvoices();
  const billedOrders = await LogisticsInvoice.find({
    active: { $ne: false },
    orderId: { $exists: true, $ne: "" },
  })
    .sort({ invoiceDate: -1, createdAt: -1 })
    .lean();

  response.json(
    billedOrders.map((invoice) => ({
      _id: String(invoice._id),
      orderId: String(invoice.orderId ?? ""),
      invoiceDate: invoice.invoiceDate,
      storeName: String(invoice.storeName ?? "Cliente"),
      salesRepName: String(invoice.salesRepName ?? ""),
      routeName: String(invoice.routeName ?? ""),
      totalCostAwg: Number(invoice.totalCostAwg ?? 0),
      totalRevenueAwg: Number(invoice.totalRevenueAwg ?? 0),
      totalUtilityAwg: Number(invoice.totalUtilityAwg ?? 0),
    })),
  );
});

apiRouter.post("/management/logistics-accounting/invoices", async (request, response) => {
  try {
    const invoice = await LogisticsInvoice.create(normalizeLogisticsInvoicePayload(request.body));
    response.status(201).json(invoice);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/logistics-accounting/invoices/:id", async (request, response) => {
  try {
    const invoice = await LogisticsInvoice.findByIdAndUpdate(
      request.params.id,
      { active: false },
      { new: true },
    );

    if (!invoice) {
      response.status(404).json({ message: "La factura logistica no existe." });
      return;
    }

    response.json({ message: "Factura logistica borrada correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/logistics-accounting/fixed-costs", async (_request, response) => {
  const fixedCosts = await LogisticsFixedCost.find({ active: { $ne: false } }).sort({ createdAt: -1 }).lean();
  response.json(fixedCosts);
});

apiRouter.post("/management/logistics-accounting/fixed-costs", async (request, response) => {
  try {
    const fixedCost = await LogisticsFixedCost.create(normalizeLogisticsFixedCostPayload(request.body));
    response.status(201).json(fixedCost);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/logistics-accounting/expenses", async (_request, response) => {
  const expenses = await LogisticsExpense.find({ active: { $ne: false } }).sort({ expenseDate: -1, createdAt: -1 }).lean();
  response.json(expenses);
});

apiRouter.post("/management/logistics-accounting/expenses", async (request, response) => {
  try {
    const expense = await LogisticsExpense.create(normalizeLogisticsExpensePayload(request.body));
    response.status(201).json(expense);
  } catch (error) {
    sendCreationError(response, error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────

apiRouter.post("/management/warehouse-locations", async (request, response) => {
  try {
    const payload = normalizeWarehouseLocationPayload(request.body);
    const [warehouse, product] = await Promise.all([
      Warehouse.findById(payload.warehouseId).lean(),
      Product.findById(payload.productId).lean(),
    ]);

    if (!warehouse || warehouse.active === false) {
      throw new Error("La bodega seleccionada no existe o esta inactiva.");
    }

    if (!product || product.active === false) {
      throw new Error("El producto seleccionado no existe o esta inactivo.");
    }

    const location = await WarehouseLocation.findOneAndUpdate(
      { warehouseId: warehouse._id, productId: product._id },
      {
        warehouseId: warehouse._id,
        warehouseName: warehouse.name,
        warehouseCode: warehouse.code,
        productId: product._id,
        productName: product.name,
        productSku: product.sku,
        shelf: payload.shelf,
        floor: payload.floor,
        rack: payload.rack,
        active: true,
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      },
    ).lean();

    response.status(201).json(location);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/warehouse-locations/:id", async (request, response) => {
  try {
    const location = await WarehouseLocation.findByIdAndDelete(request.params.id);

    if (!location) {
      response.status(404).json({ message: "La ubicacion seleccionada no existe." });
      return;
    }

    response.json({ message: "Ubicacion borrada correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});
