import { createHash } from "node:crypto";

import { Request, Response, Router } from "express";
import {
  assertTwilioWhatsAppConfigured,
  buildInboundWhatsappAutoReplyMessage,
  normalizePhoneForWhatsApp,
  renderCatalogWhatsappMessage,
  resolveClientWhatsappNumber,
  sendWhatsAppMessage,
} from "../services/twilio.service.js";
import * as XLSX from "xlsx";

import { env } from "../config/env.js";
import { FixedCost } from "../modules/accounting/fixed-cost.model.js";
import { ImportCost } from "../modules/accounting/import-cost.model.js";
import { LogisticsExpense } from "../modules/accounting/logistics-expense.model.js";
import { LogisticsFixedCost } from "../modules/accounting/logistics-fixed-cost.model.js";
import { CarteraCollection } from "../modules/accounting/cartera-collection.model.js";
import { CarteraEntry } from "../modules/accounting/cartera-entry.model.js";
import { LogisticsInvoice } from "../modules/accounting/logistics-invoice.model.js";
import { OperationalExpense } from "../modules/accounting/operational-expense.model.js";
import { Category } from "../modules/categories/category.model.js";
import { CatalogClientPricing } from "../modules/catalog/catalog-client-pricing.model.js";
import { CatalogRecord } from "../modules/catalog/catalog-record.model.js";
import { roleSummary } from "../modules/dashboard/dashboard.service.js";
import { InventoryAdjustment } from "../modules/inventory/inventory-adjustment.model.js";
import { LotPromotion } from "../modules/inventory/lot-promotion.model.js";
import { WarehouseLocation } from "../modules/inventory/warehouse-location.model.js";
import { WarehouseStock } from "../modules/inventory/warehouse-stock.model.js";
import { ImportTemplate } from "../modules/imports/import-template.model.js";
import { Order } from "../modules/orders/order.model.js";
import { InvoiceChangeRequest } from "../modules/orders/invoice-change-request.model.js";
import { OrderDeleteRequest } from "../modules/orders/order-delete-request.model.js";
import { Product } from "../modules/catalog/product.model.js";
import { SalesRoute } from "../modules/routes/route.model.js";
import { OperationsClient } from "../modules/stores/operations-client.model.js";
import { Store } from "../modules/stores/store.model.js";
import { Supplier } from "../modules/suppliers/supplier.model.js";
import { User } from "../modules/users/user.model.js";
import { SalesRepGoal } from "../modules/users/sales-rep-goal.model.js";
import { Warehouse } from "../modules/warehouses/warehouse.model.js";
import { isFirebasePushConfigured } from "../services/firebase-admin.service.js";
import {
  notifyNewSalesOrder,
  notifyContabilidadOrderDispatched,
  notifyRouteAssigned,
  registerPushToken,
  unregisterPushToken,
} from "../services/push-notification.service.js";

export const apiRouter = Router();

const cloudinaryProductFolder = "spste/products";
const cloudinaryImportDocumentsFolder = "spste/import-documents";
const cloudinaryCatalogPdfFolder = "spste/catalog-pdfs";

function buildInternalCode(prefix: string) {
  return `${prefix}-${Date.now()}`;
}

function normalizeImportHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}

function normalizeImportText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeImportNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const normalized = normalizeImportText(value).replace(/,/g, ".");

  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeImportBoolean(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = normalizeImportText(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["si", "sí", "yes", "true", "1", "x", "ok"].includes(normalized)) {
    return true;
  }

  if (["no", "false", "0"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function getImportRowField(row: Record<string, unknown>, candidates: string[]) {
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeImportHeader(candidate);

    for (const [key, value] of Object.entries(row)) {
      if (normalizeImportHeader(key) === normalizedCandidate && normalizeImportText(value).length > 0) {
        return value;
      }
    }
  }

  return "";
}

function detectImportHeaderRow(rows: unknown[][], requiredCandidates: string[][]) {
  return rows.findIndex((row) => {
    if (!Array.isArray(row)) {
      return false;
    }

    const normalizedCells = row.map((cell) => normalizeImportHeader(cell)).filter(Boolean);

    if (normalizedCells.length === 0) {
      return false;
    }

    return requiredCandidates.every((candidateGroup) =>
      candidateGroup.some((candidate) => normalizedCells.includes(normalizeImportHeader(candidate))),
    );
  });
}

function mapImportRowsFromSheet(rows: unknown[][], headerRowIndex: number) {
  const headerRow = rows[headerRowIndex] ?? [];
  const dataRows = rows.slice(headerRowIndex + 1);

  return dataRows
    .map((row) => {
      const entries = headerRow.map((headerCell, index) => [String(headerCell ?? ""), row[index] ?? ""] as const);
      return Object.fromEntries(entries) as Record<string, unknown>;
    })
    .filter((row) => Object.values(row).some((value) => normalizeImportText(value).length > 0));
}

async function ensureImportCategory(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("La categoria es obligatoria para importar productos.");
  }

  const existingCategory = await Category.findOne({ name: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();

  if (existingCategory) {
    return existingCategory;
  }

  return Category.create({
    code: buildInternalCode("CAT"),
    name: trimmedName,
    description: "Creada automaticamente desde la importacion de productos.",
    active: true,
  });
}

async function ensureImportSupplier(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    throw new Error("El proveedor es obligatorio para importar productos.");
  }

  const existingSupplier = await Supplier.findOne({ name: new RegExp(`^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).lean();

  if (existingSupplier) {
    return existingSupplier;
  }

  return Supplier.create({
    code: buildInternalCode("SUP"),
    name: trimmedName,
    contactName: "",
    email: "",
    phoneCountryCode: "+297",
    phone: "",
    active: true,
  });
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
    excludedProductIds?: unknown;
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
  const excludedProductIds = Array.isArray(payload.excludedProductIds)
    ? payload.excludedProductIds
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
    excludedProductIds: [...new Set(excludedProductIds)],
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
      stockRowId?: unknown;
      lotName?: unknown;
      cost?: unknown;
      salePrice?: unknown;
    };

    const productId = typeof currentItem.productId === "string" ? currentItem.productId.trim() : "";
    const stockRowId = typeof currentItem.stockRowId === "string" ? currentItem.stockRowId.trim() : "";
    const lotName = typeof currentItem.lotName === "string" ? currentItem.lotName.trim() : "";
    const cost = Number(currentItem.cost ?? 0);
    const salePrice = Number(currentItem.salePrice ?? 0);

    if (!productId) {
      throw new Error(`El producto #${index + 1} no tiene identificador valido.`);
    }

    if (cost < 0 || salePrice < 0) {
      throw new Error("Los costos y precios de venta deben ser valores positivos.");
    }

    return { productId, stockRowId, lotName, cost, salePrice };
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
    defaultPaymentMethod?: unknown;
  };

  const name = typeof payload.name === "string" ? payload.name.trim() : "";

  if (!name) {
    throw new Error("El nombre comercial del cliente es obligatorio.");
  }

  const uniqueAssignedProductIds = await normalizeAssignedProductIds(payload.assignedProductIds);
  const rawDefaultPaymentMethod = typeof payload.defaultPaymentMethod === "string"
    ? payload.defaultPaymentMethod.trim().toLowerCase()
    : "";
  const allowedDefaultPaymentMethods = new Set(["credito", "transferencia", "efectivo"]);
  const defaultPaymentMethod = allowedDefaultPaymentMethods.has(rawDefaultPaymentMethod)
    ? rawDefaultPaymentMethod
    : "";

  return {
    name,
    managerName: typeof payload.managerName === "string" ? payload.managerName.trim() : "",
    email: typeof payload.email === "string" ? payload.email.trim() : "",
    phoneCountryCode: typeof payload.phoneCountryCode === "string" ? payload.phoneCountryCode.trim() : "",
    phone: typeof payload.phone === "string" ? payload.phone.trim() : "",
    address: typeof payload.address === "string" ? payload.address.trim() : "",
    assignedProductIds: uniqueAssignedProductIds,
    defaultPaymentMethod,
  };
}

async function normalizeAssignedProductIds(value: unknown) {
  const assignedProductIds = Array.isArray(value)
    ? value
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

  return uniqueAssignedProductIds;
}

async function normalizeOperationsClientPayload(body: unknown) {
  const payload = await normalizeClientPayload(body);
  const { assignedProductIds: _assignedProductIds, ...operationsClientPayload } = payload;
  return operationsClientPayload;
}

async function resolveCatalogProducts(catalog: {
  productIds?: Array<unknown>;
  categoryNames?: Array<string>;
  excludedProductIds?: Array<unknown>;
}) {
  const explicitProductIds = Array.isArray(catalog.productIds)
    ? catalog.productIds.map((entry) => String(entry)).filter(Boolean)
    : [];
  const categoryNames = Array.isArray(catalog.categoryNames)
    ? catalog.categoryNames.map((entry) => entry.trim()).filter(Boolean)
    : [];
  const excludedProductIds = new Set(
    Array.isArray(catalog.excludedProductIds)
      ? catalog.excludedProductIds.map((entry) => String(entry)).filter(Boolean)
      : [],
  );

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
    shareWithAruba: { $ne: false },
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

  return products
    .filter((product) => !excludedProductIds.has(String(product._id)))
    .map((product) => {
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
    const expirationDateValue = typeof currentProduct.expirationDate === "string" ? currentProduct.expirationDate.trim() : "";

    if (!productId || importedQuantity < 0 || purchaseUnitCostOrigin < 0 || purchaseBoxCostOrigin < 0) {
      throw new Error("Cada producto debe incluir referencia valida, cantidad y costos validos.");
    }

    if (expirationDateValue) {
      const expirationDate = new Date(expirationDateValue);

      if (Number.isNaN(expirationDate.getTime())) {
        throw new Error(`La fecha de caducidad del producto #${index + 1} no es valida.`);
      }
    }

    return {
      productId,
      importedQuantity,
      purchaseUnitCostOrigin,
      purchaseBoxCostOrigin,
      expirationDateValue,
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
      expirationDate: normalizeOptionalDateValue(row.expirationDateValue),
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

const BUSINESS_TIMEZONE = "America/Aruba";

function getBusinessDateKeyFromDate(referenceDate = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(referenceDate);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function normalizeDeliveryDate(value: unknown) {
  const dateKey = typeof value === "string" ? value.trim() : "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    const parsed = new Date(`${dateKey}T12:00:00`);

    if (!Number.isNaN(parsed.getTime())) {
      const todayKey = getBusinessDateKeyFromDate();

      if (dateKey < todayKey) {
        throw new Error("La fecha de entrega no puede ser anterior a hoy.");
      }

      return parsed;
    }
  }

  return new Date(`${getBusinessDateKeyFromDate()}T12:00:00`);
}

function serializeOrderDeliveryDate(value: Date | string | undefined, fallback?: Date) {
  const source = value ?? fallback ?? new Date();
  const date = source instanceof Date ? source : new Date(source);
  return getBusinessDateKeyFromDate(Number.isNaN(date.getTime()) ? new Date() : date);
}

function resolveOrderInvoiceDate(order: {
  deliveryDate?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}) {
  const deliveryKey = serializeOrderDeliveryDate(order.deliveryDate, order.createdAt ? new Date(order.createdAt) : undefined);
  const parsed = parseBusinessDateKey(deliveryKey);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  if (order.updatedAt) {
    const updatedAt = order.updatedAt instanceof Date ? order.updatedAt : new Date(order.updatedAt);

    if (!Number.isNaN(updatedAt.getTime())) {
      return updatedAt;
    }
  }

  return new Date();
}

async function ensureOrderDeliveryDates() {
  await Order.updateMany(
    { $or: [{ deliveryDate: { $exists: false } }, { deliveryDate: null }] },
    [{ $set: { deliveryDate: "$createdAt" } }],
  );
}

const WAREHOUSE_DELIVERY_CUTOFF_HOUR = 18;

function addDaysToBusinessDateKey(dateKey: string, days: number) {
  const parsed = new Date(`${dateKey}T12:00:00`);
  parsed.setDate(parsed.getDate() + days);
  return getBusinessDateKeyFromDate(parsed);
}

function parseBusinessDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00`);
}

function getArubaHour(referenceDate = new Date()) {
  const hourPart = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(referenceDate);

  return Number(hourPart.find((part) => part.type === "hour")?.value ?? 0);
}

async function syncOverdueDeliveryDates() {
  const now = new Date();
  const todayKey = getBusinessDateKeyFromDate(now);
  const tomorrowKey = addDaysToBusinessDateKey(todayKey, 1);
  const arubaHour = getArubaHour(now);

  const pendingOrders = await Order.find({ status: "submitted" })
    .select({ _id: 1, deliveryDate: 1 })
    .lean();

  await Promise.all(pendingOrders.map(async (order) => {
    const deliveryKey = serializeOrderDeliveryDate(order.deliveryDate);
    let nextDeliveryKey: string | null = null;

    if (deliveryKey < todayKey) {
      nextDeliveryKey = todayKey;
    } else if (deliveryKey === todayKey && arubaHour >= WAREHOUSE_DELIVERY_CUTOFF_HOUR) {
      nextDeliveryKey = tomorrowKey;
    }

    if (!nextDeliveryKey) {
      return;
    }

    await Order.findByIdAndUpdate(order._id, {
      deliveryDate: parseBusinessDateKey(nextDeliveryKey),
      deliveryOverdue: true,
    });
  }));
}

function normalizeOrderGiftItems(rawItems: unknown) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`El obsequio #${index + 1} no es valido.`);
    }

    const currentItem = item as {
      productId?: unknown;
      quantity?: unknown;
      stockRowId?: unknown;
      notes?: unknown;
    };
    const productId = typeof currentItem.productId === "string" ? currentItem.productId.trim() : "";
    const stockRowId = typeof currentItem.stockRowId === "string" ? currentItem.stockRowId.trim() : "";
    const quantity = Number(currentItem.quantity ?? 0);
    const notes = typeof currentItem.notes === "string" ? currentItem.notes.trim() : "";

    if (!productId) {
      throw new Error(`El obsequio #${index + 1} no tiene producto valido.`);
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error(`La cantidad del obsequio #${index + 1} debe ser mayor a cero.`);
    }

    return [{
      productId,
      quantity,
      ...(stockRowId ? { stockRowId } : {}),
      notes,
    }];
  });
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
    deliveryDate?: unknown;
    orderNotes?: unknown;
    items?: unknown;
    giftItems?: unknown;
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
      stockRowId?: unknown;
      salePriceAwg?: unknown;
      notes?: unknown;
    };

    const productId = typeof currentItem.productId === "string" ? currentItem.productId.trim() : "";
    const stockRowId = typeof currentItem.stockRowId === "string" ? currentItem.stockRowId.trim() : "";
    const stockCurrentValue = currentItem.stockCurrent;
    const hasStockCurrent = stockCurrentValue !== undefined && stockCurrentValue !== null && String(stockCurrentValue).trim() !== "";
    const stockCurrent = hasStockCurrent ? Number(stockCurrentValue) : null;
    const quantity = Number(currentItem.quantity ?? 0);
    const salePriceAwg = Number(currentItem.salePriceAwg ?? NaN);
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
      ...(stockRowId ? { stockRowId } : {}),
      ...(Number.isFinite(salePriceAwg) && salePriceAwg >= 0 ? { salePriceAwg: Math.round(salePriceAwg * 100) / 100 } : {}),
      notes,
    };
  });

  const orderNotes = typeof payload.orderNotes === "string" ? payload.orderNotes.trim() : "";
  const giftItems = normalizeOrderGiftItems(payload.giftItems);

  return {
    routeId,
    routeName,
    routeDay,
    storeId,
    salesRepId,
    deliveryDate: normalizeDeliveryDate(payload.deliveryDate),
    orderNotes,
    items,
    giftItems,
  };
}

function normalizeWarehouseOrderItems(
  rawItems: unknown,
  existingItems: Array<{ productId: unknown; stockCurrent?: unknown; notes?: unknown; salePriceAwg?: unknown; stockRowId?: unknown }>,
) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new Error("Agrega al menos un producto al pedido.");
  }

  const existingByProductId = new Map(
    existingItems.map((item) => [String(item.productId), item]),
  );

  const items = rawItems.flatMap((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error(`El producto #${index + 1} del pedido no es valido.`);
    }

    const currentItem = item as {
      productId?: unknown;
      stockCurrent?: unknown;
      quantity?: unknown;
      notes?: unknown;
      salePriceAwg?: unknown;
      stockRowId?: unknown;
    };
    const productId = typeof currentItem.productId === "string" ? currentItem.productId.trim() : "";
    const stockRowId = typeof currentItem.stockRowId === "string" ? currentItem.stockRowId.trim() : "";
    const quantity = Number(currentItem.quantity ?? 0);
    const notes = typeof currentItem.notes === "string" ? currentItem.notes.trim() : undefined;
    const stockCurrentValue = currentItem.stockCurrent;
    const hasStockCurrent = stockCurrentValue !== undefined && stockCurrentValue !== null && String(stockCurrentValue).trim() !== "";
    const stockCurrent = hasStockCurrent ? Number(stockCurrentValue) : null;

    if (!productId) {
      throw new Error(`El producto #${index + 1} no tiene identificador valido.`);
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error(`La cantidad del producto #${index + 1} debe ser cero o mayor.`);
    }

    if (quantity <= 0) {
      return [];
    }

    const payloadSalePriceAwg = Number(currentItem.salePriceAwg ?? NaN);
    const hasPayloadSalePrice = Number.isFinite(payloadSalePriceAwg) && payloadSalePriceAwg >= 0;
    const normalizedPayloadSalePrice = hasPayloadSalePrice
      ? Math.round(payloadSalePriceAwg * 100) / 100
      : undefined;
    const existingItem = existingByProductId.get(productId);

    if (!existingItem) {
      if (hasStockCurrent && (!Number.isFinite(stockCurrent) || (stockCurrent ?? 0) < 0)) {
        throw new Error(`El stock actual del producto #${index + 1} debe ser cero o mayor.`);
      }

      return [{
        productId,
        stockCurrent,
        quantity,
        ...(stockRowId ? { stockRowId } : {}),
        notes: notes ?? "",
        ...(normalizedPayloadSalePrice !== undefined ? { salePriceAwg: normalizedPayloadSalePrice } : {}),
      }];
    }

    const existingSalePriceAwg = Number(existingItem.salePriceAwg ?? NaN);
    const resolvedSalePriceAwg = normalizedPayloadSalePrice !== undefined
      ? normalizedPayloadSalePrice
      : (Number.isFinite(existingSalePriceAwg) && existingSalePriceAwg >= 0
        ? Math.round(existingSalePriceAwg * 100) / 100
        : undefined);

    return [{
      productId,
      stockCurrent: existingItem.stockCurrent === undefined || existingItem.stockCurrent === null
        ? null
        : Number(existingItem.stockCurrent),
      quantity,
      ...(stockRowId || existingItem.stockRowId ? { stockRowId: stockRowId || String(existingItem.stockRowId) } : {}),
      notes: notes ?? (typeof existingItem.notes === "string" ? existingItem.notes.trim() : ""),
      ...(resolvedSalePriceAwg !== undefined ? { salePriceAwg: resolvedSalePriceAwg } : {}),
    }];
  });

  if (items.length === 0) {
    throw new Error("El pedido debe conservar al menos un producto con cantidad mayor a cero.");
  }

  return items;
}

async function mapWarehouseOrderRecord(order: {
  _id: unknown;
  routeId?: string;
  routeName?: string;
  routeDay?: string;
  storeId: string;
  storeName: string;
  salesRepId: string;
  salesRepName: string;
  deliveryZone: string;
  deliveryDate?: Date;
  deliveryOverdue?: boolean;
  status: string;
  invoiceNumber?: unknown;
  orderNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{ productId: unknown; stockCurrent?: unknown; quantity?: unknown; notes?: unknown; salePriceAwg?: unknown; stockRowId?: unknown }>;
  giftItems?: Array<{ productId: unknown; quantity?: unknown; notes?: unknown; stockRowId?: unknown }>;
}) {
  const productIds = Array.from(new Set([
    ...order.items.map((item) => String(item.productId)).filter(Boolean),
    ...(Array.isArray(order.giftItems) ? order.giftItems.map((item) => String(item.productId)).filter(Boolean) : []),
  ]));
  const products = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1 }).lean()
    : [];
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  return {
    _id: String(order._id),
    routeId: order.routeId ?? "",
    routeName: order.routeName ?? "",
    routeDay: order.routeDay ?? "",
    storeId: order.storeId,
    storeName: order.storeName,
    salesRepId: order.salesRepId,
    salesRepName: order.salesRepName,
    deliveryZone: order.deliveryZone,
    deliveryDate: serializeOrderDeliveryDate(order.deliveryDate, order.createdAt),
    deliveryOverdue: order.deliveryOverdue === true,
    status: order.status,
    invoiceNumber: Number(order.invoiceNumber ?? 0) || null,
    orderNotes: typeof order.orderNotes === "string" ? order.orderNotes : "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: order.items.map((item) => {
      const relatedProduct = productsById.get(String(item.productId));

      return {
        productId: String(item.productId),
        stockCurrent: item.stockCurrent === undefined || item.stockCurrent === null ? null : Number(item.stockCurrent),
        quantity: Number(item.quantity ?? 0),
        stockRowId: item.stockRowId ? String(item.stockRowId) : "",
        notes: item.notes ?? "",
        ...(Number.isFinite(Number(item.salePriceAwg)) && Number(item.salePriceAwg) >= 0
          ? { salePriceAwg: Math.round(Number(item.salePriceAwg) * 100) / 100 }
          : {}),
        productName: relatedProduct?.name ?? "Producto eliminado",
        productSku: relatedProduct?.sku ?? "-",
      };
    }),
    giftItems: (Array.isArray(order.giftItems) ? order.giftItems : []).map((item) => {
      const relatedProduct = productsById.get(String(item.productId));

      return {
        productId: String(item.productId),
        quantity: Number(item.quantity ?? 0),
        stockRowId: item.stockRowId ? String(item.stockRowId) : "",
        notes: item.notes ?? "",
        productName: relatedProduct?.name ?? "Producto eliminado",
        productSku: relatedProduct?.sku ?? "-",
      };
    }),
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

function buildDefaultLotName(expirationDate: Date | string | null | undefined) {
  const normalizedExpirationDate = normalizeOptionalDateValue(expirationDate);
  return normalizedExpirationDate
    ? `Lote vence ${normalizedExpirationDate.toISOString().slice(0, 10)}`
    : "Lote sin vencimiento";
}

function roundLotPriceValue(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 10000) / 10000;
}

function resolveLotUnitCostUsd(
  stockRow: { unitCostUsd?: unknown },
  product: { arubaPurchaseCostUsd?: unknown },
) {
  const lotUnitCostUsd = Number(stockRow.unitCostUsd ?? 0);
  return lotUnitCostUsd > 0 ? lotUnitCostUsd : Number(product.arubaPurchaseCostUsd ?? 0);
}

function resolveLotUsdToAwgRate(
  stockRow: { usdToAwgRate?: unknown },
  product: { arubaUsdToAwgRate?: unknown },
) {
  const lotRate = Number(stockRow.usdToAwgRate ?? 0);
  return lotRate > 0 ? lotRate : Number(product.arubaUsdToAwgRate ?? 1.79) || 1.79;
}

function resolveLotSalePriceAwg(
  stockRow: { salePriceAwg?: unknown },
  product: { salePrice?: unknown },
) {
  const lotSalePrice = Number(stockRow.salePriceAwg ?? 0);
  return lotSalePrice > 0 ? lotSalePrice : Number(product.salePrice ?? 0);
}

function applyPromotionDiscount(salePrice: number, discountPercent: number) {
  const boundedDiscount = Math.min(Math.max(Number(discountPercent || 0), 0), 100);
  return Math.round((salePrice * (1 - boundedDiscount / 100)) * 100) / 100;
}

async function getActiveLotPromotionMap(stockRowIds?: string[]) {
  const query: Record<string, unknown> = { active: { $ne: false } };

  if (stockRowIds && stockRowIds.length > 0) {
    query.stockRowId = { $in: stockRowIds };
  }

  const promotions = await LotPromotion.find(query).lean();
  return new Map(promotions.map((promotion) => [String(promotion.stockRowId), promotion]));
}

function normalizeOptionalDateValue(value: unknown) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function getSalesRepRouteStoreIds(salesRepId: string) {
  const routes = await SalesRoute.find({ salesRepId, active: { $ne: false } }).lean();
  return new Set(
    routes.flatMap((route) => route.days.flatMap((day) => day.stores.map((store) => store.storeId))),
  );
}

async function assertSalesRepCanManageStore(salesRepId: string, storeId: string) {
  const salesRep = await User.findById(salesRepId).lean();

  if (!salesRep || salesRep.role !== "sales-rep-aruba") {
    throw new Error("El vendedor no existe o no esta habilitado.");
  }

  const allowedStoreIds = await getSalesRepRouteStoreIds(salesRepId);

  if (!allowedStoreIds.has(storeId)) {
    throw new Error("Este cliente no esta asignado en tus rutas activas.");
  }

  return salesRep;
}

async function aggregateWarehouseStockByProduct() {
  const warehouseStocks = await WarehouseStock.find({})
    .select({ productId: 1, availableUnits: 1, expirationDate: 1, lotName: 1, salePriceAwg: 1 })
    .lean();
  const activePromotionByStockRowId = await getActiveLotPromotionMap(warehouseStocks.map((row) => String(row._id)));
  const stockByProduct = new Map<string, {
    total: number;
    nearestExpiration: Date | null;
    preferredLot: {
      stockRowId: string;
      lotName: string;
      availableUnits: number;
      expirationDate: Date | null;
      discountPercent: number;
      salePriceAwg: number;
    } | null;
  }>();
  const now = new Date();

  warehouseStocks.forEach((row) => {
    const productId = String(row.productId ?? "").trim();

    if (!productId) {
      return;
    }

    const availableUnits = Number(row.availableUnits ?? 0);

    if (!Number.isFinite(availableUnits) || availableUnits <= 0) {
      return;
    }

    const current = stockByProduct.get(productId) ?? { total: 0, nearestExpiration: null, preferredLot: null };
    current.total += availableUnits;

    const expirationDate = normalizeOptionalDateValue(row.expirationDate);
    const promotion = activePromotionByStockRowId.get(String(row._id));

    if (expirationDate && expirationDate >= now) {
      if (!current.nearestExpiration || expirationDate < current.nearestExpiration) {
        current.nearestExpiration = expirationDate;
      }
    }

    if (promotion) {
      const promotedLot = {
        stockRowId: String(row._id),
        lotName: String(row.lotName ?? "") || buildDefaultLotName(expirationDate),
        availableUnits,
        expirationDate,
        discountPercent: Number(promotion.discountPercent ?? 0),
        salePriceAwg: Number(row.salePriceAwg ?? 0),
      };

      if (
        !current.preferredLot ||
        compareWarehouseStockLotsByConsumptionPriority(promotedLot, current.preferredLot) < 0
      ) {
        current.preferredLot = promotedLot;
      }
    }

    stockByProduct.set(productId, current);
  });

  return stockByProduct;
}

async function buildSalesProductCatalog(storeId?: string) {
  const [products, stockByProduct, store] = await Promise.all([
    Product.find({ active: { $ne: false }, shareWithAruba: { $ne: false } }).sort({ name: 1 }).lean(),
    aggregateWarehouseStockByProduct(),
    storeId ? Store.findById(storeId).select({ assignedProductIds: 1 }).lean() : Promise.resolve(null),
  ]);

  const assignedProductIds = new Set(
    Array.isArray(store?.assignedProductIds)
      ? store.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
      : [],
  );

  const now = new Date();
  const twoMonthsLater = new Date(now);
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);

  const rows = products.map((product) => {
    const productId = String(product._id);
    const stockInfo = stockByProduct.get(productId) ?? { total: 0, nearestExpiration: null, preferredLot: null };
    let nearestExpiration = stockInfo.nearestExpiration;
    const baseSalePrice = stockInfo.preferredLot && Number(stockInfo.preferredLot.salePriceAwg ?? 0) > 0
      ? Number(stockInfo.preferredLot.salePriceAwg)
      : Number(product.salePrice ?? 0);
    const promotion = stockInfo.preferredLot
      ? {
          stockRowId: stockInfo.preferredLot.stockRowId,
          lotName: stockInfo.preferredLot.lotName,
          expirationDate: stockInfo.preferredLot.expirationDate ? stockInfo.preferredLot.expirationDate.toISOString() : null,
          availableUnits: stockInfo.preferredLot.availableUnits,
          discountPercent: stockInfo.preferredLot.discountPercent,
          originalSalePrice: baseSalePrice,
          promotionSalePrice: applyPromotionDiscount(baseSalePrice, stockInfo.preferredLot.discountPercent),
        }
      : null;

    if (!nearestExpiration && product.expirationDate) {
      const productExpiration = normalizeOptionalDateValue(product.expirationDate);

      if (productExpiration && productExpiration >= now) {
        nearestExpiration = productExpiration;
      }
    }

    const isExpiringSoon = Boolean(
      nearestExpiration &&
      nearestExpiration >= now &&
      nearestExpiration <= twoMonthsLater,
    );

    return {
      productId,
      sku: product.sku,
      name: product.name,
      category: product.category ?? "",
      imageUrl: product.imageUrl ?? "",
      salePrice: promotion ? promotion.promotionSalePrice : baseSalePrice,
      originalSalePrice: promotion ? baseSalePrice : null,
      promotion,
      warehouseStock: stockInfo.total,
      isExpiringSoon,
      nearestExpirationDate: nearestExpiration ? nearestExpiration.toISOString() : null,
      isAssigned: assignedProductIds.has(productId),
      displaysPerBox: Number(product.displaysPerBox ?? 1) || 1,
      unitsPerBox: Number(product.unitsPerBox ?? 0),
      unitsPerBoxUnit: String(product.unitsPerBoxUnit ?? "unidad"),
      productWeightKg: Number(product.productWeightKg ?? 0),
    };
  });

  const expiringSoon = rows
    .filter((row) => row.isExpiringSoon && row.warehouseStock > 0)
    .sort((left, right) => String(left.nearestExpirationDate).localeCompare(String(right.nearestExpirationDate)));
  const expiringProductIds = new Set(expiringSoon.map((row) => row.productId));
  const catalogProducts = rows
    .filter((row) => !expiringProductIds.has(row.productId))
    .sort((left, right) => left.name.localeCompare(right.name));

  return { expiringSoon, products: catalogProducts };
}

async function sanitizeSalesRoutesWithStores(routes: unknown[]) {
  const typedRoutes = routes as Array<{
    days: Array<{ day: string; stores: Array<{ storeId: string; storeName: string; address?: string | null }> }>;
    plannedStops?: number;
    assignedDays?: number;
    [key: string]: unknown;
  }>;
  const storeIds = [...new Set(
    typedRoutes.flatMap((route) => route.days.flatMap((day) => day.stores.map((store) => store.storeId))),
  )].filter(Boolean);

  if (storeIds.length === 0) {
    return typedRoutes.map((route) => ({
      ...route,
      days: [],
      plannedStops: 0,
      assignedDays: 0,
    }));
  }

  const stores = await Store.find({ _id: { $in: storeIds } }).select({ name: 1, address: 1 }).lean();
  const storeById = new Map(stores.map((store) => [String(store._id), store]));

  return typedRoutes.map((route) => {
    const days = route.days
      .map((day) => ({
        ...day,
        stores: day.stores
          .filter((store) => storeById.has(store.storeId))
          .map((store) => {
            const currentStore = storeById.get(store.storeId)!;

            return {
              storeId: store.storeId,
              storeName: String(currentStore.name ?? store.storeName),
              address: String(currentStore.address ?? store.address ?? ""),
            };
          }),
      }))
      .filter((day) => day.stores.length > 0);

    return {
      ...route,
      days,
      plannedStops: days.reduce((sum, day) => sum + day.stores.length, 0),
      assignedDays: days.length,
    };
  });
}

async function removeStoreFromAllRoutes(storeId: string) {
  const routes = await SalesRoute.find({ "days.stores.storeId": storeId });

  await Promise.all(
    routes.map(async (route) => {
      const sanitizedDays = route.days
        .map((day) => ({
          day: day.day,
          stores: day.stores
            .filter((store) => store.storeId !== storeId)
            .map((store) => ({
              storeId: store.storeId,
              storeName: store.storeName,
              address: store.address ?? "",
            })),
        }))
        .filter((day) => day.stores.length > 0);

      const plannedStops = sanitizedDays.reduce((sum, day) => sum + day.stores.length, 0);
      const assignedDays = sanitizedDays.length;

      await SalesRoute.updateOne(
        { _id: route._id },
        { $set: { days: sanitizedDays, plannedStops, assignedDays } },
      );
    }),
  );
}

function compareWarehouseStockLotsByConsumptionPriority(
  left: { expirationDate?: Date | string | null; createdAt?: Date | string | null },
  right: { expirationDate?: Date | string | null; createdAt?: Date | string | null },
) {
  const leftExpiration = normalizeOptionalDateValue(left.expirationDate);
  const rightExpiration = normalizeOptionalDateValue(right.expirationDate);

  if (leftExpiration && rightExpiration) {
    const diff = leftExpiration.getTime() - rightExpiration.getTime();

    if (diff !== 0) {
      return diff;
    }
  } else if (leftExpiration) {
    return -1;
  } else if (rightExpiration) {
    return 1;
  }

  return String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? ""));
}

function buildInventoryLotKey(
  productId: string,
  expirationDateValue: string,
  unitCostUsd = 0,
  salePriceAwg = 0,
) {
  return `${productId.trim()}::${expirationDateValue.trim() || "no-expiration"}::${roundLotPriceValue(unitCostUsd)}::${roundLotPriceValue(salePriceAwg)}`;
}

async function applyInventoryRowStockUpdate(params: {
  stockRowId: string;
  productId: string;
  nextProductId: string;
  quantity: number;
  expirationDate: Date | null;
  lotName: string;
}) {
  const stockRow = await WarehouseStock.findOne({ _id: params.stockRowId, productId: params.productId });

  if (!stockRow) {
    throw new Error("El lote de inventario no existe.");
  }

  const warehouseCode = stockRow.warehouseCode;
  const minUnits = Number(stockRow.minUnits ?? 0);
  const currentExpiration = normalizeOptionalDateValue(stockRow.expirationDate);
  const sameLot = params.nextProductId === params.productId
    && String(currentExpiration ?? "") === String(params.expirationDate ?? "");

  if (sameLot) {
    await WarehouseStock.findByIdAndUpdate(
      stockRow._id,
      {
        availableUnits: params.quantity,
        lotName: params.lotName || buildDefaultLotName(params.expirationDate),
        status: resolveWarehouseStockStatus(params.quantity, minUnits),
      },
      { runValidators: true },
    );
    return;
  }

  const existingTarget = await WarehouseStock.findOne({
    productId: params.nextProductId,
    warehouseCode,
    expirationDate: params.expirationDate,
  });

  if (existingTarget && String(existingTarget._id) !== String(stockRow._id)) {
    const nextAvailable = Number(existingTarget.availableUnits ?? 0) + params.quantity;

    await WarehouseStock.findByIdAndUpdate(
      existingTarget._id,
      {
        availableUnits: nextAvailable,
        lotName: params.lotName || String(existingTarget.lotName ?? "") || buildDefaultLotName(params.expirationDate),
        status: resolveWarehouseStockStatus(nextAvailable, Number(existingTarget.minUnits ?? minUnits)),
      },
      { runValidators: true },
    );
    await WarehouseStock.findByIdAndDelete(stockRow._id);
    return;
  }

  await WarehouseStock.findByIdAndUpdate(
    stockRow._id,
    {
      productId: params.nextProductId,
      expirationDate: params.expirationDate,
      lotName: params.lotName || buildDefaultLotName(params.expirationDate),
      availableUnits: params.quantity,
      status: resolveWarehouseStockStatus(params.quantity, minUnits),
    },
    { runValidators: true },
  );
}

async function applyOrderInventoryDeduction(order: {
  _id: unknown;
  items: Array<{ productId?: unknown; quantity?: unknown; stockRowId?: unknown }>;
  giftItems?: Array<{ productId?: unknown; quantity?: unknown; stockRowId?: unknown }>;
}) {
  const quantitiesByProductId = [
    ...(Array.isArray(order.items) ? order.items : []),
    ...(Array.isArray(order.giftItems) ? order.giftItems : []),
  ].reduce<Map<string, { quantity: number; stockRowId: string }>>((map, item) => {
    const productId = String(item.productId ?? "").trim();
    const quantity = Number(item.quantity ?? 0);
    const stockRowId = String(item.stockRowId ?? "").trim();

    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return map;
    }

    const current = map.get(productId) ?? { quantity: 0, stockRowId: "" };
    map.set(productId, {
      quantity: current.quantity + quantity,
      stockRowId: current.stockRowId || stockRowId,
    });
    return map;
  }, new Map());

  for (const [productId, deduction] of quantitiesByProductId.entries()) {
    const quantityToDeduct = deduction.quantity;
    const existingAutomaticDeduction = await InventoryAdjustment.findOne({
      productId,
      reason: "Despacho de pedido completado",
      notes: `Salida automatica por pedido ${String(order._id)}`,
    }).lean();

    if (existingAutomaticDeduction) {
      continue;
    }

    const stockRows = (await WarehouseStock.find({ productId }).lean()).sort((left, right) => {
      if (deduction.stockRowId) {
        if (String(left._id) === deduction.stockRowId) return -1;
        if (String(right._id) === deduction.stockRowId) return 1;
      }

      return compareWarehouseStockLotsByConsumptionPriority(left, right);
    });

    if (stockRows.length > 0) {
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
        await WarehouseStock.findByIdAndUpdate(
          stockRow._id,
          { availableUnits: nextAvailable },
          { runValidators: true },
        );
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

function buildOrderQuantitiesMap(items: Array<{ productId?: unknown; quantity?: unknown }>) {
  return items.reduce<Map<string, number>>((map, item) => {
    const productId = String(item.productId ?? "").trim();
    const quantity = Number(item.quantity ?? 0);

    if (!productId || !Number.isFinite(quantity) || quantity < 0) {
      return map;
    }

    map.set(productId, (map.get(productId) ?? 0) + quantity);
    return map;
  }, new Map());
}

async function restoreInventoryForProduct(productId: string, quantityToRestore: number, orderId: string) {
  if (quantityToRestore <= 0) {
    return;
  }

  const stockRows = (await WarehouseStock.find({ productId }).lean())
    .sort(compareWarehouseStockLotsByConsumptionPriority);

  if (stockRows.length > 0) {
    const targetRow = stockRows[0];
    const nextAvailable = Number(targetRow.availableUnits ?? 0) + quantityToRestore;

    await WarehouseStock.findByIdAndUpdate(
      targetRow._id,
      {
        availableUnits: nextAvailable,
        status: resolveWarehouseStockStatus(nextAvailable, Number(targetRow.minUnits ?? 0)),
      },
      { runValidators: true },
    );
  }

  const originalAdjustment = await InventoryAdjustment.findOne({
    productId,
    reason: "Despacho de pedido completado",
    notes: `Salida automatica por pedido ${orderId}`,
  }).lean();

  if (originalAdjustment) {
    const nextQuantity = Math.max(Number(originalAdjustment.quantity ?? 0) - quantityToRestore, 0);

    if (nextQuantity <= 0) {
      await InventoryAdjustment.deleteOne({ _id: originalAdjustment._id });
    } else {
      await InventoryAdjustment.findByIdAndUpdate(originalAdjustment._id, { quantity: nextQuantity });
    }
  }
}

async function deductAdditionalInventoryForProduct(productId: string, quantityToDeduct: number, orderId: string) {
  if (quantityToDeduct <= 0) {
    return;
  }

  const stockRows = (await WarehouseStock.find({ productId }).lean())
    .sort(compareWarehouseStockLotsByConsumptionPriority);
  let remaining = quantityToDeduct;

  if (stockRows.length > 0) {
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
      await WarehouseStock.findByIdAndUpdate(
        stockRow._id,
        {
          availableUnits: nextAvailable,
          status: resolveWarehouseStockStatus(nextAvailable, Number(stockRow.minUnits ?? 0)),
        },
        { runValidators: true },
      );
    }
  }

  const originalAdjustment = await InventoryAdjustment.findOne({
    productId,
    reason: "Despacho de pedido completado",
    notes: `Salida automatica por pedido ${orderId}`,
  }).lean();

  if (originalAdjustment) {
    await InventoryAdjustment.findByIdAndUpdate(originalAdjustment._id, {
      quantity: Number(originalAdjustment.quantity ?? 0) + quantityToDeduct,
    });
    return;
  }

  await InventoryAdjustment.create({
    productId,
    quantity: quantityToDeduct,
    reason: "Despacho de pedido completado",
    notes: `Salida automatica por pedido ${orderId}`,
    source: stockRows.length > 0 ? "warehouse-stock" : "import-fallback",
  });
}

async function applyOrderInventoryDelta(
  orderId: string,
  oldItems: Array<{ productId?: unknown; quantity?: unknown }>,
  newItems: Array<{ productId?: unknown; quantity?: unknown }>,
) {
  const oldMap = buildOrderQuantitiesMap(oldItems);
  const newMap = buildOrderQuantitiesMap(newItems);
  const productIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  for (const productId of productIds) {
    const delta = (newMap.get(productId) ?? 0) - (oldMap.get(productId) ?? 0);

    if (delta > 0) {
      await deductAdditionalInventoryForProduct(productId, delta, orderId);
    } else if (delta < 0) {
      await restoreInventoryForProduct(productId, Math.abs(delta), orderId);
    }
  }
}

function normalizeInvoiceChangeRequestItems(rawItems: unknown, existingItems: Array<{ productId: unknown; stockCurrent?: unknown; notes?: unknown }>) {
  return normalizeWarehouseOrderItems(rawItems, existingItems);
}

async function enrichInvoiceChangeItems(items: Array<{ productId: string; quantity: number; notes?: string }>) {
  const productIds = items.map((item) => item.productId);
  const products = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1 }).lean()
    : [];
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  return items.map((item) => {
    const product = productsById.get(item.productId);

    return {
      productId: item.productId,
      productName: String(product?.name ?? "Producto"),
      productSku: String(product?.sku ?? "-"),
      quantity: item.quantity,
      notes: item.notes ?? "",
    };
  });
}

function mapInvoiceChangeRequestRecord(entry: {
  _id?: unknown;
  orderId?: unknown;
  storeId?: unknown;
  storeName?: unknown;
  salesRepName?: unknown;
  routeName?: unknown;
  invoiceNumber?: unknown;
  status?: unknown;
  requestedByUserId?: unknown;
  requestedByUserName?: unknown;
  requestedByRole?: unknown;
  requestNotes?: unknown;
  reviewedByUserId?: unknown;
  reviewedByUserName?: unknown;
  reviewNotes?: unknown;
  reviewedAt?: unknown;
  currentItems?: unknown;
  proposedItems?: unknown;
  currentInvoiceAmountAwg?: unknown;
  proposedInvoiceAmountAwg?: unknown;
  currentPaymentMethod?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    _id: String(entry._id),
    orderId: String(entry.orderId ?? ""),
    storeId: String(entry.storeId ?? ""),
    storeName: String(entry.storeName ?? ""),
    salesRepName: String(entry.salesRepName ?? ""),
    routeName: String(entry.routeName ?? ""),
    invoiceNumber: Number(entry.invoiceNumber ?? 0) || null,
    status: String(entry.status ?? "pending"),
    requestedByUserId: String(entry.requestedByUserId ?? ""),
    requestedByUserName: String(entry.requestedByUserName ?? ""),
    requestedByRole: String(entry.requestedByRole ?? ""),
    requestNotes: String(entry.requestNotes ?? ""),
    reviewedByUserId: String(entry.reviewedByUserId ?? ""),
    reviewedByUserName: String(entry.reviewedByUserName ?? ""),
    reviewNotes: String(entry.reviewNotes ?? ""),
    reviewedAt: entry.reviewedAt ? String(entry.reviewedAt) : null,
    currentItems: Array.isArray(entry.currentItems) ? entry.currentItems : [],
    proposedItems: Array.isArray(entry.proposedItems) ? entry.proposedItems : [],
    currentInvoiceAmountAwg: Number(entry.currentInvoiceAmountAwg ?? 0),
    proposedInvoiceAmountAwg: Number(entry.proposedInvoiceAmountAwg ?? 0),
    currentPaymentMethod: String(entry.currentPaymentMethod ?? ""),
    createdAt: entry.createdAt ? String(entry.createdAt) : "",
    updatedAt: entry.updatedAt ? String(entry.updatedAt) : "",
  };
}

async function calculateInvoiceAmountFromItems(items: Array<{ productId: string; quantity: number; salePriceAwg?: unknown }>) {
  const lines = await buildWarehouseInvoiceDocumentLines({ items });
  return Math.round(lines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0) * 100) / 100;
}

async function updateCarteraAfterInvoiceChange(params: {
  carteraEntryId: string;
  orderId: string;
  newInvoiceAmountAwg: number;
  paymentMethod: "credito" | "datafono" | "transferencia" | "efectivo";
}) {
  const entry = await CarteraEntry.findById(params.carteraEntryId).lean();

  if (!entry) {
    throw new Error("No se encontro la factura en cartera.");
  }

  const collectedAmountAwg = Number(entry.collectedAmountAwg ?? 0);
  const isCreditInvoice = params.paymentMethod === "credito";

  if (isCreditInvoice && params.newInvoiceAmountAwg < collectedAmountAwg - 0.009) {
    throw new Error("El nuevo monto de factura no puede ser menor al recaudo ya registrado.");
  }

  if (isCreditInvoice) {
    await CarteraEntry.findByIdAndUpdate(params.carteraEntryId, {
      invoiceAmountAwg: params.newInvoiceAmountAwg,
      outstandingAmountAwg: Math.round(Math.max(params.newInvoiceAmountAwg - collectedAmountAwg, 0) * 100) / 100,
    });
    return;
  }

  await CarteraEntry.findByIdAndUpdate(params.carteraEntryId, {
    invoiceAmountAwg: params.newInvoiceAmountAwg,
    collectedAmountAwg: params.newInvoiceAmountAwg,
    outstandingAmountAwg: 0,
  });

  await CarteraCollection.updateMany(
    {
      carteraEntryId: params.carteraEntryId,
      relatedOrderId: params.orderId,
      active: { $ne: false },
    },
    { amountAwg: params.newInvoiceAmountAwg },
  );
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

apiRouter.get("/push/config", (_request, response) => {
  if (!isFirebasePushConfigured()) {
    response.status(503).json({ message: "Push notifications are not configured." });
    return;
  }

  const projectId = env.FIREBASE_PROJECT_ID?.trim() ?? "";
  const messagingSenderId = env.FIREBASE_MESSAGING_SENDER_ID?.trim() ?? "";
  const apiKey = env.FIREBASE_WEB_API_KEY?.trim() ?? "";
  const appId = env.FIREBASE_WEB_APP_ID?.trim() ?? "";
  const vapidKey = env.FIREBASE_WEB_VAPID_KEY?.trim() ?? "";

  if (!projectId || !messagingSenderId || !apiKey || !appId || !vapidKey) {
    response.status(503).json({ message: "Firebase web config is incomplete." });
    return;
  }

  response.json({
    apiKey,
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
    messagingSenderId,
    appId,
    vapidKey,
  });
});

apiRouter.post("/push/register", async (request, response) => {
  try {
    const { userId, token } = request.body as { userId?: string; token?: string };

    if (!userId || !token) {
      response.status(400).json({ message: "userId and token are required." });
      return;
    }

    const result = await registerPushToken(userId, token);
    response.status(201).json({
      message: "Push token registered.",
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/push/unregister", async (request, response) => {
  try {
    const { userId, token } = request.body as { userId?: string; token?: string };

    if (!userId || !token) {
      response.status(400).json({ message: "userId and token are required." });
      return;
    }

    await unregisterPushToken(userId, token);
    response.json({ message: "Push token unregistered." });
  } catch (error) {
    sendCreationError(response, error);
  }
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
  response.json(await sanitizeSalesRoutesWithStores(routes));
});

apiRouter.get("/sales/product-catalog", async (request, response) => {
  try {
    const salesRepId = typeof request.query.salesRepId === "string" ? request.query.salesRepId.trim() : "";
    const storeId = typeof request.query.storeId === "string" ? request.query.storeId.trim() : "";

    if (!salesRepId) {
      response.status(400).json({ message: "Indica el vendedor para consultar el catalogo." });
      return;
    }

    const salesRep = await User.findById(salesRepId).lean();

    if (!salesRep || salesRep.role !== "sales-rep-aruba") {
      response.status(404).json({ message: "El vendedor no existe o no esta habilitado." });
      return;
    }

    if (storeId) {
      await assertSalesRepCanManageStore(salesRepId, storeId);

      const store = await Store.findById(storeId).lean();

      if (!store) {
        response.status(404).json({ message: "El cliente no existe." });
        return;
      }
    }

    const catalog = await buildSalesProductCatalog(storeId || undefined);
    response.json(catalog);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/sales/stores/:id/assigned-products/add", async (request, response) => {
  try {
    const salesRepId = typeof request.body?.salesRepId === "string" ? request.body.salesRepId.trim() : "";
    const productId = typeof request.body?.productId === "string" ? request.body.productId.trim() : "";
    const storeId = request.params.id;

    if (!salesRepId || !productId) {
      response.status(400).json({ message: "Indica el vendedor y el producto a asignar." });
      return;
    }

    await assertSalesRepCanManageStore(salesRepId, storeId);

    const [store, product] = await Promise.all([
      Store.findById(storeId),
      Product.findOne({ _id: productId, active: { $ne: false }, shareWithAruba: { $ne: false } }).lean(),
    ]);

    if (!store) {
      response.status(404).json({ message: "El cliente no existe." });
      return;
    }

    if (!product) {
      response.status(404).json({ message: "El producto no existe o no esta disponible para Aruba." });
      return;
    }

    const currentAssignedProductIds = Array.isArray(store.assignedProductIds)
      ? store.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
      : [];

    if (currentAssignedProductIds.includes(productId)) {
      response.json({
        message: `${product.name} ya estaba asignado a ${store.name}.`,
        store: {
          _id: String(store._id),
          name: store.name,
          assignedProductIds: currentAssignedProductIds,
        },
      });
      return;
    }

    store.assignedProductIds = [...currentAssignedProductIds, productId] as typeof store.assignedProductIds;
    await store.save();

    response.status(201).json({
      message: `${product.name} agregado a ${store.name}.`,
      store: {
        _id: String(store._id),
        name: store.name,
        assignedProductIds: store.assignedProductIds.map((entry) => String(entry)),
      },
    });
  } catch (error) {
    sendCreationError(response, error);
  }
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

    const products = await Product.find({ _id: { $in: assignedProductIds }, active: { $ne: false }, shareWithAruba: { $ne: false } })
      .sort({ name: 1 })
      .lean();
    const stockByProduct = await aggregateWarehouseStockByProduct();

    response.json({
      store: {
        id: String(store._id),
        name: store.name,
        address: store.address ?? "",
        managerName: store.managerName ?? "",
      },
      products: products.map((product) => {
        const productId = String(product._id);
        const stockInfo = stockByProduct.get(productId);
        const baseSalePrice = Number(product.salePrice ?? 0);
        const promotion = stockInfo?.preferredLot
          ? {
              stockRowId: stockInfo.preferredLot.stockRowId,
              lotName: stockInfo.preferredLot.lotName,
              expirationDate: stockInfo.preferredLot.expirationDate ? stockInfo.preferredLot.expirationDate.toISOString() : null,
              availableUnits: stockInfo.preferredLot.availableUnits,
              discountPercent: stockInfo.preferredLot.discountPercent,
              originalSalePrice: baseSalePrice,
              promotionSalePrice: applyPromotionDiscount(baseSalePrice, stockInfo.preferredLot.discountPercent),
            }
          : null;

        return {
          productId,
          sku: product.sku,
          name: product.name,
          category: product.category,
          imageUrl: product.imageUrl ?? "",
          salePrice: promotion ? promotion.promotionSalePrice : baseSalePrice,
          originalSalePrice: promotion ? baseSalePrice : null,
          promotion,
          warehouseStock: Number(stockInfo?.total ?? 0),
          displaysPerBox: Number(product.displaysPerBox ?? 1) || 1,
          unitsPerBox: Number(product.unitsPerBox ?? 0),
          unitsPerBoxUnit: String(product.unitsPerBoxUnit ?? "unidad"),
          productWeightKg: Number(product.productWeightKg ?? 0),
        };
      }),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/sales/stores/:id/assigned-products", async (request, response) => {
  try {
    const salesRepId = typeof request.body?.salesRepId === "string" ? request.body.salesRepId.trim() : "";
    const assignedProductIds = await normalizeAssignedProductIds(request.body?.assignedProductIds);

    if (!salesRepId) {
      response.status(400).json({ message: "Indica el vendedor que actualiza el cliente." });
      return;
    }

    const [salesRep, store] = await Promise.all([
      User.findById(salesRepId).lean(),
      Store.findById(request.params.id).lean(),
    ]);

    if (!salesRep || salesRep.role !== "sales-rep-aruba") {
      response.status(404).json({ message: "El vendedor no existe o no esta habilitado." });
      return;
    }

    if (!store) {
      response.status(404).json({ message: "El cliente no existe." });
      return;
    }

    await assertSalesRepCanManageStore(salesRepId, String(store._id));

    await Store.findByIdAndUpdate(store._id, {
      assignedProductIds,
    }, {
      runValidators: true,
    });

    response.json({
      message: `Productos actualizados para ${store.name}.`,
      store: {
        _id: String(store._id),
        name: store.name,
        address: store.address ?? "",
        code: store.code ?? "",
        email: store.email ?? "",
        phone: store.phone ?? "",
        managerName: store.managerName ?? "",
        assignedProductIds,
      },
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
    await ensureOrderDeliveryDates();
    await syncOverdueDeliveryDates();
    const orders = await Order.find({ salesRepId })
      .sort({ deliveryDate: 1, createdAt: 1 })
      .lean();

    const productIds = Array.from(new Set(orders.flatMap((order) => [
      ...order.items.map((item) => String(item.productId)).filter(Boolean),
      ...(Array.isArray(order.giftItems) ? order.giftItems.map((item) => String(item.productId)).filter(Boolean) : []),
    ])));
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
        deliveryDate: serializeOrderDeliveryDate(order.deliveryDate, order.createdAt),
        deliveryOverdue: order.deliveryOverdue === true,
        status: order.status,
        orderNotes: typeof order.orderNotes === "string" ? order.orderNotes : "",
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        items: order.items.map((item) => {
          const relatedProduct = productsById.get(String(item.productId));

          return {
            productId: String(item.productId),
            stockCurrent: item.stockCurrent === undefined || item.stockCurrent === null ? null : Number(item.stockCurrent),
            quantity: Number(item.quantity ?? 0),
            stockRowId: item.stockRowId ? String(item.stockRowId) : "",
            ...(Number.isFinite(Number(item.salePriceAwg)) && Number(item.salePriceAwg) >= 0
              ? { salePriceAwg: Math.round(Number(item.salePriceAwg) * 100) / 100 }
              : {}),
            notes: item.notes ?? "",
            productName: relatedProduct?.name ?? "Producto eliminado",
            productSku: relatedProduct?.sku ?? "-",
          };
        }),
        giftItems: (Array.isArray(order.giftItems) ? order.giftItems : []).map((item) => {
          const relatedProduct = productsById.get(String(item.productId));

          return {
            productId: String(item.productId),
            quantity: Number(item.quantity ?? 0),
            stockRowId: item.stockRowId ? String(item.stockRowId) : "",
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

    if (payload.giftItems.length > 0) {
      const giftProductIds = Array.from(new Set(payload.giftItems.map((item) => item.productId)));
      const giftProducts = await Product.find({ _id: { $in: giftProductIds }, active: { $ne: false } }).select({ _id: 1 }).lean();
      const availableGiftProductIds = new Set(giftProducts.map((product) => String(product._id)));
      const invalidGiftItem = payload.giftItems.find((item) => !availableGiftProductIds.has(item.productId));

      if (invalidGiftItem) {
        throw new Error("Uno o varios productos del obsequio ya no estan disponibles.");
      }
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
      deliveryDate: payload.deliveryDate,
      status: "submitted",
      orderNotes: payload.orderNotes,
      items: payload.items,
      giftItems: payload.giftItems,
    });

    response.status(201).json({
      message: `Pedido enviado a bodega para ${store.name}.`,
      order,
    });

    void notifyNewSalesOrder(order);
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

    await Order.findByIdAndUpdate(order._id, {
      items: payload.items,
      giftItems: payload.giftItems,
      deliveryDate: payload.deliveryDate,
      orderNotes: payload.orderNotes,
    }, { runValidators: true });

    response.json({
      message: "Pedido actualizado correctamente.",
      order: {
        ...order.toObject(),
        items: payload.items,
        giftItems: payload.giftItems,
        deliveryDate: payload.deliveryDate,
      },
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/sales/orders/:id", async (request, response) => {
  try {
    const salesRepId = typeof request.query.salesRepId === "string" ? request.query.salesRepId.trim() : "";
    const order = await Order.findById(request.params.id);

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    if (!salesRepId || order.salesRepId !== salesRepId) {
      response.status(400).json({ message: "El pedido no pertenece al vendedor seleccionado." });
      return;
    }

    if (!canEditSellerOrder(order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt))) {
      response.status(400).json({ message: "El tiempo para borrar el pedido ha caducado." });
      return;
    }

    if (order.status === "delivered") {
      response.status(400).json({ message: "No puedes borrar un pedido ya completado." });
      return;
    }

    await deactivateCarteraForOrder(String(order._id));
    await Order.findByIdAndDelete(order._id);

    response.json({ message: "Pedido borrado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/warehouse/orders", async (_request, response) => {
  try {
    await ensureOrderDeliveryDates();
    await syncOverdueDeliveryDates();
    const orders = await Order.find()
      .sort({ deliveryDate: 1, createdAt: 1 })
      .lean();

    response.json(
      await Promise.all(orders.map((order) => mapWarehouseOrderRecord(order))),
    );
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/warehouse/orders/next-invoice-number", async (request, response) => {
  try {
    const orderId = typeof request.query.orderId === "string" ? request.query.orderId.trim() : "";

    if (orderId) {
      const order = await Order.findById(orderId).lean();
      const existingNumber = Number(order?.invoiceNumber ?? 0);

      if (order && existingNumber >= MIN_INVOICE_NUMBER) {
        response.json({ invoiceNumber: existingNumber });
        return;
      }
    }

    response.json({ invoiceNumber: await getNextInvoiceNumber() });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/warehouse/orders/:id", async (request, response) => {
  try {
    const order = await Order.findById(request.params.id);

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    if (order.status === "delivered") {
      response.status(400).json({ message: "No puedes modificar un pedido ya completado." });
      return;
    }

    const payload = request.body as { items?: unknown; giftItems?: unknown };
    const items = normalizeWarehouseOrderItems(payload.items, order.items);
    const giftItems = normalizeOrderGiftItems(payload.giftItems ?? order.giftItems ?? []);
    const productIds = Array.from(new Set([
      ...items.map((item) => item.productId),
      ...giftItems.map((item) => item.productId),
    ]));
    const products = await Product.find({ _id: { $in: productIds }, active: { $ne: false } }).select({ _id: 1 }).lean();
    const availableProductIds = new Set(products.map((product) => String(product._id)));

    if (productIds.some((productId) => !availableProductIds.has(productId))) {
      response.status(400).json({ message: "Uno o varios productos del pedido ya no estan disponibles." });
      return;
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      order._id,
      { items, giftItems },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedOrder) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    response.json({
      message: "Pedido actualizado correctamente desde bodega.",
      order: await mapWarehouseOrderRecord(updatedOrder),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

const carteraPaymentMethods = new Set(["credito", "transferencia", "efectivo"]);
const carteraCollectionPaymentMethods = new Set(["transferencia", "efectivo"]);

function normalizeCarteraPaymentMethod(value: unknown) {
  const paymentMethod = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!carteraPaymentMethods.has(paymentMethod)) {
    throw new Error("Selecciona un metodo de pago valido: credito, transferencia o efectivo.");
  }

  return paymentMethod as "credito" | "datafono" | "transferencia" | "efectivo";
}

function normalizeCarteraCollectionPaymentMethod(value: unknown) {
  const paymentMethod = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (!carteraCollectionPaymentMethods.has(paymentMethod)) {
    throw new Error("Selecciona un metodo de recaudo valido: transferencia o efectivo.");
  }

  return paymentMethod as "datafono" | "transferencia" | "efectivo";
}

function normalizeCarteraInvoiceAmount(value: unknown) {
  const invoiceAmountAwg = Number(value ?? 0);

  if (!Number.isFinite(invoiceAmountAwg) || invoiceAmountAwg < 0) {
    throw new Error("El monto de la factura no es valido.");
  }

  return Math.round(invoiceAmountAwg * 100) / 100;
}

function normalizeCreditCollectionsPayload(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as Array<{ carteraEntryId: string; amountAwg: number; paymentMethod: "datafono" | "transferencia" | "efectivo" }>;
  }

  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`El recaudo de credito #${index + 1} no es valido.`);
    }

    const payload = entry as Record<string, unknown>;
    const carteraEntryId = typeof payload.carteraEntryId === "string" ? payload.carteraEntryId.trim() : "";
    const amountAwg = normalizeCarteraInvoiceAmount(payload.amountAwg);
    const paymentMethod = normalizeCarteraCollectionPaymentMethod(payload.paymentMethod);

    if (!carteraEntryId || amountAwg <= 0) {
      throw new Error(`El recaudo de credito #${index + 1} debe incluir factura y monto valido.`);
    }

    return { carteraEntryId, amountAwg, paymentMethod };
  });
}

function buildBusinessMonthMongoFilter(dateField: "invoicedAt" | "collectedAt", monthFilter: string) {
  if (!/^\d{4}-\d{2}$/.test(monthFilter)) {
    return null;
  }

  return {
    $expr: {
      $eq: [
        { $dateToString: { format: "%Y-%m", date: `$${dateField}`, timezone: BUSINESS_TIMEZONE } },
        monthFilter,
      ],
    },
  };
}

function buildBusinessDateRangeMongoFilter(
  dateField: "invoicedAt" | "collectedAt",
  startDate: string,
  endDate: string,
) {
  const hasStartDate = /^\d{4}-\d{2}-\d{2}$/.test(startDate);
  const hasEndDate = /^\d{4}-\d{2}-\d{2}$/.test(endDate);

  if (!hasStartDate && !hasEndDate) {
    return null;
  }

  const andConditions: Array<Record<string, unknown>> = [];

  if (hasStartDate) {
    andConditions.push({
      $gte: [
        { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}`, timezone: BUSINESS_TIMEZONE } },
        startDate,
      ],
    });
  }

  if (hasEndDate) {
    andConditions.push({
      $lte: [
        { $dateToString: { format: "%Y-%m-%d", date: `$${dateField}`, timezone: BUSINESS_TIMEZONE } },
        endDate,
      ],
    });
  }

  return {
    $expr: andConditions.length === 1 ? andConditions[0] : { $and: andConditions },
  };
}

function resolveCarteraDateRangeFilters(query: {
  month?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  collectionStartDate?: unknown;
  collectionEndDate?: unknown;
}) {
  let startDate = typeof query.startDate === "string" ? query.startDate.trim() : "";
  let endDate = typeof query.endDate === "string" ? query.endDate.trim() : "";
  let collectionStartDate = typeof query.collectionStartDate === "string" ? query.collectionStartDate.trim() : "";
  let collectionEndDate = typeof query.collectionEndDate === "string" ? query.collectionEndDate.trim() : "";
  const monthFilter = typeof query.month === "string" ? query.month.trim() : "";

  if (!startDate && !endDate && /^\d{4}-\d{2}$/.test(monthFilter)) {
    const [year, month] = monthFilter.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    startDate = `${monthFilter}-01`;
    endDate = `${monthFilter}-${String(lastDay).padStart(2, "0")}`;
  }

  if (!collectionStartDate && !collectionEndDate) {
    collectionStartDate = startDate;
    collectionEndDate = endDate;
  }

  return { startDate, endDate, collectionStartDate, collectionEndDate };
}

async function syncDeliveredOrdersIntoCartera() {
  const [deliveredOrders, existingEntries] = await Promise.all([
    Order.find({ status: "delivered" })
      .select({
        _id: 1,
        storeId: 1,
        storeName: 1,
        salesRepId: 1,
        salesRepName: 1,
        routeId: 1,
        routeName: 1,
        routeDay: 1,
        deliveryZone: 1,
        items: 1,
        updatedAt: 1,
      })
      .lean(),
    CarteraEntry.find({}).select({ orderId: 1 }).lean(),
  ]);

  const existingOrderIds = new Set(existingEntries.map((entry) => String(entry.orderId ?? "")));
  const missingOrders = deliveredOrders.filter((order) => !existingOrderIds.has(String(order._id)));

  for (const order of missingOrders) {
    const items = Array.isArray(order.items) ? order.items : [];
    const invoiceAmountAwg = await calculateInvoiceAmountFromItems(
      items.map((item) => ({
        productId: String(item.productId ?? ""),
        quantity: Number(item.quantity ?? 0),
        salePriceAwg: item.salePriceAwg,
      })),
    );
    const invoicedAt = resolveOrderInvoiceDate(order);
    const invoiceNumber = await getNextInvoiceNumber();

    await CarteraEntry.create({
      orderId: String(order._id),
      storeId: String(order.storeId ?? ""),
      storeName: String(order.storeName ?? ""),
      salesRepId: String(order.salesRepId ?? ""),
      salesRepName: String(order.salesRepName ?? ""),
      routeId: String(order.routeId ?? ""),
      routeName: String(order.routeName ?? ""),
      routeDay: String(order.routeDay ?? ""),
      deliveryZone: String(order.deliveryZone ?? ""),
      paymentMethod: "credito",
      invoiceAmountAwg,
      invoiceNumber,
      collectedAmountAwg: 0,
      outstandingAmountAwg: invoiceAmountAwg,
      invoicedAt,
      active: true,
    });
  }
}

function getCarteraPeriodBounds(referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(dayStart);
  const dayOfWeek = weekStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return { dayStart, weekStart, monthStart, now };
}

function sumAmountInPeriod<T>(
  rows: T[],
  getDate: (row: T) => Date | string | undefined,
  getAmount: (row: T) => number,
  periodStart: Date,
  periodEnd: Date,
) {
  return rows.reduce((sum, row) => {
    const rawDate = getDate(row);
    const date = rawDate ? new Date(rawDate) : null;

    if (!date || Number.isNaN(date.getTime()) || date < periodStart || date > periodEnd) {
      return sum;
    }

    return sum + getAmount(row);
  }, 0);
}

async function buildCarteraSummary(referenceDate = new Date()) {
  const { dayStart, weekStart, monthStart, now } = getCarteraPeriodBounds(referenceDate);
  const [entries, collections] = await Promise.all([
    CarteraEntry.find({ active: { $ne: false } }).lean(),
    CarteraCollection.find({ active: { $ne: false } }).lean(),
  ]);

  const facturacion = {
    day: sumAmountInPeriod(entries, (entry) => entry.invoicedAt, (entry) => Number(entry.invoiceAmountAwg ?? 0), dayStart, now),
    week: sumAmountInPeriod(entries, (entry) => entry.invoicedAt, (entry) => Number(entry.invoiceAmountAwg ?? 0), weekStart, now),
    month: sumAmountInPeriod(entries, (entry) => entry.invoicedAt, (entry) => Number(entry.invoiceAmountAwg ?? 0), monthStart, now),
  };
  const recaudo = {
    day: sumAmountInPeriod(collections, (entry) => entry.collectedAt, (entry) => Number(entry.amountAwg ?? 0), dayStart, now),
    week: sumAmountInPeriod(collections, (entry) => entry.collectedAt, (entry) => Number(entry.amountAwg ?? 0), weekStart, now),
    month: sumAmountInPeriod(collections, (entry) => entry.collectedAt, (entry) => Number(entry.amountAwg ?? 0), monthStart, now),
  };
  const outstandingTotal = entries.reduce((sum, entry) => sum + Number(entry.outstandingAmountAwg ?? 0), 0);
  const facturacionByPaymentMethod = {
    credito: entries
      .filter((entry) => entry.paymentMethod === "credito")
      .reduce((sum, entry) => sum + Number(entry.invoiceAmountAwg ?? 0), 0),
    datafono: entries
      .filter((entry) => entry.paymentMethod === "datafono")
      .reduce((sum, entry) => sum + Number(entry.invoiceAmountAwg ?? 0), 0),
    transferencia: entries
      .filter((entry) => entry.paymentMethod === "transferencia")
      .reduce((sum, entry) => sum + Number(entry.invoiceAmountAwg ?? 0), 0),
    efectivo: entries
      .filter((entry) => entry.paymentMethod === "efectivo")
      .reduce((sum, entry) => sum + Number(entry.invoiceAmountAwg ?? 0), 0),
  };
  const recaudoByPaymentMethod = {
    datafono: collections
      .filter((entry) => entry.paymentMethod === "datafono")
      .reduce((sum, entry) => sum + Number(entry.amountAwg ?? 0), 0),
    transferencia: collections
      .filter((entry) => entry.paymentMethod === "transferencia")
      .reduce((sum, entry) => sum + Number(entry.amountAwg ?? 0), 0),
    efectivo: collections
      .filter((entry) => entry.paymentMethod === "efectivo")
      .reduce((sum, entry) => sum + Number(entry.amountAwg ?? 0), 0),
  };

  return {
    facturacion,
    recaudo,
    outstandingTotal,
    facturacionByPaymentMethod,
    recaudoByPaymentMethod,
  };
}

function mapCarteraEntryRecord(entry: {
  _id?: unknown;
  orderId?: unknown;
  storeId?: unknown;
  storeName?: unknown;
  salesRepId?: unknown;
  salesRepName?: unknown;
  routeId?: unknown;
  routeName?: unknown;
  routeDay?: unknown;
  deliveryZone?: unknown;
  paymentMethod?: unknown;
  invoiceAmountAwg?: unknown;
  invoiceNumber?: unknown;
  collectedAmountAwg?: unknown;
  outstandingAmountAwg?: unknown;
  invoicedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  const invoiceAmountAwg = Number(entry.invoiceAmountAwg ?? 0);
  const paymentMethod = String(entry.paymentMethod ?? "");
  const storedCollectedAmountAwg = Number(entry.collectedAmountAwg ?? NaN);
  const storedOutstandingAmountAwg = Number(entry.outstandingAmountAwg ?? NaN);
  const collectedAmountAwg = Number.isFinite(storedCollectedAmountAwg)
    ? storedCollectedAmountAwg
    : paymentMethod === "credito"
      ? 0
      : invoiceAmountAwg;
  const outstandingAmountAwg = Number.isFinite(storedOutstandingAmountAwg)
    ? storedOutstandingAmountAwg
    : paymentMethod === "credito"
      ? Math.max(invoiceAmountAwg - collectedAmountAwg, 0)
      : 0;

  return {
    _id: String(entry._id),
    orderId: String(entry.orderId ?? ""),
    storeId: String(entry.storeId ?? ""),
    storeName: String(entry.storeName ?? ""),
    salesRepId: String(entry.salesRepId ?? ""),
    salesRepName: String(entry.salesRepName ?? ""),
    routeId: String(entry.routeId ?? ""),
    routeName: String(entry.routeName ?? ""),
    routeDay: String(entry.routeDay ?? ""),
    deliveryZone: String(entry.deliveryZone ?? ""),
    paymentMethod,
    invoiceAmountAwg,
    invoiceNumber: Number(entry.invoiceNumber ?? 0) || null,
    collectedAmountAwg,
    outstandingAmountAwg,
    invoicedAt: entry.invoicedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

const CARTERA_CREDIT_DUE_DAYS = 30;

function getCarteraInvoiceAgeDays(invoicedAt: unknown, referenceDate = new Date()) {
  const invoiceDate = invoicedAt instanceof Date ? invoicedAt : new Date(String(invoicedAt ?? ""));

  if (Number.isNaN(invoiceDate.getTime())) {
    return 0;
  }

  const invoiceKey = getBusinessDateKeyFromDate(invoiceDate);
  const todayKey = getBusinessDateKeyFromDate(referenceDate);
  const start = new Date(`${invoiceKey}T12:00:00`);
  const end = new Date(`${todayKey}T12:00:00`);

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

async function fetchOverdueCarteraEntries() {
  const entries = await CarteraEntry.find({
    active: { $ne: false },
    paymentMethod: "credito",
    outstandingAmountAwg: { $gt: 0.009 },
  }).sort({ invoicedAt: 1, createdAt: 1 }).lean();

  return entries
    .map((entry) => mapCarteraEntryRecord(entry))
    .filter((entry) => getCarteraInvoiceAgeDays(entry.invoicedAt) > CARTERA_CREDIT_DUE_DAYS);
}

async function applyCreditCollections(
  collections: Array<{ carteraEntryId: string; amountAwg: number; paymentMethod: "datafono" | "transferencia" | "efectivo" }>,
  context: {
    storeId: string;
    storeName: string;
    relatedOrderId: string;
    salesRepId: string;
    salesRepName: string;
    collectedAt: Date;
    notes?: string;
  },
) {
  if (collections.length === 0) {
    return [];
  }

  const entryIds = [...new Set(collections.map((entry) => entry.carteraEntryId))];
  const pendingEntries = await CarteraEntry.find({
    _id: { $in: entryIds },
    storeId: context.storeId,
    active: { $ne: false },
    outstandingAmountAwg: { $gt: 0 },
  }).lean();
  const pendingById = new Map(pendingEntries.map((entry) => [String(entry._id), entry]));
  const createdCollections = [];

  for (const collection of collections) {
    const targetEntry = pendingById.get(collection.carteraEntryId);

    if (!targetEntry) {
      throw new Error("Una de las facturas de credito seleccionadas ya no tiene saldo pendiente.");
    }

    const outstandingAmountAwg = Number(targetEntry.outstandingAmountAwg ?? 0);

    if (collection.amountAwg > outstandingAmountAwg + 0.009) {
      throw new Error(`El recaudo supera el saldo pendiente de ${targetEntry.storeName}.`);
    }

    const nextCollectedAmountAwg = Number(targetEntry.collectedAmountAwg ?? 0) + collection.amountAwg;
    const nextOutstandingAmountAwg = Math.max(outstandingAmountAwg - collection.amountAwg, 0);

    await CarteraEntry.findByIdAndUpdate(targetEntry._id, {
      collectedAmountAwg: Math.round(nextCollectedAmountAwg * 100) / 100,
      outstandingAmountAwg: Math.round(nextOutstandingAmountAwg * 100) / 100,
    });

    targetEntry.collectedAmountAwg = nextCollectedAmountAwg;
    targetEntry.outstandingAmountAwg = nextOutstandingAmountAwg;

    const createdCollection = await CarteraCollection.create({
      carteraEntryId: String(targetEntry._id),
      storeId: context.storeId,
      storeName: context.storeName,
      relatedOrderId: context.relatedOrderId,
      amountAwg: collection.amountAwg,
      paymentMethod: collection.paymentMethod,
      collectedAt: context.collectedAt,
      salesRepId: context.salesRepId,
      salesRepName: context.salesRepName,
      notes: context.notes ?? "Recaudo de factura en credito durante entrega.",
      active: true,
    });

    createdCollections.push(createdCollection);
  }

  return createdCollections;
}

const MIN_INVOICE_NUMBER = 12020;

async function getNextInvoiceNumber() {
  const activeEntries = await CarteraEntry.find({
    active: { $ne: false },
    invoiceNumber: { $exists: true, $ne: null, $gte: MIN_INVOICE_NUMBER },
  })
    .select({ invoiceNumber: 1 })
    .lean();
  const numberedOrders = await Order.find({
    invoiceNumber: { $exists: true, $ne: null, $gte: MIN_INVOICE_NUMBER },
  })
    .select({ invoiceNumber: 1 })
    .lean();

  const usedNumbers = new Set(
    [...activeEntries, ...numberedOrders]
      .map((entry) => Number(entry.invoiceNumber))
      .filter((number) => Number.isFinite(number) && number >= MIN_INVOICE_NUMBER),
  );

  let candidate = MIN_INVOICE_NUMBER;

  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }

  return candidate;
}

async function isInvoiceNumberAvailable(invoiceNumber: number, excludeOrderId = "") {
  if (!Number.isFinite(invoiceNumber) || invoiceNumber < MIN_INVOICE_NUMBER) {
    return false;
  }

  const [existingEntry, existingOrder] = await Promise.all([
    CarteraEntry.findOne({ active: { $ne: false }, invoiceNumber }).select({ orderId: 1 }).lean(),
    Order.findOne({ invoiceNumber }).select({ _id: 1 }).lean(),
  ]);

  if (existingEntry && String(existingEntry.orderId) !== excludeOrderId) {
    return false;
  }

  if (existingOrder && String(existingOrder._id) !== excludeOrderId) {
    return false;
  }

  return true;
}

async function resolveRequestedInvoiceNumber(requested: unknown, order: { _id: unknown; invoiceNumber?: unknown }) {
  const orderId = String(order._id);
  const currentNumber = Number(order.invoiceNumber ?? 0);
  const parsedRequested = Number(
    typeof requested === "number" || typeof requested === "string"
      ? String(requested).trim()
      : currentNumber,
  );

  if (Number.isFinite(parsedRequested) && parsedRequested >= MIN_INVOICE_NUMBER) {
    const available = await isInvoiceNumberAvailable(parsedRequested, orderId);

    if (!available) {
      throw new Error(`La factura #${parsedRequested} ya esta en uso.`);
    }

    return parsedRequested;
  }

  if (currentNumber >= MIN_INVOICE_NUMBER) {
    return currentNumber;
  }

  return getNextInvoiceNumber();
}

type OrderItemWithOptionalPrice = {
  productId?: unknown;
  quantity?: unknown;
  salePriceAwg?: unknown;
};

function mergeOrderItemPrices<T extends { productId: string }>(
  orderItems: T[],
  rawItems: unknown,
) {
  const priceByProductId = new Map<string, number>();
  const stockRowIdByProductId = new Map<string, string>();

  if (Array.isArray(rawItems)) {
    rawItems.forEach((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return;
      }

      const row = entry as { productId?: unknown; salePriceAwg?: unknown; stockRowId?: unknown };
      const productId = typeof row.productId === "string" ? row.productId.trim() : "";
      const salePriceAwg = Number(row.salePriceAwg ?? NaN);
      const stockRowId = typeof row.stockRowId === "string" ? row.stockRowId.trim() : "";

      if (productId && Number.isFinite(salePriceAwg) && salePriceAwg >= 0) {
        priceByProductId.set(productId, Math.round(salePriceAwg * 100) / 100);
      }

      if (productId && stockRowId) {
        stockRowIdByProductId.set(productId, stockRowId);
      }
    });
  }

  return orderItems.map((item) => {
    const productId = String(item.productId);
    const nextPrice = priceByProductId.get(productId);
    const stockRowId = stockRowIdByProductId.get(productId);
    const nextItem = stockRowId ? { ...item, stockRowId } : item;

    if (nextPrice !== undefined) {
      return { ...nextItem, salePriceAwg: nextPrice };
    }

    return nextItem;
  });
}

function resolveFrozenOrderItemSalePrice(
  item: OrderItemWithOptionalPrice,
  productSalePrice = 0,
) {
  const frozenPrice = Number(item.salePriceAwg ?? NaN);

  if (Number.isFinite(frozenPrice) && frozenPrice >= 0) {
    return Math.round(frozenPrice * 100) / 100;
  }

  return Math.round(Math.max(0, Number(productSalePrice ?? 0)) * 100) / 100;
}

async function buildWarehouseInvoiceDocumentLines(order: {
  items?: Array<OrderItemWithOptionalPrice>;
  giftItems?: Array<{ productId?: unknown; quantity?: unknown; stockRowId?: unknown }>;
}) {
  const orderItems = Array.isArray(order.items) ? order.items : [];
  const giftItems = Array.isArray(order.giftItems) ? order.giftItems : [];
  const productIds = Array.from(new Set([
    ...orderItems.map((item) => String(item.productId ?? "")).filter(Boolean),
    ...giftItems.map((item) => String(item.productId ?? "")).filter(Boolean),
  ]));
  const products = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1, description: 1, salePrice: 1 }).lean()
    : [];
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  const regularLines = orderItems.map((item) => {
    const product = productsById.get(String(item.productId ?? ""));
    const quantity = Number(item.quantity ?? 0);
    const rate = resolveFrozenOrderItemSalePrice(item, Number(product?.salePrice ?? 0));
    const amount = Math.round(quantity * rate * 100) / 100;

    return {
      productId: String(item.productId ?? ""),
      productName: String(product?.name ?? "Producto"),
      productSku: String(product?.sku ?? "-"),
      productDescription: String(product?.description ?? "").trim() || String(product?.name ?? "Producto"),
      quantity,
      rate,
      amount,
    };
  });

  const giftLines = giftItems.map((item) => {
    const product = productsById.get(String(item.productId ?? ""));
    const quantity = Number(item.quantity ?? 0);

    return {
      productId: String(item.productId ?? ""),
      productName: String(product?.name ?? "Producto"),
      productSku: String(product?.sku ?? "-"),
      productDescription: `Obsequio · ${String(product?.description ?? "").trim() || String(product?.name ?? "Producto")}`,
      quantity,
      rate: 0,
      amount: 0,
    };
  });

  return [...regularLines, ...giftLines];
}

apiRouter.get("/warehouse/orders/:id/invoice-document", async (request, response) => {
  try {
    const order = await Order.findById(request.params.id).lean();

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    const mappedOrder = await mapWarehouseOrderRecord(order);
    const carteraEntry = await CarteraEntry.findOne({ orderId: String(order._id), active: { $ne: false } }).lean();
    const logisticsInvoice = await LogisticsInvoice.findOne({ orderId: String(order._id), active: { $ne: false } }).lean();
    const fallbackLines = await buildWarehouseInvoiceDocumentLines(order);
    const sourceItems = logisticsInvoice?.items?.length
      ? logisticsInvoice.items.map((item) => ({
        productId: String(item.productId ?? ""),
        productName: String(item.productName ?? "Producto"),
        productSku: String(item.productSku ?? "-"),
        quantity: Number(item.quantity ?? 0),
        rate: Number(item.salePriceAwg ?? 0),
        amount: Number(item.lineTotalAwg ?? 0),
      }))
      : fallbackLines;
    const productIds = sourceItems
      .map((item) => String(item.productId ?? "").trim())
      .filter(Boolean);
    const invoiceProducts = productIds.length > 0
      ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1, description: 1 }).lean()
      : [];
    const invoiceProductsById = new Map(invoiceProducts.map((product) => [String(product._id), product]));
    const items = sourceItems.map((item) => {
      const product = invoiceProductsById.get(String(item.productId ?? ""));

      return {
        productName: String(item.productName ?? product?.name ?? "Producto"),
        productSku: String(item.productSku ?? product?.sku ?? "-"),
        productDescription: String(product?.description ?? "").trim()
          || String(item.productName ?? "Producto"),
        quantity: Number(item.quantity ?? 0),
        rate: Number(item.rate ?? 0),
        amount: Number(item.amount ?? 0),
      };
    });
    const totalAmount = carteraEntry
      ? Number(carteraEntry.invoiceAmountAwg ?? 0)
      : items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
    let invoiceNumber = Number(carteraEntry?.invoiceNumber ?? order.invoiceNumber ?? 0) || null;

    if (!invoiceNumber && order.status !== "submitted") {
      invoiceNumber = await getNextInvoiceNumber();
      await Order.findByIdAndUpdate(
        order._id,
        { invoiceNumber },
        { new: true, runValidators: true },
      ).lean();
    }

    response.json({
      order: mappedOrder,
      carteraEntry: carteraEntry ? mapCarteraEntryRecord(carteraEntry) : null,
      invoiceNumber,
      invoicedAt: carteraEntry?.invoicedAt ?? resolveOrderInvoiceDate(order),
      items,
      totalAmount,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

async function deactivateCarteraForOrder(orderId: string) {
  const normalizedOrderId = String(orderId ?? "").trim();

  if (!normalizedOrderId) {
    return;
  }

  const relatedEntries = await CarteraEntry.find({ orderId: normalizedOrderId }).select({ _id: 1 }).lean();
  const carteraEntryIds = relatedEntries.map((entry) => String(entry._id));

  if (carteraEntryIds.length === 0) {
    return;
  }

  await Promise.all([
    CarteraEntry.updateMany({ orderId: normalizedOrderId }, { active: false }),
    CarteraCollection.updateMany(
      {
        active: { $ne: false },
        $or: [
          { relatedOrderId: normalizedOrderId },
          { carteraEntryId: { $in: carteraEntryIds } },
        ],
      },
      { active: false },
    ),
  ]);
}

async function cleanupOrphanCarteraEntries() {
  const activeEntries = await CarteraEntry.find({ active: { $ne: false } }).select({ orderId: 1 }).lean();

  if (activeEntries.length === 0) {
    return;
  }

  const orderIds = Array.from(new Set(activeEntries.map((entry) => String(entry.orderId ?? "")).filter(Boolean)));
  const existingOrders = await Order.find({ _id: { $in: orderIds } }).select({ _id: 1, status: 1 }).lean();
  const orderStatusById = new Map(existingOrders.map((order) => [String(order._id), String(order.status ?? "")]));

  for (const entry of activeEntries) {
    const orderId = String(entry.orderId ?? "");

    if (!orderId) {
      continue;
    }

    const orderStatus = orderStatusById.get(orderId);

    if (!orderStatus || orderStatus !== "delivered") {
      await deactivateCarteraForOrder(orderId);
    }
  }
}

async function restoreOrderInventoryOnDelete(order: {
  _id: unknown;
  items?: Array<{ productId?: unknown; quantity?: unknown }>;
}) {
  const orderId = String(order._id);
  const quantitiesByProductId = buildOrderQuantitiesMap(Array.isArray(order.items) ? order.items : []);

  for (const [productId, quantity] of quantitiesByProductId.entries()) {
    await restoreInventoryForProduct(productId, quantity, orderId);
  }
}

async function deleteWarehouseOrderWithCleanup(orderId: string) {
  const order = await Order.findById(orderId).lean();

  if (!order) {
    throw new Error("El pedido no existe.");
  }

  if (order.status === "delivered") {
    await restoreOrderInventoryOnDelete(order);
  }

  await deactivateCarteraForOrder(String(order._id));
  await Order.findByIdAndDelete(order._id);
  await OrderDeleteRequest.updateMany(
    { orderId: String(order._id), status: "pending" },
    {
      status: "rejected",
      reviewNotes: "Pedido eliminado.",
      reviewedAt: new Date(),
    },
  );
}

function mapOrderDeleteRequestRecord(entry: {
  _id?: unknown;
  orderId?: unknown;
  storeId?: unknown;
  storeName?: unknown;
  salesRepName?: unknown;
  routeName?: unknown;
  invoiceNumber?: unknown;
  orderStatus?: unknown;
  status?: unknown;
  requestedByUserId?: unknown;
  requestedByUserName?: unknown;
  requestedByRole?: unknown;
  requestNotes?: unknown;
  reviewedByUserId?: unknown;
  reviewedByUserName?: unknown;
  reviewNotes?: unknown;
  reviewedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}) {
  return {
    _id: String(entry._id),
    orderId: String(entry.orderId ?? ""),
    storeId: String(entry.storeId ?? ""),
    storeName: String(entry.storeName ?? ""),
    salesRepName: String(entry.salesRepName ?? ""),
    routeName: String(entry.routeName ?? ""),
    invoiceNumber: Number(entry.invoiceNumber ?? 0) || null,
    orderStatus: String(entry.orderStatus ?? ""),
    status: String(entry.status ?? "pending"),
    requestedByUserId: String(entry.requestedByUserId ?? ""),
    requestedByUserName: String(entry.requestedByUserName ?? ""),
    requestedByRole: String(entry.requestedByRole ?? ""),
    requestNotes: String(entry.requestNotes ?? ""),
    reviewedByUserId: String(entry.reviewedByUserId ?? ""),
    reviewedByUserName: String(entry.reviewedByUserName ?? ""),
    reviewNotes: String(entry.reviewNotes ?? ""),
    reviewedAt: entry.reviewedAt ? String(entry.reviewedAt) : null,
    createdAt: entry.createdAt ? String(entry.createdAt) : "",
    updatedAt: entry.updatedAt ? String(entry.updatedAt) : "",
  };
}

apiRouter.put("/warehouse/orders/:id/dispatch", async (request, response) => {
  try {
    const order = await Order.findById(request.params.id).lean();

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    if (order.status === "delivered") {
      response.status(400).json({ message: "No puedes enviar a despacho un pedido ya facturado." });
      return;
    }

    if (order.status === "dispatched") {
      const existingInvoiceNumber = Number(order.invoiceNumber ?? 0) || await getNextInvoiceNumber();
      const currentOrder = Number(order.invoiceNumber ?? 0) > 0
        ? order
        : await Order.findByIdAndUpdate(
          request.params.id,
          { invoiceNumber: existingInvoiceNumber },
          { new: true, runValidators: true },
        ).lean();

      response.json({
        message: "El pedido ya estaba en despacho.",
        order: {
          _id: String(currentOrder?._id ?? order._id),
          status: currentOrder?.status ?? order.status,
          updatedAt: currentOrder?.updatedAt ?? order.updatedAt,
        },
        invoiceNumber: existingInvoiceNumber,
      });
      return;
    }

    if (order.status !== "submitted") {
      response.status(400).json({ message: "Solo puedes enviar a despacho pedidos recibidos en bodega." });
      return;
    }

    const orderItems = Array.isArray(order.items) ? order.items : [];
    const itemsWithPrices = mergeOrderItemPrices(orderItems, request.body?.items);
    const invoiceNumber = Number(order.invoiceNumber ?? 0) || await getNextInvoiceNumber();

    const updatedOrder = await Order.findByIdAndUpdate(
      request.params.id,
      { status: "dispatched", items: itemsWithPrices, invoiceNumber },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedOrder) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    await deactivateCarteraForOrder(String(updatedOrder._id));

    response.json({
      message: "Pedido enviado a despacho correctamente.",
      order: {
        _id: String(updatedOrder._id),
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt,
      },
      invoiceNumber,
    });

    void notifyContabilidadOrderDispatched({
      _id: updatedOrder._id,
      storeName: updatedOrder.storeName,
      salesRepName: updatedOrder.salesRepName,
      routeName: updatedOrder.routeName,
    });
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

    if (order.status === "delivered") {
      response.json({
        message: "El pedido ya estaba completado.",
        order: {
          _id: String(order._id),
          status: order.status,
          updatedAt: order.updatedAt,
        },
        carteraEntryId: null,
      });
      return;
    }

    if (order.status !== "dispatched") {
      response.status(400).json({ message: "Primero imprime y envia el pedido a despacho antes de facturarlo." });
      return;
    }

    const paymentMethod = normalizeCarteraPaymentMethod(request.body?.paymentMethod);
    const invoiceAmountAwg = normalizeCarteraInvoiceAmount(request.body?.invoiceAmountAwg);
    const creditCollections = normalizeCreditCollectionsPayload(request.body?.creditCollections);
    const invoicedAt = resolveOrderInvoiceDate(order);
    const isCreditInvoice = paymentMethod === "credito";
    const initialCollectedAmountAwg = isCreditInvoice ? 0 : invoiceAmountAwg;
    const initialOutstandingAmountAwg = isCreditInvoice ? invoiceAmountAwg : 0;
    const invoiceNumber = await resolveRequestedInvoiceNumber(request.body?.invoiceNumber, order);
    const orderItems = Array.isArray(order.items) ? order.items : [];
    const itemsWithPrices = mergeOrderItemPrices(orderItems, request.body?.items);

    await applyOrderInventoryDeduction({
      _id: order._id,
      items: orderItems,
      giftItems: Array.isArray(order.giftItems) ? order.giftItems : [],
    });

    const updatedOrder = await Order.findByIdAndUpdate(
      request.params.id,
      { status: "delivered", items: itemsWithPrices, invoiceNumber },
      { new: true, runValidators: true },
    ).lean();

    if (!updatedOrder) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    const carteraEntry = await CarteraEntry.findOneAndUpdate(
      { orderId: String(updatedOrder._id) },
      {
        orderId: String(updatedOrder._id),
        storeId: String(updatedOrder.storeId ?? ""),
        storeName: String(updatedOrder.storeName ?? ""),
        salesRepId: String(updatedOrder.salesRepId ?? ""),
        salesRepName: String(updatedOrder.salesRepName ?? ""),
        routeId: String(updatedOrder.routeId ?? ""),
        routeName: String(updatedOrder.routeName ?? ""),
        routeDay: String(updatedOrder.routeDay ?? ""),
        deliveryZone: String(updatedOrder.deliveryZone ?? ""),
        paymentMethod,
        invoiceAmountAwg,
        invoiceNumber,
        collectedAmountAwg: initialCollectedAmountAwg,
        outstandingAmountAwg: initialOutstandingAmountAwg,
        invoicedAt,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    ).lean();

    if (!carteraEntry) {
      throw new Error("No fue posible registrar la factura en cartera.");
    }

    if (!isCreditInvoice) {
      await CarteraCollection.create({
        carteraEntryId: String(carteraEntry._id),
        storeId: String(updatedOrder.storeId ?? ""),
        storeName: String(updatedOrder.storeName ?? ""),
        relatedOrderId: String(updatedOrder._id),
        amountAwg: invoiceAmountAwg,
        paymentMethod,
        collectedAt: invoicedAt,
        salesRepId: String(updatedOrder.salesRepId ?? ""),
        salesRepName: String(updatedOrder.salesRepName ?? ""),
        notes: "Recaudo al facturar pedido.",
        active: true,
      });
    }

    const appliedCreditCollections = await applyCreditCollections(creditCollections, {
      storeId: String(updatedOrder.storeId ?? ""),
      storeName: String(updatedOrder.storeName ?? ""),
      relatedOrderId: String(updatedOrder._id),
      salesRepId: String(updatedOrder.salesRepId ?? ""),
      salesRepName: String(updatedOrder.salesRepName ?? ""),
      collectedAt: invoicedAt,
    });

    response.json({
      message: appliedCreditCollections.length > 0
        ? "Pedido facturado y recaudos de credito registrados correctamente."
        : "Pedido facturado y completado correctamente.",
      order: {
        _id: String(updatedOrder._id),
        status: updatedOrder.status,
        updatedAt: updatedOrder.updatedAt,
      },
      carteraEntryId: String(carteraEntry._id),
      invoiceNumber,
      creditCollectionsApplied: appliedCreditCollections.length,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/warehouse/orders/:id", async (request, response) => {
  try {
    const requestedByRole = typeof request.body?.requestedByRole === "string" ? request.body.requestedByRole.trim() : "";

    if (requestedByRole !== "management") {
      response.status(403).json({ message: "Debes solicitar autorizacion de gerencia para borrar pedidos." });
      return;
    }

    await deleteWarehouseOrderWithCleanup(String(request.params.id));

    response.json({
      message: "Pedido borrado correctamente. La factura y recaudos asociados fueron retirados de cartera.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "El pedido no existe.") {
      response.status(404).json({ message: error.message });
      return;
    }

    sendCreationError(response, error);
  }
});

apiRouter.post("/warehouse/orders/:id/delete-requests", async (request, response) => {
  try {
    const order = await Order.findById(request.params.id).lean();

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    const existingPending = await OrderDeleteRequest.findOne({
      orderId: String(order._id),
      status: "pending",
    }).lean();

    if (existingPending) {
      response.status(400).json({ message: "Ya existe una solicitud pendiente para borrar este pedido." });
      return;
    }

    const payload = request.body as {
      requestNotes?: unknown;
      requestedByUserId?: unknown;
      requestedByUserName?: unknown;
      requestedByRole?: unknown;
    };
    const requestedByUserId = typeof payload.requestedByUserId === "string" ? payload.requestedByUserId.trim() : "";
    const requestedByUserName = typeof payload.requestedByUserName === "string" ? payload.requestedByUserName.trim() : "";
    const requestedByRole = typeof payload.requestedByRole === "string" ? payload.requestedByRole.trim() : "";
    const requestNotes = typeof payload.requestNotes === "string" ? payload.requestNotes.trim() : "";

    if (!requestedByUserId || !requestedByUserName || !requestedByRole) {
      response.status(400).json({ message: "No fue posible identificar al usuario que solicita el borrado." });
      return;
    }

    if (requestedByRole === "management") {
      response.status(400).json({ message: "Gerencia puede borrar el pedido directamente." });
      return;
    }

    const carteraEntry = await CarteraEntry.findOne({ orderId: String(order._id) })
      .sort({ active: -1, createdAt: -1 })
      .lean();

    const createdRequest = await OrderDeleteRequest.create({
      orderId: String(order._id),
      storeId: String(order.storeId ?? ""),
      storeName: String(order.storeName ?? ""),
      salesRepName: String(order.salesRepName ?? ""),
      routeName: String(order.routeName ?? ""),
      invoiceNumber: Number(carteraEntry?.invoiceNumber ?? 0) || undefined,
      orderStatus: order.status as "submitted" | "dispatched" | "delivered",
      requestedByUserId,
      requestedByUserName,
      requestedByRole,
      requestNotes,
    });

    response.status(201).json({
      message: "Solicitud de borrado enviada a gerencia.",
      request: mapOrderDeleteRequestRecord(createdRequest.toObject()),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/order-delete-requests", async (request, response) => {
  try {
    const status = typeof request.query.status === "string" ? request.query.status.trim() : "pending";
    const filter = status === "all" ? {} : { status: "pending" };
    const requests = await OrderDeleteRequest.find(filter).sort({ createdAt: -1 }).lean();

    response.json(requests.map((entry) => mapOrderDeleteRequestRecord(entry)));
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/order-delete-requests/:id/approve", async (request, response) => {
  try {
    const deleteRequest = await OrderDeleteRequest.findById(request.params.id);

    if (!deleteRequest) {
      response.status(404).json({ message: "La solicitud no existe." });
      return;
    }

    if (deleteRequest.status !== "pending") {
      response.status(400).json({ message: "Esta solicitud ya fue revisada." });
      return;
    }

    const payload = request.body as {
      reviewedByUserId?: unknown;
      reviewedByUserName?: unknown;
      reviewNotes?: unknown;
    };
    const reviewedByUserId = typeof payload.reviewedByUserId === "string" ? payload.reviewedByUserId.trim() : "";
    const reviewedByUserName = typeof payload.reviewedByUserName === "string" ? payload.reviewedByUserName.trim() : "";
    const reviewNotes = typeof payload.reviewNotes === "string" ? payload.reviewNotes.trim() : "";

    if (!reviewedByUserId || !reviewedByUserName) {
      response.status(400).json({ message: "No fue posible identificar al usuario que aprueba el borrado." });
      return;
    }

    const order = await Order.findById(deleteRequest.orderId).lean();

    if (order) {
      await deleteWarehouseOrderWithCleanup(deleteRequest.orderId);
    } else {
      await deactivateCarteraForOrder(deleteRequest.orderId);
    }

    deleteRequest.status = "approved";
    deleteRequest.reviewedByUserId = reviewedByUserId;
    deleteRequest.reviewedByUserName = reviewedByUserName;
    deleteRequest.reviewNotes = reviewNotes;
    deleteRequest.reviewedAt = new Date();
    await deleteRequest.save();

    response.json({
      message: order
        ? "Solicitud aprobada. El pedido fue borrado y la factura retirada de cartera."
        : "Solicitud aprobada. El pedido ya no existia, pero la factura fue retirada de cartera.",
      request: mapOrderDeleteRequestRecord(deleteRequest.toObject()),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/order-delete-requests/:id/reject", async (request, response) => {
  try {
    const deleteRequest = await OrderDeleteRequest.findById(request.params.id);

    if (!deleteRequest) {
      response.status(404).json({ message: "La solicitud no existe." });
      return;
    }

    if (deleteRequest.status !== "pending") {
      response.status(400).json({ message: "Esta solicitud ya fue revisada." });
      return;
    }

    const payload = request.body as {
      reviewedByUserId?: unknown;
      reviewedByUserName?: unknown;
      reviewNotes?: unknown;
    };
    const reviewedByUserId = typeof payload.reviewedByUserId === "string" ? payload.reviewedByUserId.trim() : "";
    const reviewedByUserName = typeof payload.reviewedByUserName === "string" ? payload.reviewedByUserName.trim() : "";
    const reviewNotes = typeof payload.reviewNotes === "string" ? payload.reviewNotes.trim() : "";

    if (!reviewedByUserId || !reviewedByUserName) {
      response.status(400).json({ message: "No fue posible identificar al usuario que rechaza el borrado." });
      return;
    }

    deleteRequest.status = "rejected";
    deleteRequest.reviewedByUserId = reviewedByUserId;
    deleteRequest.reviewedByUserName = reviewedByUserName;
    deleteRequest.reviewNotes = reviewNotes;
    deleteRequest.reviewedAt = new Date();
    await deleteRequest.save();

    response.json({
      message: "Solicitud rechazada.",
      request: mapOrderDeleteRequestRecord(deleteRequest.toObject()),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/warehouse/orders/:id/invoice-change-requests", async (request, response) => {
  try {
    const order = await Order.findById(request.params.id).lean();

    if (!order) {
      response.status(404).json({ message: "El pedido no existe." });
      return;
    }

    if (order.status !== "delivered") {
      response.status(400).json({ message: "Solo puedes solicitar cambios en pedidos ya facturados." });
      return;
    }

    const existingPending = await InvoiceChangeRequest.findOne({
      orderId: String(order._id),
      status: "pending",
    }).lean();

    if (existingPending) {
      response.status(400).json({ message: "Ya existe una solicitud pendiente para este pedido." });
      return;
    }

    const payload = request.body as {
      items?: unknown;
      requestNotes?: unknown;
      requestedByUserId?: unknown;
      requestedByUserName?: unknown;
      requestedByRole?: unknown;
    };
    const requestedByUserId = typeof payload.requestedByUserId === "string" ? payload.requestedByUserId.trim() : "";
    const requestedByUserName = typeof payload.requestedByUserName === "string" ? payload.requestedByUserName.trim() : "";
    const requestedByRole = typeof payload.requestedByRole === "string" ? payload.requestedByRole.trim() : "";
    const requestNotes = typeof payload.requestNotes === "string" ? payload.requestNotes.trim() : "";

    if (!requestedByUserId || !requestedByUserName || !requestedByRole) {
      response.status(400).json({ message: "No fue posible identificar al usuario que solicita el cambio." });
      return;
    }

    const proposedItems = normalizeInvoiceChangeRequestItems(payload.items, order.items);
    const currentItems = await enrichInvoiceChangeItems(
      order.items.map((item) => ({
        productId: String(item.productId),
        quantity: Number(item.quantity ?? 0),
        notes: typeof item.notes === "string" ? item.notes : "",
      })),
    );
    const enrichedProposedItems = await enrichInvoiceChangeItems(proposedItems);
    const currentInvoiceAmountAwg = await calculateInvoiceAmountFromItems(currentItems);
    const proposedInvoiceAmountAwg = await calculateInvoiceAmountFromItems(enrichedProposedItems);
    const carteraEntry = await CarteraEntry.findOne({ orderId: String(order._id), active: { $ne: false } }).lean();

    if (!carteraEntry) {
      response.status(400).json({ message: "Este pedido no tiene una factura registrada en cartera." });
      return;
    }

    const currentSnapshot = JSON.stringify(currentItems.map((item) => ({ productId: item.productId, quantity: item.quantity })));
    const proposedSnapshot = JSON.stringify(enrichedProposedItems.map((item) => ({ productId: item.productId, quantity: item.quantity })));

    if (currentSnapshot === proposedSnapshot && Math.abs(currentInvoiceAmountAwg - proposedInvoiceAmountAwg) < 0.009) {
      response.status(400).json({ message: "No hay cambios en la factura respecto al pedido actual." });
      return;
    }

    const createdRequest = await InvoiceChangeRequest.create({
      orderId: String(order._id),
      storeId: String(order.storeId ?? ""),
      storeName: String(order.storeName ?? ""),
      salesRepName: String(order.salesRepName ?? ""),
      routeName: String(order.routeName ?? ""),
      invoiceNumber: Number(carteraEntry.invoiceNumber ?? 0) || undefined,
      status: "pending",
      requestedByUserId,
      requestedByUserName,
      requestedByRole,
      requestNotes,
      currentItems,
      proposedItems: enrichedProposedItems,
      currentInvoiceAmountAwg: Number(carteraEntry.invoiceAmountAwg ?? currentInvoiceAmountAwg),
      proposedInvoiceAmountAwg,
      currentPaymentMethod: String(carteraEntry.paymentMethod ?? "credito") as "credito" | "datafono" | "transferencia" | "efectivo",
    });

    response.status(201).json({
      message: "Solicitud de cambio enviada a gerencia para aprobacion.",
      request: mapInvoiceChangeRequestRecord(createdRequest.toObject()),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/invoice-change-requests", async (request, response) => {
  try {
    const status = typeof request.query.status === "string" ? request.query.status.trim().toLowerCase() : "pending";
    const filter = status === "all" ? {} : { status: status === "approved" || status === "rejected" ? status : "pending" };
    const requests = await InvoiceChangeRequest.find(filter).sort({ createdAt: -1 }).lean();

    response.json(requests.map((entry) => mapInvoiceChangeRequestRecord(entry)));
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/invoice-change-requests/:id/approve", async (request, response) => {
  try {
    const changeRequest = await InvoiceChangeRequest.findById(request.params.id);

    if (!changeRequest) {
      response.status(404).json({ message: "La solicitud no existe." });
      return;
    }

    if (changeRequest.status !== "pending") {
      response.status(400).json({ message: "Esta solicitud ya fue revisada." });
      return;
    }

    const payload = request.body as {
      reviewedByUserId?: unknown;
      reviewedByUserName?: unknown;
      reviewNotes?: unknown;
    };
    const reviewedByUserId = typeof payload.reviewedByUserId === "string" ? payload.reviewedByUserId.trim() : "";
    const reviewedByUserName = typeof payload.reviewedByUserName === "string" ? payload.reviewedByUserName.trim() : "";
    const reviewNotes = typeof payload.reviewNotes === "string" ? payload.reviewNotes.trim() : "";

    if (!reviewedByUserId || !reviewedByUserName) {
      response.status(400).json({ message: "No fue posible identificar al usuario que aprueba el cambio." });
      return;
    }

    const order = await Order.findById(changeRequest.orderId);

    if (!order || order.status !== "delivered") {
      response.status(400).json({ message: "El pedido asociado ya no esta disponible para correccion." });
      return;
    }

    const carteraEntry = await CarteraEntry.findOne({ orderId: String(order._id), active: { $ne: false } }).lean();

    if (!carteraEntry) {
      response.status(400).json({ message: "No se encontro la factura en cartera." });
      return;
    }

    const proposedItems = changeRequest.proposedItems.map((item) => ({
      productId: String(item.productId),
      stockCurrent: null,
      quantity: Number(item.quantity ?? 0),
      notes: String(item.notes ?? ""),
    }));

    await applyOrderInventoryDelta(String(order._id), order.items, proposedItems);

    await Order.findByIdAndUpdate(
      order._id,
      { items: proposedItems },
      { new: true, runValidators: true },
    );

    await updateCarteraAfterInvoiceChange({
      carteraEntryId: String(carteraEntry._id),
      orderId: String(order._id),
      newInvoiceAmountAwg: Number(changeRequest.proposedInvoiceAmountAwg ?? 0),
      paymentMethod: String(changeRequest.currentPaymentMethod ?? carteraEntry.paymentMethod ?? "credito") as "credito" | "datafono" | "transferencia" | "efectivo",
    });

    changeRequest.status = "approved";
    changeRequest.reviewedByUserId = reviewedByUserId;
    changeRequest.reviewedByUserName = reviewedByUserName;
    changeRequest.reviewNotes = reviewNotes;
    changeRequest.reviewedAt = new Date();
    await changeRequest.save();

    response.json({
      message: "Solicitud aprobada. La factura y el inventario fueron actualizados.",
      request: mapInvoiceChangeRequestRecord(changeRequest.toObject()),
      order: await mapWarehouseOrderRecord((await Order.findById(order._id).lean())!),
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/invoice-change-requests/:id/reject", async (request, response) => {
  try {
    const changeRequest = await InvoiceChangeRequest.findById(request.params.id);

    if (!changeRequest) {
      response.status(404).json({ message: "La solicitud no existe." });
      return;
    }

    if (changeRequest.status !== "pending") {
      response.status(400).json({ message: "Esta solicitud ya fue revisada." });
      return;
    }

    const payload = request.body as {
      reviewedByUserId?: unknown;
      reviewedByUserName?: unknown;
      reviewNotes?: unknown;
    };
    const reviewedByUserId = typeof payload.reviewedByUserId === "string" ? payload.reviewedByUserId.trim() : "";
    const reviewedByUserName = typeof payload.reviewedByUserName === "string" ? payload.reviewedByUserName.trim() : "";
    const reviewNotes = typeof payload.reviewNotes === "string" ? payload.reviewNotes.trim() : "";

    if (!reviewedByUserId || !reviewedByUserName) {
      response.status(400).json({ message: "No fue posible identificar al usuario que rechaza el cambio." });
      return;
    }

    changeRequest.status = "rejected";
    changeRequest.reviewedByUserId = reviewedByUserId;
    changeRequest.reviewedByUserName = reviewedByUserName;
    changeRequest.reviewNotes = reviewNotes;
    changeRequest.reviewedAt = new Date();
    await changeRequest.save();

    response.json({
      message: "Solicitud rechazada.",
      request: mapInvoiceChangeRequestRecord(changeRequest.toObject()),
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

apiRouter.get("/management/stores/:id/summary", async (request, response) => {
  try {
    const storeId = String(request.params.id ?? "").trim();
    const store = await Store.findById(storeId).lean();

    if (!store) {
      response.status(404).json({ message: "La tienda no existe." });
      return;
    }

    const assignedProductIds = Array.isArray(store.assignedProductIds)
      ? store.assignedProductIds.map((entry) => String(entry)).filter(Boolean)
      : [];

    const [assignedProducts, routes, orders, billedInvoices] = await Promise.all([
      assignedProductIds.length > 0
        ? Product.find({ _id: { $in: assignedProductIds }, active: { $ne: false }, shareWithAruba: { $ne: false } })
          .sort({ name: 1 })
          .lean()
        : Promise.resolve([]),
      sanitizeSalesRoutesWithStores(
        await SalesRoute.find({ active: { $ne: false } }).sort({ weekStart: -1, createdAt: -1 }).lean(),
      ),
      Order.find({ storeId }).sort({ createdAt: -1, updatedAt: -1 }).limit(50).lean(),
      LogisticsInvoice.find({
        active: { $ne: false },
        storeName: store.name,
        orderId: { $exists: true, $ne: "" },
      }).sort({ invoiceDate: -1, createdAt: -1 }).lean(),
    ]);

    const visitSchedule: Array<{
      routeId: string;
      routeName: string;
      salesRepId: string;
      salesRepName: string;
      weekLabel: string;
      weekStart: string;
      day: string;
    }> = [];

    const salesRepTracker = new Map<string, { salesRepName: string; visitCount: number; routeNames: Set<string> }>();

    for (const route of routes) {
      const routeRecord = route as Record<string, unknown> & {
        days: Array<{ day: string; stores: Array<{ storeId: string }> }>;
      };
      const routeId = String(routeRecord._id ?? routeRecord.code ?? "");
      const routeName = String(routeRecord.name ?? "");
      const salesRepId = String(routeRecord.salesRepId ?? "");
      const salesRepName = String(routeRecord.salesRepName ?? "");
      const weekLabel = String(routeRecord.weekLabel ?? "");
      const weekStartValue = routeRecord.weekStart;
      const weekStart = weekStartValue instanceof Date
        ? weekStartValue.toISOString()
        : String(weekStartValue ?? "");

      for (const day of routeRecord.days ?? []) {
        const isAssignedToDay = (day.stores ?? []).some((entry) => String(entry.storeId) === storeId);

        if (!isAssignedToDay) {
          continue;
        }

        visitSchedule.push({
          routeId,
          routeName,
          salesRepId,
          salesRepName,
          weekLabel,
          weekStart,
          day: day.day,
        });

        const current = salesRepTracker.get(salesRepId) ?? {
          salesRepName,
          visitCount: 0,
          routeNames: new Set<string>(),
        };
        current.visitCount += 1;
        current.routeNames.add(routeName);
        salesRepTracker.set(salesRepId, current);
      }
    }

    const orderProductIds = Array.from(new Set(
      orders.flatMap((order) => order.items.map((item) => String(item.productId)).filter(Boolean)),
    ));
    const orderProducts = orderProductIds.length > 0
      ? await Product.find({ _id: { $in: orderProductIds } }).select({ _id: 1, name: 1, sku: 1 }).lean()
      : [];
    const orderProductsById = new Map(orderProducts.map((product) => [String(product._id), product]));

    const enrichedOrders = orders.map((order) => ({
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
        const relatedProduct = orderProductsById.get(String(item.productId));

        return {
          productId: String(item.productId),
          stockCurrent: item.stockCurrent === undefined || item.stockCurrent === null ? null : Number(item.stockCurrent),
          quantity: Number(item.quantity ?? 0),
          notes: item.notes ?? "",
          productName: relatedProduct?.name ?? "Producto eliminado",
          productSku: relatedProduct?.sku ?? "-",
        };
      }),
    }));

    const productSalesMap = new Map<string, { productId: string; productName: string; productSku: string; totalUnits: number }>();

    for (const order of enrichedOrders) {
      for (const item of order.items) {
        const current = productSalesMap.get(item.productId) ?? {
          productId: item.productId,
          productName: item.productName,
          productSku: item.productSku,
          totalUnits: 0,
        };
        current.totalUnits += Number(item.quantity ?? 0);
        productSalesMap.set(item.productId, current);
      }
    }

    const topProducts = Array.from(productSalesMap.values())
      .sort((left, right) => right.totalUnits - left.totalUnits)
      .slice(0, 8);

    const deliveredOrders = enrichedOrders.filter((order) => order.status === "delivered").length;
    const pendingOrders = enrichedOrders.length - deliveredOrders;
    const totalUnitsOrdered = enrichedOrders.reduce(
      (total, order) => total + order.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
      0,
    );

    response.json({
      store: {
        id: String(store._id),
        code: store.code ?? "",
        name: store.name,
        address: store.address ?? "",
        email: store.email ?? "",
        phoneCountryCode: store.phoneCountryCode ?? "",
        phone: store.phone ?? "",
        managerName: store.managerName ?? "",
        defaultPaymentMethod: typeof store.defaultPaymentMethod === "string" ? store.defaultPaymentMethod : "",
        active: store.active !== false,
        createdAt: store.createdAt,
      },
      assignedProducts: assignedProducts.map((product) => ({
        productId: String(product._id),
        sku: product.sku,
        name: product.name,
        category: product.category,
        imageUrl: product.imageUrl ?? "",
        salePrice: Number(product.salePrice ?? 0),
      })),
      visitSchedule,
      visitsPerWeek: visitSchedule.length,
      salesReps: Array.from(salesRepTracker.entries()).map(([salesRepId, entry]) => ({
        salesRepId,
        salesRepName: entry.salesRepName,
        visitCount: entry.visitCount,
        routeNames: Array.from(entry.routeNames),
      })),
      orders: enrichedOrders,
      orderStats: {
        total: enrichedOrders.length,
        delivered: deliveredOrders,
        pending: pendingOrders,
        totalUnitsOrdered,
        lastOrderDate: enrichedOrders[0]?.createdAt ? String(enrichedOrders[0].createdAt) : null,
      },
      billingStats: {
        totalRevenueAwg: billedInvoices.reduce((total, invoice) => total + Number(invoice.totalRevenueAwg ?? 0), 0),
        totalUtilityAwg: billedInvoices.reduce((total, invoice) => total + Number(invoice.totalUtilityAwg ?? 0), 0),
        invoiceCount: billedInvoices.length,
      },
      topProducts,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

async function buildStorePerformanceRankings() {
  await syncDeliveredOrdersIntoLogisticsInvoices();

  const [stores, billedInvoices, orders] = await Promise.all([
    Store.find({ active: { $ne: false } }).sort({ name: 1 }).lean(),
    LogisticsInvoice.find({ active: { $ne: false } }).lean(),
    Order.find().select({ storeId: 1, storeName: 1, status: 1 }).lean(),
  ]);

  const storeStats = new Map<string, {
    storeId: string;
    storeName: string;
    address: string;
    totalRevenueAwg: number;
    totalUtilityAwg: number;
    invoiceCount: number;
    orderCount: number;
    deliveredOrders: number;
  }>();

  for (const store of stores) {
    const storeId = String(store._id);
    storeStats.set(storeId, {
      storeId,
      storeName: store.name,
      address: String(store.address ?? ""),
      totalRevenueAwg: 0,
      totalUtilityAwg: 0,
      invoiceCount: 0,
      orderCount: 0,
      deliveredOrders: 0,
    });
  }

  const storeIdByName = new Map(stores.map((store) => [store.name.trim().toLowerCase(), String(store._id)]));

  for (const invoice of billedInvoices) {
    const storeName = String(invoice.storeName ?? "").trim();
    const storeId = storeIdByName.get(storeName.toLowerCase()) ?? "";

    if (!storeId || !storeStats.has(storeId)) {
      continue;
    }

    const current = storeStats.get(storeId)!;
    current.totalRevenueAwg += Number(invoice.totalRevenueAwg ?? 0);
    current.totalUtilityAwg += Number(invoice.totalUtilityAwg ?? 0);
    current.invoiceCount += 1;
  }

  for (const order of orders) {
    const storeId = String(order.storeId ?? "").trim();

    if (!storeId || !storeStats.has(storeId)) {
      continue;
    }

    const current = storeStats.get(storeId)!;
    current.orderCount += 1;

    if (order.status === "delivered") {
      current.deliveredOrders += 1;
    }
  }

  const rankedStores = Array.from(storeStats.values()).sort((left, right) => {
    if (right.totalRevenueAwg !== left.totalRevenueAwg) {
      return right.totalRevenueAwg - left.totalRevenueAwg;
    }

    return right.orderCount - left.orderCount;
  });

  return {
    leaders: rankedStores.slice(0, 20),
    lowPerformers: [...rankedStores].reverse().slice(0, 20),
  };
}

async function buildProductPerformanceRankings() {
  await syncDeliveredOrdersIntoLogisticsInvoices();

  const [products, billedInvoices, orders, inventoryStocks] = await Promise.all([
    Product.find({ active: { $ne: false }, shareWithAruba: { $ne: false } }).sort({ name: 1 }).lean(),
    LogisticsInvoice.find({ active: { $ne: false } }).lean(),
    Order.find().select({ items: 1, status: 1, createdAt: 1 }).lean(),
    WarehouseStock.find({ availableUnits: { $gt: 0 } }).select({ productId: 1, availableUnits: 1, expirationDate: 1 }).lean(),
  ]);

  const productStats = new Map<string, {
    productId: string;
    productName: string;
    productSku: string;
    category: string;
    totalUnits: number;
    totalRevenueAwg: number;
    orderCount: number;
  }>();

  for (const product of products) {
    const productId = String(product._id);
    productStats.set(productId, {
      productId,
      productName: product.name,
      productSku: product.sku,
      category: String(product.category ?? ""),
      totalUnits: 0,
      totalRevenueAwg: 0,
      orderCount: 0,
    });
  }

  for (const invoice of billedInvoices) {
    for (const item of invoice.items ?? []) {
      const productId = String(item.productId ?? "").trim();
      const current = productStats.get(productId);

      if (!current) {
        continue;
      }

      current.totalUnits += Number(item.quantity ?? 0);
      current.totalRevenueAwg += Number(item.lineTotalAwg ?? 0);
    }
  }

  for (const order of orders) {
    for (const item of order.items ?? []) {
      const productId = String(item.productId ?? "").trim();
      const current = productStats.get(productId);

      if (!current) {
        continue;
      }

      current.orderCount += 1;
    }
  }

  const rankedProducts = Array.from(productStats.values())
    .sort((left, right) => {
      if (right.totalUnits !== left.totalUnits) {
        return right.totalUnits - left.totalUnits;
      }

      return right.totalRevenueAwg - left.totalRevenueAwg;
    });

  const inventoryByProduct = new Map<string, { quantity: number; nearestExpiration: string | null }>();

  for (const stock of inventoryStocks) {
    const productId = String(stock.productId ?? "").trim();

    if (!productId) {
      continue;
    }

    const current = inventoryByProduct.get(productId) ?? { quantity: 0, nearestExpiration: null };
    current.quantity += Number(stock.availableUnits ?? 0);

    const expirationDate = stock.expirationDate ? String(stock.expirationDate).slice(0, 10) : null;

    if (expirationDate && (!current.nearestExpiration || expirationDate < current.nearestExpiration)) {
      current.nearestExpiration = expirationDate;
    }

    inventoryByProduct.set(productId, current);
  }

  const twoMonthsFromNow = new Date();
  twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
  const expiringThreshold = twoMonthsFromNow.toISOString().slice(0, 10);

  const noSalesWithStock = rankedProducts
    .filter((product) => product.totalUnits === 0 && (inventoryByProduct.get(product.productId)?.quantity ?? 0) > 0)
    .slice(0, 10)
    .map((product) => ({
      ...product,
      stockQuantity: inventoryByProduct.get(product.productId)?.quantity ?? 0,
    }));

  const expiringLowSales = rankedProducts
    .filter((product) => {
      const inventory = inventoryByProduct.get(product.productId);

      return Boolean(
        inventory?.nearestExpiration
        && inventory.nearestExpiration <= expiringThreshold
        && product.totalUnits <= 5,
      );
    })
    .slice(0, 10)
    .map((product) => ({
      ...product,
      stockQuantity: inventoryByProduct.get(product.productId)?.quantity ?? 0,
      nearestExpiration: inventoryByProduct.get(product.productId)?.nearestExpiration ?? null,
    }));

  const highInventoryLowSales = rankedProducts
    .filter((product) => {
      const stockQuantity = inventoryByProduct.get(product.productId)?.quantity ?? 0;

      return stockQuantity >= 20 && product.totalUnits <= 10;
    })
    .slice(0, 10)
    .map((product) => ({
      ...product,
      stockQuantity: inventoryByProduct.get(product.productId)?.quantity ?? 0,
    }));

  return {
    leaders: rankedProducts.slice(0, 20),
    lowPerformers: [...rankedProducts].reverse().slice(0, 20),
    insights: {
      noSalesWithStock,
      expiringLowSales,
      highInventoryLowSales,
      totalTrackedProducts: rankedProducts.length,
      productsWithoutSales: rankedProducts.filter((product) => product.totalUnits === 0).length,
    },
  };
}

async function buildProductStorePerformanceRankings(productId: string) {
  const normalizedProductId = String(productId ?? "").trim();

  if (!normalizedProductId) {
    throw new Error("Selecciona un producto valido.");
  }

  await syncDeliveredOrdersIntoLogisticsInvoices();

  const product = await Product.findOne({
    _id: normalizedProductId,
    active: { $ne: false },
    shareWithAruba: { $ne: false },
  }).lean();

  if (!product) {
    throw new Error("El producto no existe o no esta disponible en Aruba.");
  }

  const [stores, billedInvoices] = await Promise.all([
    Store.find({ active: { $ne: false } }).sort({ name: 1 }).lean(),
    LogisticsInvoice.find({ active: { $ne: false } }).lean(),
  ]);

  const storeStats = new Map<string, {
    storeId: string;
    storeName: string;
    address: string;
    totalUnits: number;
    totalRevenueAwg: number;
    orderCount: number;
  }>();

  for (const store of stores) {
    storeStats.set(String(store._id), {
      storeId: String(store._id),
      storeName: String(store.name ?? ""),
      address: String(store.address ?? ""),
      totalUnits: 0,
      totalRevenueAwg: 0,
      orderCount: 0,
    });
  }

  const storeIdByName = new Map(stores.map((store) => [String(store.name ?? "").trim().toLowerCase(), String(store._id)]));

  for (const invoice of billedInvoices) {
    const storeName = String(invoice.storeName ?? "").trim();
    const storeId = storeIdByName.get(storeName.toLowerCase()) ?? "";

    if (!storeId || !storeStats.has(storeId)) {
      continue;
    }

    const matchingItems = (invoice.items ?? []).filter((item) => String(item.productId ?? "").trim() === normalizedProductId);

    if (matchingItems.length === 0) {
      continue;
    }

    const current = storeStats.get(storeId)!;
    current.totalUnits += matchingItems.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
    current.totalRevenueAwg += matchingItems.reduce((sum, item) => sum + Number(item.lineTotalAwg ?? 0), 0);
    current.orderCount += 1;
  }

  const rankedStores = Array.from(storeStats.values()).sort((left, right) => {
    if (right.totalUnits !== left.totalUnits) {
      return right.totalUnits - left.totalUnits;
    }

    if (right.totalRevenueAwg !== left.totalRevenueAwg) {
      return right.totalRevenueAwg - left.totalRevenueAwg;
    }

    return left.storeName.localeCompare(right.storeName, "es");
  });

  return {
    product: {
      productId: normalizedProductId,
      productName: String(product.name ?? ""),
      productSku: String(product.sku ?? ""),
      category: String(product.category ?? ""),
    },
    leaders: rankedStores.slice(0, 20),
    lowPerformers: [...rankedStores].reverse().slice(0, 20),
    summary: {
      totalStores: rankedStores.length,
      storesWithSales: rankedStores.filter((store) => store.totalUnits > 0).length,
      totalUnits: rankedStores.reduce((sum, store) => sum + store.totalUnits, 0),
      totalRevenueAwg: rankedStores.reduce((sum, store) => sum + store.totalRevenueAwg, 0),
    },
  };
}

async function enrichOrdersForPerformance(orders: Array<Record<string, unknown>>) {
  const productIds = Array.from(new Set(
    orders.flatMap((order) => (
      Array.isArray(order.items)
        ? order.items.map((item) => String((item as { productId?: string }).productId ?? "")).filter(Boolean)
        : []
    )),
  ));
  const products = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1 }).lean()
    : [];
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  return orders.map((order) => ({
    _id: String(order._id),
    routeId: String(order.routeId ?? ""),
    routeName: String(order.routeName ?? ""),
    routeDay: String(order.routeDay ?? ""),
    storeId: String(order.storeId ?? ""),
    storeName: String(order.storeName ?? ""),
    salesRepId: String(order.salesRepId ?? ""),
    salesRepName: String(order.salesRepName ?? ""),
    deliveryZone: String(order.deliveryZone ?? ""),
    status: String(order.status ?? "submitted"),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    items: (Array.isArray(order.items) ? order.items : []).map((item) => {
      const typedItem = item as { productId?: string; stockCurrent?: number | null; quantity?: number; notes?: string };
      const relatedProduct = productsById.get(String(typedItem.productId ?? ""));

      return {
        productId: String(typedItem.productId ?? ""),
        stockCurrent: typedItem.stockCurrent === undefined || typedItem.stockCurrent === null ? null : Number(typedItem.stockCurrent),
        quantity: Number(typedItem.quantity ?? 0),
        notes: String(typedItem.notes ?? ""),
        productName: relatedProduct?.name ?? "Producto eliminado",
        productSku: relatedProduct?.sku ?? "-",
      };
    }),
  }));
}

function getPerformanceWeekRange(referenceDate = new Date()) {
  const date = new Date(referenceDate);
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + offset);
  date.setHours(0, 0, 0, 0);
  const weekStart = new Date(date);
  const weekEnd = new Date(date);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return { weekStart, weekEnd };
}

function getPerformanceMonthRange(referenceDate = new Date()) {
  const monthStart = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthEnd = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1);
  return { monthStart, monthEnd };
}

function invoiceDateInRange(invoiceDate: unknown, rangeStart: Date, rangeEnd: Date) {
  const date = new Date(String(invoiceDate ?? ""));

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date >= rangeStart && date < rangeEnd;
}

function sumInvoiceRevenueInRange(
  invoices: Array<{ invoiceDate?: unknown; totalRevenueAwg?: number }>,
  rangeStart: Date,
  rangeEnd: Date,
) {
  return invoices.reduce((total, invoice) => (
    invoiceDateInRange(invoice.invoiceDate, rangeStart, rangeEnd)
      ? total + Number(invoice.totalRevenueAwg ?? 0)
      : total
  ), 0);
}

function roundPerformanceGoalAwg(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 5000;
  }

  return Math.ceil(value / 500) * 500;
}

function suggestWeeklyGoalFromInvoices(invoices: Array<{ invoiceDate?: unknown; totalRevenueAwg?: number }>) {
  const weeklyTotals = new Map<string, number>();

  for (const invoice of invoices) {
    const date = new Date(String(invoice.invoiceDate ?? ""));

    if (Number.isNaN(date.getTime())) {
      continue;
    }

    const { weekStart } = getPerformanceWeekRange(date);
    const key = weekStart.toISOString().slice(0, 10);
    weeklyTotals.set(key, (weeklyTotals.get(key) ?? 0) + Number(invoice.totalRevenueAwg ?? 0));
  }

  const recentWeekTotals = Array.from(weeklyTotals.values())
    .sort((left, right) => right - left)
    .slice(0, 8);

  if (recentWeekTotals.length === 0) {
    return 7000;
  }

  const averageWeekly = recentWeekTotals.reduce((total, value) => total + value, 0) / recentWeekTotals.length;
  return roundPerformanceGoalAwg(Math.max(averageWeekly * 1.35, averageWeekly + 1500));
}

function buildOrderSubmissionTimeline(
  orders: Array<{
    _id: string;
    createdAt: unknown;
    storeId: string;
    storeName: string;
    routeName: string;
    routeDay: string;
    status: string;
    items: Array<{ quantity?: number }>;
  }>,
) {
  const sortedAsc = [...orders].sort((left, right) => (
    new Date(String(left.createdAt ?? "")).getTime() - new Date(String(right.createdAt ?? "")).getTime()
  ));
  const previousByDay = new Map<string, number>();

  const timeline = sortedAsc.map((order) => {
    const createdAtMs = new Date(String(order.createdAt ?? "")).getTime();
    const dayKey = Number.isNaN(createdAtMs) ? "" : new Date(createdAtMs).toISOString().slice(0, 10);
    const previousMs = dayKey ? previousByDay.get(dayKey) : undefined;
    const minutesSincePrevious = previousMs !== undefined && !Number.isNaN(createdAtMs)
      ? Math.max(0, Math.round((createdAtMs - previousMs) / 60000))
      : null;

    if (dayKey && !Number.isNaN(createdAtMs)) {
      previousByDay.set(dayKey, createdAtMs);
    }

    return {
      orderId: order._id,
      createdAt: String(order.createdAt ?? ""),
      storeId: order.storeId,
      storeName: order.storeName,
      routeName: order.routeName,
      routeDay: order.routeDay,
      status: order.status,
      productCount: order.items.length,
      totalUnits: order.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
      minutesSincePrevious,
    };
  });

  return timeline.sort((left, right) => (
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  ));
}

function normalizeSalesRepGoalPayload(body: unknown) {
  const payload = body as Record<string, unknown>;

  return {
    weeklyGoalAwg: Math.max(0, Number(payload.weeklyGoalAwg ?? 0)),
    monthlyGoalAwg: Math.max(0, Number(payload.monthlyGoalAwg ?? 0)),
    weeklyBonusAwg: Math.max(0, Number(payload.weeklyBonusAwg ?? 0)),
    monthlyBonusAwg: Math.max(0, Number(payload.monthlyBonusAwg ?? 0)),
  };
}

async function buildSalesRepPerformanceBundle() {
  await syncDeliveredOrdersIntoLogisticsInvoices();

  const now = new Date();
  const { weekStart, weekEnd } = getPerformanceWeekRange(now);
  const { monthStart, monthEnd } = getPerformanceMonthRange(now);

  const [salesReps, routes, orders, billedInvoices, savedGoals] = await Promise.all([
    User.find({ role: "sales-rep-aruba", active: { $ne: false } }).sort({ name: 1 }).lean(),
    sanitizeSalesRoutesWithStores(
      await SalesRoute.find({ active: { $ne: false } }).sort({ weekStart: -1, createdAt: -1 }).lean(),
    ),
    Order.find().sort({ createdAt: -1, updatedAt: -1 }).lean(),
    LogisticsInvoice.find({ active: { $ne: false } }).lean(),
    SalesRepGoal.find({ active: { $ne: false } }).lean(),
  ]);

  const goalsByRepId = new Map(savedGoals.map((goal) => [String(goal.salesRepId), goal]));
  const enrichedOrders = await enrichOrdersForPerformance(orders as Array<Record<string, unknown>>);

  const performance = salesReps.map((rep) => {
    const salesRepId = String(rep._id);
    const salesRepName = String(rep.name ?? rep.email ?? "Vendedor");
    const repRoutes = routes.filter((route) => String((route as Record<string, unknown>).salesRepId ?? "") === salesRepId);
    const repOrders = enrichedOrders.filter((order) => order.salesRepId === salesRepId);
    const repInvoices = billedInvoices.filter((invoice) => String(invoice.salesRepName ?? "") === salesRepName);
    const weeklyRevenueAwg = sumInvoiceRevenueInRange(repInvoices, weekStart, weekEnd);
    const monthlyRevenueAwg = sumInvoiceRevenueInRange(repInvoices, monthStart, monthEnd);
    const suggestedWeeklyGoalAwg = suggestWeeklyGoalFromInvoices(repInvoices);
    const suggestedMonthlyGoalAwg = roundPerformanceGoalAwg(suggestedWeeklyGoalAwg * 4);
    const savedGoal = goalsByRepId.get(salesRepId);
    const hasCustomGoals = Boolean(savedGoal);
    const weeklyGoalAwg = hasCustomGoals ? Number(savedGoal?.weeklyGoalAwg ?? 0) : 0;
    const monthlyGoalAwg = hasCustomGoals ? Number(savedGoal?.monthlyGoalAwg ?? 0) : 0;
    const weeklyBonusAwg = Number(savedGoal?.weeklyBonusAwg ?? 0);
    const monthlyBonusAwg = Number(savedGoal?.monthlyBonusAwg ?? 0);
    const weeklyProgress = hasCustomGoals && weeklyGoalAwg > 0
      ? Math.min(100, Math.round((weeklyRevenueAwg / weeklyGoalAwg) * 100))
      : 0;
    const monthlyProgress = hasCustomGoals && monthlyGoalAwg > 0
      ? Math.min(100, Math.round((monthlyRevenueAwg / monthlyGoalAwg) * 100))
      : 0;

    const assignedStoresMap = new Map<string, { storeId: string; storeName: string; address: string }>();

    for (const route of repRoutes) {
      const routeRecord = route as Record<string, unknown> & {
        days: Array<{ stores: Array<{ storeId: string; storeName: string; address?: string }> }>;
      };

      for (const day of routeRecord.days ?? []) {
        for (const store of day.stores ?? []) {
          assignedStoresMap.set(store.storeId, {
            storeId: store.storeId,
            storeName: store.storeName,
            address: String(store.address ?? ""),
          });
        }
      }
    }

    const routeSummaries = repRoutes.map((route) => {
      const routeRecord = route as Record<string, unknown> & {
        _id?: unknown;
        code?: string;
        name?: string;
        weekLabel?: string;
        plannedStops?: number;
        assignedDays?: number;
      };

      return {
        routeId: String(routeRecord._id ?? routeRecord.code ?? ""),
        routeName: String(routeRecord.name ?? ""),
        weekLabel: String(routeRecord.weekLabel ?? ""),
        plannedStops: Number(routeRecord.plannedStops ?? 0),
        assignedDays: Number(routeRecord.assignedDays ?? 0),
      };
    });

    const orderSubmissions = buildOrderSubmissionTimeline(repOrders).slice(0, 100);

    const ordersByRoute = Array.from(
      repOrders.reduce((map, order) => {
        const key = order.routeName || "Sin ruta";
        const current = map.get(key) ?? { routeName: key, orderCount: 0, storeNames: new Set<string>() };
        current.orderCount += 1;
        current.storeNames.add(order.storeName);
        map.set(key, current);
        return map;
      }, new Map<string, { routeName: string; orderCount: number; storeNames: Set<string> }>()).values(),
    ).map((entry) => ({
      routeName: entry.routeName,
      orderCount: entry.orderCount,
      storeNames: Array.from(entry.storeNames),
    }));

    const ordersByStore = Array.from(
      repOrders.reduce((map, order) => {
        const current = map.get(order.storeId) ?? {
          storeId: order.storeId,
          storeName: order.storeName,
          orderCount: 0,
          lastOrderDate: "",
          totalUnits: 0,
        };
        current.orderCount += 1;
        current.totalUnits += order.items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);

        const createdAt = String(order.createdAt ?? "");

        if (!current.lastOrderDate || createdAt > current.lastOrderDate) {
          current.lastOrderDate = createdAt;
        }

        map.set(order.storeId, current);
        return map;
      }, new Map<string, { storeId: string; storeName: string; orderCount: number; lastOrderDate: string; totalUnits: number }>()).values(),
    ).sort((left, right) => right.orderCount - left.orderCount);

    return {
      salesRepId,
      salesRepName,
      email: String(rep.email ?? ""),
      billingStats: {
        weeklyRevenueAwg,
        monthlyRevenueAwg,
        invoiceCount: repInvoices.length,
      },
      goals: {
        weeklyGoalAwg,
        monthlyGoalAwg,
        weeklyBonusAwg,
        monthlyBonusAwg,
        suggestedWeeklyGoalAwg,
        suggestedMonthlyGoalAwg,
        weeklyProgress,
        monthlyProgress,
        weeklyGoalMet: hasCustomGoals && weeklyRevenueAwg >= weeklyGoalAwg && weeklyGoalAwg > 0,
        monthlyGoalMet: hasCustomGoals && monthlyRevenueAwg >= monthlyGoalAwg && monthlyGoalAwg > 0,
        hasCustomGoals,
      },
      assignedStoreCount: assignedStoresMap.size,
      assignedStores: Array.from(assignedStoresMap.values()).sort((left, right) => left.storeName.localeCompare(right.storeName, "es")),
      routes: routeSummaries,
      orderSubmissions,
      ordersByRoute,
      ordersByStore,
      orderStats: {
        total: repOrders.length,
        delivered: repOrders.filter((order) => order.status === "delivered").length,
        pending: repOrders.filter((order) => order.status !== "delivered").length,
        lastSubmissionAt: repOrders[0]?.createdAt ? String(repOrders[0].createdAt) : null,
      },
      recentOrders: repOrders.slice(0, 30),
    };
  });

  const rankedByWeekly = [...performance].sort((left, right) => right.billingStats.weeklyRevenueAwg - left.billingStats.weeklyRevenueAwg);

  return {
    weekLabel: weekStart.toISOString().slice(0, 10),
    monthLabel: monthStart.toISOString().slice(0, 7),
    leaders: rankedByWeekly.slice(0, 20).map((rep) => ({
      salesRepId: rep.salesRepId,
      salesRepName: rep.salesRepName,
      weeklyRevenueAwg: rep.billingStats.weeklyRevenueAwg,
      monthlyRevenueAwg: rep.billingStats.monthlyRevenueAwg,
      weeklyProgress: rep.goals.weeklyProgress,
    })),
    lowPerformers: [...rankedByWeekly].reverse().slice(0, 20).map((rep) => ({
      salesRepId: rep.salesRepId,
      salesRepName: rep.salesRepName,
      weeklyRevenueAwg: rep.billingStats.weeklyRevenueAwg,
      monthlyRevenueAwg: rep.billingStats.monthlyRevenueAwg,
      weeklyProgress: rep.goals.weeklyProgress,
    })),
    salesReps: performance,
  };
}

apiRouter.get("/management/performance/store-rankings", async (_request, response) => {
  try {
    response.json(await buildStorePerformanceRankings());
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/performance/product-rankings", async (_request, response) => {
  try {
    response.json(await buildProductPerformanceRankings());
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/performance/products/:productId/store-rankings", async (request, response) => {
  try {
    response.json(await buildProductStorePerformanceRankings(request.params.productId));
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/performance/sales-reps", async (_request, response) => {
  try {
    response.json(await buildSalesRepPerformanceBundle());
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/performance/sales-reps/:id/goals", async (request, response) => {
  try {
    const salesRepId = String(request.params.id ?? "").trim();
    const salesRep = await User.findOne({ _id: salesRepId, role: "sales-rep-aruba", active: { $ne: false } }).lean();

    if (!salesRep) {
      response.status(404).json({ message: "El vendedor no existe o no esta activo." });
      return;
    }

    const payload = normalizeSalesRepGoalPayload(request.body);

    if (payload.weeklyGoalAwg <= 0 || payload.monthlyGoalAwg <= 0) {
      response.status(400).json({ message: "Indica metas semanal y mensual mayores a cero." });
      return;
    }

    const goal = await SalesRepGoal.findOneAndUpdate(
      { salesRepId },
      {
        salesRepId,
        weeklyGoalAwg: payload.weeklyGoalAwg,
        monthlyGoalAwg: payload.monthlyGoalAwg,
        weeklyBonusAwg: payload.weeklyBonusAwg,
        monthlyBonusAwg: payload.monthlyBonusAwg,
        active: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    response.json({
      message: `Metas actualizadas para ${salesRep.name}.`,
      goal: {
        salesRepId,
        weeklyGoalAwg: Number(goal.weeklyGoalAwg ?? 0),
        monthlyGoalAwg: Number(goal.monthlyGoalAwg ?? 0),
        weeklyBonusAwg: Number(goal.weeklyBonusAwg ?? 0),
        monthlyBonusAwg: Number(goal.monthlyBonusAwg ?? 0),
      },
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/sales/performance/me", async (request, response) => {
  try {
    const salesRepId = typeof request.query.salesRepId === "string" ? request.query.salesRepId.trim() : "";

    if (!salesRepId) {
      response.status(400).json({ message: "Indica el vendedor para consultar su desempeno." });
      return;
    }

    const salesRep = await User.findOne({ _id: salesRepId, role: "sales-rep-aruba", active: { $ne: false } }).lean();

    if (!salesRep) {
      response.status(404).json({ message: "El vendedor no existe o no esta habilitado." });
      return;
    }

    const bundle = await buildSalesRepPerformanceBundle();
    const repPerformance = bundle.salesReps.find((rep) => rep.salesRepId === salesRepId);

    if (!repPerformance) {
      response.status(404).json({ message: "No fue posible cargar el desempeno del vendedor." });
      return;
    }

    response.json({
      weekLabel: bundle.weekLabel,
      monthLabel: bundle.monthLabel,
      performance: repPerformance,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.get("/management/ops-clients", async (_request, response) => {
  const clients = await OperationsClient.find().sort({ createdAt: -1 }).lean();
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
    const [catalogProducts, clientPricing] = await Promise.all([
      resolveCatalogProducts(catalog),
      clientId
        ? CatalogClientPricing.findOne({ catalogId: catalog._id, clientId }).lean()
        : CatalogClientPricing.findOne({ catalogId: catalog._id, active: { $ne: false } }).sort({ updatedAt: -1 }).lean(),
    ]);

    const catalogProductMap = new Map(catalogProducts.map((item) => [item.productId, item]));
    const savedItems = Array.isArray(clientPricing?.items) ? clientPricing.items : [];

    const previewItems = savedItems.length > 0
      ? savedItems.map((savedItem) => {
        const productId = String(savedItem.productId ?? "");
        const product = catalogProductMap.get(productId);

        return {
          productId,
          stockRowId: String(savedItem.stockRowId ?? ""),
          lotName: String(savedItem.lotName ?? ""),
          name: String(savedItem.productName ?? product?.name ?? "Producto"),
          sku: String(savedItem.productSku ?? product?.sku ?? ""),
          category: String(product?.category ?? ""),
          imageUrl: String(product?.imageUrl ?? ""),
          cost: Number(savedItem.cost ?? product?.cost ?? 0),
          salePrice: Number(savedItem.salePrice ?? product?.salePrice ?? 0),
        };
      })
      : catalogProducts.map((item) => ({
        ...item,
        stockRowId: "",
        lotName: "",
      }));

    response.json({
      catalog,
      clientPricing,
      items: previewItems,
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
  response.json(await sanitizeSalesRoutesWithStores(routes));
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

  const [products, importCosts, warehouseStocks, inventoryAdjustments, activePromotions] = await Promise.all([
    Product.find({
      active: { $ne: false },
      ...(businessUnit === "aruba" ? { shareWithAruba: { $ne: false } } : {}),
    }).sort({ name: 1 }).lean(),
    ImportCost.find({ active: { $ne: false } }).sort({ importDate: -1, createdAt: -1 }).lean(),
    WarehouseStock.find().lean(),
    InventoryAdjustment.find().lean(),
    LotPromotion.find({ active: { $ne: false } }).lean(),
  ]);
  const activePromotionByStockRowId = new Map(activePromotions.map((promotion) => [String(promotion.stockRowId), promotion]));

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

  const rows: Array<{
    stockRowId: string;
    productId: string;
    sku: string;
    name: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    salePrice: number;
    totalSale: number;
    unitCostBreakdown: {
      containerReference: string;
      shipmentReference: string;
      importDate: string;
      importQuantity: number;
      purchaseUnitCost: number;
      expenseRows: Array<{
        id: string;
        label: string;
        totalAmount: number;
        unitAmount: number;
      }>;
      totalUnitCost: number;
    } | null;
    expirationDate: string | null;
    isExpiringSoon: boolean;
    lots: Array<{
      stockRowId: string;
      lotName: string;
      warehouseCode: string;
      quantity: number;
      unitCost: number;
      totalCost: number;
      salePrice: number;
      totalSale: number;
      expirationDate: string | null;
      isExpiringSoon: boolean;
      promotion: {
        id: string;
        discountPercent: number;
      } | null;
    }>;
  }> = products.flatMap((product: (typeof products)[number]) => {
    const productId = String(product._id);
    const productImportRows = importCostRowsByProduct.get(productId) ?? [];
    const productStockRows = stockRowsByProduct.get(productId) ?? [];
    const latestImportRow = productImportRows[0] ?? null;
    const importedQuantity = productImportRows.reduce(
      (sum: number, row: (typeof productImportRows)[number]) => sum + Number(row.importedQuantity ?? 0),
      0,
    );
    const deductedUnits = adjustmentsByProduct.get(productId) ?? 0;
    const arubaPurchaseCostUsd = Number(product.arubaPurchaseCostUsd ?? 0);
    const arubaUsdToAwgRate = Number(product.arubaUsdToAwgRate ?? 1.79);
    const arubaUnitCostAwg = arubaPurchaseCostUsd * arubaUsdToAwgRate;
    const unitCost = businessUnit === "aruba"
      ? Number(arubaUnitCostAwg > 0 ? arubaUnitCostAwg : product.cost ?? 0)
      : Number(latestImportRow?.landedUnitCost ?? product.cost ?? 0);
    const salePrice = Number(product.salePrice ?? 0);
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
          importDate: String(latestImportRow.importDate),
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
    if (productStockRows.length === 0) {
      const quantity = Math.max(importedQuantity - deductedUnits, 0);
      const expirationDate = normalizeOptionalDateValue(product.expirationDate);
      const isExpiringSoon = Boolean(
        expirationDate &&
        expirationDate >= now &&
        expirationDate <= twoMonthsLater,
      );

      return [{
        stockRowId: "",
        productId,
        sku: product.sku,
        name: product.name,
        quantity,
        unitCost,
        totalCost: quantity * unitCost,
        salePrice,
        totalSale: quantity * salePrice,
        unitCostBreakdown,
        expirationDate: expirationDate ? expirationDate.toISOString() : null,
        isExpiringSoon,
        lots: quantity > 0
          ? [{
              stockRowId: "",
              lotName: buildDefaultLotName(expirationDate),
              warehouseCode: "",
              quantity,
              unitCost,
              totalCost: quantity * unitCost,
              salePrice,
              totalSale: quantity * salePrice,
              expirationDate: expirationDate ? expirationDate.toISOString() : null,
              isExpiringSoon,
              promotion: null,
            }]
          : [],
      }];
    }

    const sortedStockRows = [...productStockRows].sort(compareWarehouseStockLotsByConsumptionPriority);
    const positiveStockRows = sortedStockRows.filter((stockRow) => Number(stockRow.availableUnits ?? 0) > 0);
    const stockRowsToRender = positiveStockRows.length > 0 ? positiveStockRows : sortedStockRows.slice(0, 1);
    const lots = stockRowsToRender.map((stockRow) => {
      const quantity = Number(stockRow.availableUnits ?? 0);
      const expirationDate = normalizeOptionalDateValue(stockRow.expirationDate ?? product.expirationDate);
      const promotion = activePromotionByStockRowId.get(String(stockRow._id));
      const isExpiringSoon = Boolean(
        expirationDate &&
        expirationDate >= now &&
        expirationDate <= twoMonthsLater,
      );
      const lotUnitCostUsd = resolveLotUnitCostUsd(stockRow, product);
      const lotUsdToAwgRate = resolveLotUsdToAwgRate(stockRow, product);
      const lotUnitCost = businessUnit === "aruba"
        ? lotUnitCostUsd * lotUsdToAwgRate
        : Number(latestImportRow?.landedUnitCost ?? product.cost ?? 0);
      const lotSalePrice = resolveLotSalePriceAwg(stockRow, product);

      return {
        stockRowId: String(stockRow._id ?? ""),
        lotName: String(stockRow.lotName ?? "") || buildDefaultLotName(expirationDate),
        warehouseCode: String(stockRow.warehouseCode ?? ""),
        quantity,
        unitCost: lotUnitCost,
        totalCost: quantity * lotUnitCost,
        salePrice: lotSalePrice,
        totalSale: quantity * lotSalePrice,
        expirationDate: expirationDate ? expirationDate.toISOString() : null,
        isExpiringSoon,
        promotion: promotion
          ? {
              id: String(promotion._id),
              discountPercent: Number(promotion.discountPercent ?? 0),
            }
          : null,
      };
    });
    const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    const totalCost = lots.reduce((sum, lot) => sum + lot.totalCost, 0);
    const totalSale = lots.reduce((sum, lot) => sum + lot.totalSale, 0);
    const weightedUnitCost = quantity > 0 ? totalCost / quantity : unitCost;
    const weightedSalePrice = quantity > 0 ? totalSale / quantity : salePrice;
    const nearestLot = lots.find((lot) => lot.quantity > 0) ?? lots[0] ?? null;
    const isExpiringSoon = lots.some((lot) => lot.isExpiringSoon);

    return [{
        stockRowId: nearestLot?.stockRowId ?? "",
        productId,
        sku: product.sku,
        name: product.name,
        quantity,
        unitCost: weightedUnitCost,
        totalCost,
        salePrice: weightedSalePrice,
        totalSale,
        unitCostBreakdown,
        expirationDate: nearestLot?.expirationDate ?? null,
        isExpiringSoon,
        lots,
      }];
  });

  const kpis = {
    totalProducts: new Set(rows.map((row: (typeof rows)[number]) => row.productId)).size,
    totalUnits: rows.reduce((sum: number, row: (typeof rows)[number]) => sum + row.quantity, 0),
    totalInventoryCost: rows.reduce((sum: number, row: (typeof rows)[number]) => sum + row.totalCost, 0),
    expiringSoon: rows.filter((row: (typeof rows)[number]) => row.isExpiringSoon).length,
  };

  const productById = new Map(products.map((product) => [String(product._id), product]));
  const history = inventoryAdjustments
    .filter((adjustment) => !Boolean((adjustment as { hiddenFromHistory?: boolean }).hiddenFromHistory))
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

apiRouter.get("/management/lot-promotions", async (_request, response) => {
  try {
    const promotions = await LotPromotion.find({ active: { $ne: false } }).sort({ updatedAt: -1 }).lean();
    const stockRowIds = promotions.map((promotion) => promotion.stockRowId);
    const productIds = promotions.map((promotion) => promotion.productId);
    const [stockRows, products] = await Promise.all([
      WarehouseStock.find({ _id: { $in: stockRowIds } }).lean(),
      Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1, salePrice: 1 }).lean(),
    ]);
    const stockById = new Map(stockRows.map((stockRow) => [String(stockRow._id), stockRow]));
    const productById = new Map(products.map((product) => [String(product._id), product]));

    response.json(promotions.map((promotion) => {
      const stockRow = stockById.get(String(promotion.stockRowId));
      const product = productById.get(String(promotion.productId));
      const basePrice = stockRow
        ? resolveLotSalePriceAwg(stockRow, product ?? {})
        : Number(product?.salePrice ?? 0);
      const discountPercent = Number(promotion.discountPercent ?? 0);

      return {
        id: String(promotion._id),
        stockRowId: String(promotion.stockRowId),
        productId: String(promotion.productId),
        productName: String(product?.name ?? "Producto"),
        productSku: String(product?.sku ?? ""),
        lotName: String(stockRow?.lotName ?? "") || buildDefaultLotName(stockRow?.expirationDate),
        expirationDate: stockRow?.expirationDate ? new Date(stockRow.expirationDate).toISOString() : null,
        availableUnits: Number(stockRow?.availableUnits ?? 0),
        discountPercent,
        basePrice,
        promotionPrice: applyPromotionDiscount(basePrice, discountPercent),
        notes: String(promotion.notes ?? ""),
        updatedAt: String(promotion.updatedAt ?? ""),
      };
    }));
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/lot-promotions", async (request, response) => {
  try {
    const stockRowId = typeof request.body?.stockRowId === "string" ? request.body.stockRowId.trim() : "";
    const discountPercent = Number(request.body?.discountPercent ?? NaN);
    const notes = typeof request.body?.notes === "string" ? request.body.notes.trim() : "";

    if (!stockRowId) {
      response.status(400).json({ message: "Selecciona el lote para la promoción." });
      return;
    }

    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
      response.status(400).json({ message: "Ingresa un descuento mayor a 0% y menor o igual a 100%." });
      return;
    }

    const stockRow = await WarehouseStock.findById(stockRowId).lean();

    if (!stockRow) {
      response.status(404).json({ message: "El lote no existe." });
      return;
    }

    const promotion = await LotPromotion.findOneAndUpdate(
      { stockRowId },
      {
        stockRowId: stockRow._id,
        productId: stockRow.productId,
        discountPercent,
        notes,
        active: true,
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();

    response.status(201).json({
      message: "Promoción de lote guardada correctamente.",
      promotion,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/lot-promotions/:id", async (request, response) => {
  try {
    const promotion = await LotPromotion.findByIdAndUpdate(
      request.params.id,
      { active: false },
      { new: true },
    ).lean();

    if (!promotion) {
      response.status(404).json({ message: "La promoción no existe." });
      return;
    }

    response.json({ message: "Promoción desactivada correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/inventory-adjustments", async (request, response) => {
  try {
    const productId = typeof request.body?.productId === "string" ? request.body.productId.trim() : "";
    const stockRowId = typeof request.body?.stockRowId === "string" ? request.body.stockRowId.trim() : "";
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
      WarehouseStock.find(stockRowId ? { _id: stockRowId, productId } : { productId }).lean(),
      ImportCost.find({ productId, active: { $ne: false } }).lean(),
      InventoryAdjustment.find({ productId }).lean(),
    ]);

    if (!product) {
      response.status(404).json({ message: "El producto no existe." });
      return;
    }

    const sortedStockRows = [...stockRows].sort(compareWarehouseStockLotsByConsumptionPriority);
    const currentStock = sortedStockRows.reduce((sum, row) => sum + Number(row.availableUnits ?? 0), 0);
    const importedQuantity = importRows.reduce((sum, row) => sum + Number(row.importedQuantity ?? 0), 0);
    const deductedQuantity = previousAdjustments.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    const availableQuantity = stockRows.length > 0 ? currentStock : Math.max(importedQuantity - deductedQuantity, 0);

    if (quantity > availableQuantity) {
      response.status(400).json({ message: `Solo hay ${availableQuantity} unidades disponibles para sacar.` });
      return;
    }

    if (sortedStockRows.length > 0) {
      let remaining = quantity;

      for (const stockRow of sortedStockRows) {
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
        await WarehouseStock.findByIdAndUpdate(
          stockRow._id,
          { availableUnits: nextAvailable },
          { runValidators: true },
        );
      }
    }

    const createdAdjustment = await InventoryAdjustment.create({
      productId,
      quantity,
      reason,
      notes,
      source: sortedStockRows.length > 0 ? "warehouse-stock" : "import-fallback",
    });

    response.status(201).json({
      message: "Salida de inventario registrada correctamente.",
      adjustment: createdAdjustment,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/inventory-rows", async (request, response) => {
  try {
    const stockRowId = typeof request.body?.stockRowId === "string" ? request.body.stockRowId.trim() : "";
    const productId = typeof request.body?.productId === "string" ? request.body.productId.trim() : "";
    const nextProductId = typeof request.body?.nextProductId === "string" && request.body.nextProductId.trim()
        ? request.body.nextProductId.trim()
      : productId;
    const quantity = Number(request.body?.quantity ?? NaN);
    const salePriceAwg = Number(request.body?.salePriceAwg ?? NaN);
    const productWeightKg = Number(request.body?.productWeightKg ?? NaN);
    const expirationDateValue = typeof request.body?.expirationDate === "string"
      ? request.body.expirationDate.trim()
      : undefined;
    const lotName = typeof request.body?.lotName === "string" ? request.body.lotName.trim() : "";

    if (!productId) {
      response.status(400).json({ message: "Selecciona un producto del inventario." });
      return;
    }

    const targetProduct = await Product.findById(nextProductId).lean();

    if (!targetProduct || targetProduct.active === false) {
      response.status(404).json({ message: "El producto no existe o esta inactivo." });
      return;
    }

    if (stockRowId) {
      if (!Number.isFinite(quantity) || quantity < 0) {
        response.status(400).json({ message: "Ingresa una cantidad valida." });
        return;
      }

      const stockRow = await WarehouseStock.findOne({ _id: stockRowId, productId }).lean();

      if (!stockRow) {
        response.status(404).json({ message: "El lote de inventario no existe." });
        return;
      }

      const normalizedExpiration = expirationDateValue !== undefined
        ? normalizeOptionalDateValue(expirationDateValue)
        : normalizeOptionalDateValue(stockRow.expirationDate);

      if (expirationDateValue !== undefined && expirationDateValue && !normalizedExpiration) {
        response.status(400).json({ message: "La fecha de caducidad no es valida." });
        return;
      }

      await applyInventoryRowStockUpdate({
        stockRowId,
        productId,
        nextProductId,
        quantity,
        expirationDate: normalizedExpiration,
        lotName: lotName || String(stockRow.lotName ?? "") || buildDefaultLotName(normalizedExpiration),
      });
    } else if (expirationDateValue !== undefined) {
      const normalizedExpiration = normalizeOptionalDateValue(expirationDateValue);

      if (expirationDateValue && !normalizedExpiration) {
        response.status(400).json({ message: "La fecha de caducidad no es valida." });
        return;
      }

      await Product.findByIdAndUpdate(nextProductId, {
        expirationDate: normalizedExpiration,
      }, { runValidators: true });
    }

    const productUpdate: Record<string, unknown> = {};

    if (Number.isFinite(salePriceAwg) && salePriceAwg >= 0) {
      productUpdate.salePrice = salePriceAwg;
    }

    if (Number.isFinite(productWeightKg) && productWeightKg >= 0) {
      productUpdate.productWeightKg = productWeightKg;
    }

    if (Object.keys(productUpdate).length > 0) {
      await Product.findByIdAndUpdate(nextProductId, productUpdate, { runValidators: true });
    }

    response.json({ message: "Inventario actualizado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/inventory-entries", async (request, response) => {
  try {
    const warehouseId = typeof request.body?.warehouseId === "string" ? request.body.warehouseId.trim() : "";
    const usdToAwgRate = Number(request.body?.usdToAwgRate ?? 0);
    const rawItems: unknown[] = Array.isArray(request.body?.items) ? request.body.items : [];
    const rawAdditionalExpenses: unknown[] = Array.isArray(request.body?.additionalExpenses) ? request.body.additionalExpenses : [];

    if (!Number.isFinite(usdToAwgRate) || usdToAwgRate <= 0) {
      response.status(400).json({ message: "Ingresa una tasa valida en USD@AWG mayor a cero." });
      return;
    }

    if (rawItems.length === 0) {
      response.status(400).json({ message: "Agrega al menos un producto para registrar inventario." });
      return;
    }

    // Parse additional expenses
    const additionalExpenses = rawAdditionalExpenses.map((expense: unknown, index: number) => {
      if (typeof expense !== "object" || expense === null) {
        throw new Error(`El costo adicional #${index + 1} no es valido.`);
      }

      const exp = expense as {
        key?: unknown;
        label?: unknown;
        amount?: unknown;
      };
      const key = typeof exp.key === "string" ? exp.key.trim() : "";
      const label = typeof exp.label === "string" ? exp.label.trim() : "";
      const amount = Number(exp.amount ?? 0);

      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error(`El monto en florines del costo adicional #${index + 1} debe ser cero o mayor.`);
      }

      if (key === "other" && !label) {
        throw new Error(`El costo adicional personalizado #${index + 1} debe tener un nombre.`);
      }

      return { key, label, amount };
    });

    // Additional expenses are entered in AWG/florins and converted to USD before affecting unit cost.
    const totalAdditionalExpensesAwg = additionalExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const items = rawItems.map((entry: unknown, index: number) => {
      if (typeof entry !== "object" || entry === null) {
        throw new Error(`El producto #${index + 1} no es valido.`);
      }

      const item = entry as {
        productId?: unknown;
        quantity?: unknown;
        costUsd?: unknown;
        salePriceAwg?: unknown;
        expirationDate?: unknown;
        lotName?: unknown;
        productWeightKg?: unknown;
      };
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const quantity = Number(item.quantity ?? 0);
      const costUsd = Number(item.costUsd ?? 0);
      const salePriceAwg = Number(item.salePriceAwg ?? 0);
      const expirationDateValue = typeof item.expirationDate === "string" ? item.expirationDate.trim() : "";
      const lotName = typeof item.lotName === "string" ? item.lotName.trim() : "";
      const productWeightKg = Number(item.productWeightKg ?? 0);

      if (!productId) {
        throw new Error(`El producto #${index + 1} no tiene identificador valido.`);
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error(`La cantidad del producto #${index + 1} debe ser mayor a cero.`);
      }

      if (!Number.isFinite(costUsd) || costUsd < 0) {
        throw new Error(`El costo del producto #${index + 1} debe ser cero o mayor.`);
      }

      if (!Number.isFinite(salePriceAwg) || salePriceAwg < 0) {
        throw new Error(`La venta AWG del producto #${index + 1} debe ser cero o mayor.`);
      }

      if (!Number.isFinite(productWeightKg) || productWeightKg < 0) {
        throw new Error(`El peso del producto #${index + 1} debe ser cero o mayor.`);
      }

      if (expirationDateValue) {
        const expirationDate = new Date(expirationDateValue);

        if (Number.isNaN(expirationDate.getTime())) {
          throw new Error(`La fecha de caducidad del producto #${index + 1} no es valida.`);
        }
      }

      return { productId, quantity, costUsd, salePriceAwg, expirationDateValue, lotName, productWeightKg };
    });

    // Calculate total quantity across all items for distributing additional expenses
    const totalQuantity = items.reduce((sum, item: (typeof items)[number]) => sum + item.quantity, 0);
    const additionalExpensePerUnitAwg = totalQuantity > 0 ? totalAdditionalExpensesAwg / totalQuantity : 0;
    const additionalExpensePerUnitUsd = usdToAwgRate > 0 ? additionalExpensePerUnitAwg / usdToAwgRate : 0;

    if (new Set(items.map((item: (typeof items)[number]) => {
      const unitCostUsd = item.quantity > 0 ? item.costUsd / item.quantity : item.costUsd;
      const totalUnitCostUsd = unitCostUsd + additionalExpensePerUnitUsd;
      return buildInventoryLotKey(item.productId, item.expirationDateValue, totalUnitCostUsd, item.salePriceAwg);
    })).size !== items.length) {
      response.status(400).json({ message: "No repitas el mismo lote dentro del mismo registro de inventario." });
      return;
    }

    const uniqueProductIds = Array.from(new Set(items.map((item: (typeof items)[number]) => item.productId)));

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

      const normalizedExpirationDate = normalizeOptionalDateValue(item.expirationDateValue);
      const lotName = item.lotName || buildDefaultLotName(normalizedExpirationDate);
      const unitCostUsd = item.quantity > 0 ? item.costUsd / item.quantity : item.costUsd;
      const totalUnitCostUsd = unitCostUsd + additionalExpensePerUnitUsd;
      const existingStockRow = await WarehouseStock.findOne({
        productId: product._id,
        warehouseCode: warehouse.code,
        expirationDate: normalizedExpirationDate,
        unitCostUsd: roundLotPriceValue(totalUnitCostUsd),
        salePriceAwg: roundLotPriceValue(item.salePriceAwg),
      }).lean();

      const currentAvailableUnits = Number(existingStockRow?.availableUnits ?? 0);
      const nextAvailableUnits = currentAvailableUnits + item.quantity;
      const minUnits = Number(existingStockRow?.minUnits ?? product.inventoryAlert ?? 0);

      await WarehouseStock.findOneAndUpdate(
        {
          productId: product._id,
          warehouseCode: warehouse.code,
          expirationDate: normalizedExpirationDate,
          unitCostUsd: roundLotPriceValue(totalUnitCostUsd),
          salePriceAwg: roundLotPriceValue(item.salePriceAwg),
        },
        {
          productId: product._id,
          warehouseCode: warehouse.code,
          expirationDate: normalizedExpirationDate,
          lotName,
          unitCostUsd: roundLotPriceValue(totalUnitCostUsd),
          usdToAwgRate,
          salePriceAwg: roundLotPriceValue(item.salePriceAwg),
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

      await Product.findByIdAndUpdate(product._id, {
        arubaPurchaseCostUsd: totalUnitCostUsd,
        arubaUsdToAwgRate: usdToAwgRate,
        salePrice: item.salePriceAwg,
        productWeightKg: item.productWeightKg,
        expirationDate: item.expirationDateValue ? new Date(item.expirationDateValue) : null,
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
        entryCostUsd: totalUnitCostUsd,
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

async function handleDeleteInventoryEntryGroup(request: Request, response: Response) {
  try {
    const groupId = typeof request.params.groupId === "string" ? request.params.groupId.trim() : "";
    const adjustmentIds = Array.isArray(request.body?.adjustmentIds)
      ? request.body.adjustmentIds
        .filter((value: unknown): value is string => typeof value === "string")
        .map((value: string) => value.trim())
        .filter(Boolean)
      : [];

    if (!groupId && adjustmentIds.length === 0) {
      response.status(400).json({ message: "No fue posible identificar la entrada de inventario a borrar." });
      return;
    }

    let adjustments = await InventoryAdjustment.find({
      source: "inventory-entry",
      ...(groupId ? { entryGroupId: groupId } : {}),
    }).lean();

    if (adjustments.length === 0 && adjustmentIds.length > 0) {
      adjustments = await InventoryAdjustment.find({
        _id: { $in: adjustmentIds },
        source: "inventory-entry",
      }).lean();
    }

    if (adjustments.length === 0) {
      response.status(404).json({ message: "La entrada de inventario ya no existe." });
      return;
    }

    const warehouseCache = new Map<string, { code?: string; name?: string } | null>();
    const removals = new Map<string, {
      productId: string;
      warehouseCode: string;
      warehouseName: string;
      quantity: number;
    }>();

    for (const adjustment of adjustments) {
      const productId = String(adjustment.productId ?? "").trim();
      const quantity = Number(adjustment.quantity ?? 0);
      const warehouseId = String(adjustment.entryWarehouseId ?? "").trim();
      const warehouseName = String(adjustment.entryWarehouseName ?? "").trim();
      const warehouseCacheKey = warehouseId || `name:${warehouseName.toLowerCase()}`;

      if (!productId || !(quantity > 0)) {
        response.status(400).json({ message: "La entrada contiene productos invalidos y no se puede borrar." });
        return;
      }

      if (!warehouseCache.has(warehouseCacheKey)) {
        const warehouse = warehouseId
          ? await Warehouse.findById(warehouseId).lean()
          : warehouseName
            ? await Warehouse.findOne({ name: warehouseName }).lean()
            : null;

        warehouseCache.set(warehouseCacheKey, warehouse);
      }

      const warehouse = warehouseCache.get(warehouseCacheKey);

      if (!warehouse || !warehouse.code) {
        await InventoryAdjustment.updateMany(
          {
            _id: { $in: adjustments.map((adjustment) => adjustment._id) },
          },
          {
            $set: { hiddenFromHistory: true },
          },
        );

        response.json({
          message: "La entrada se oculto del historial porque no tiene bodega identificable para revertir inventario.",
        });
        return;
      }

      const removalKey = `${productId}::${String(warehouse.code)}`;
      const currentRemoval = removals.get(removalKey) ?? {
        productId,
        warehouseCode: String(warehouse.code),
        warehouseName: String(warehouse.name ?? warehouseName),
        quantity: 0,
      };

      currentRemoval.quantity += quantity;
      removals.set(removalKey, currentRemoval);
    }

    const stockRowsByRemovalKey = new Map<string, Array<{
      _id: unknown;
      availableUnits?: number;
      minUnits?: number;
      expirationDate?: Date | string | null;
      createdAt?: Date | string | null;
    }>>();

    for (const [removalKey, removal] of removals.entries()) {
      const stockRows = await WarehouseStock.find({
        productId: removal.productId,
        warehouseCode: removal.warehouseCode,
      }).lean();
      const totalAvailable = stockRows.reduce(
        (sum: number, stockRow: (typeof stockRows)[number]) => sum + Number(stockRow.availableUnits ?? 0),
        0,
      );

      if (totalAvailable < removal.quantity) {
        await InventoryAdjustment.updateMany(
          {
            _id: { $in: adjustments.map((adjustment) => adjustment._id) },
          },
          {
            $set: { hiddenFromHistory: true },
          },
        );

        response.json({
          message: `La entrada se oculto del historial porque ${removal.quantity - totalAvailable} unidad${removal.quantity - totalAvailable === 1 ? "" : "es"} ya fueron consumidas en ${removal.warehouseName}.`,
        });
        return;
      }

      stockRowsByRemovalKey.set(removalKey, stockRows);
    }

    for (const [removalKey, removal] of removals.entries()) {
      const stockRows = stockRowsByRemovalKey.get(removalKey) ?? [];
      let remaining = removal.quantity;

      for (const stockRow of [...stockRows].sort(compareWarehouseStockLotsByConsumptionPriority).reverse()) {
        if (remaining <= 0) {
          break;
        }

        const rowAvailable = Number(stockRow.availableUnits ?? 0);
        const deductedFromRow = Math.min(rowAvailable, remaining);

        if (deductedFromRow <= 0) {
          continue;
        }

        const nextAvailableUnits = rowAvailable - deductedFromRow;
        remaining -= deductedFromRow;

        await WarehouseStock.findByIdAndUpdate(
          stockRow._id,
          {
            availableUnits: nextAvailableUnits,
            status: resolveWarehouseStockStatus(nextAvailableUnits, Number(stockRow.minUnits ?? 0)),
          },
          { runValidators: true },
        );
      }
    }

    await InventoryAdjustment.deleteMany({
      _id: { $in: adjustments.map((adjustment) => adjustment._id) },
    });

    response.json({
      message: `Entrada de inventario borrada correctamente (${adjustments.length} movimiento${adjustments.length === 1 ? "" : "s"}).`,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
}

apiRouter.delete("/management/inventory-entries/:groupId", handleDeleteInventoryEntryGroup);

apiRouter.post("/management/inventory-entries/:groupId/delete", handleDeleteInventoryEntryGroup);

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
    const normalizeExcelDateValue = (value: unknown) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return value.toISOString().slice(0, 10);
      }

      if (typeof value === "number" && Number.isFinite(value) && value > 0) {
        const parsed = XLSX.SSF.parse_date_code(value);

        if (parsed) {
          const parsedDate = new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));

          if (!Number.isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString().slice(0, 10);
          }
        }
      }

      const normalized = normalizeText(value);

      if (!normalized) {
        return "";
      }

      const parsed = new Date(normalized);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
    };
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
      expirationDate: normalizeExcelDateValue(getRowField(row, ["CADUCIDAD", "FECHA_CADUCIDAD", "EXPIRATION_DATE", "expirationDate", "fechaCaducidad"])),
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
        expirationDate: row.expirationDate,
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

apiRouter.post("/management/products/import-excel", async (request, response) => {
  try {
    const fileBase64 = typeof request.body?.fileBase64 === "string" ? request.body.fileBase64.trim() : "";

    if (!fileBase64) {
      response.status(400).json({ message: "Adjunta un archivo Excel valido para importar productos." });
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
    const rawRows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: "" });

    const headerRowIndex = detectImportHeaderRow(rawRows, [
      ["categoria", "category"],
      ["nombre completo del producto/servicio", "producto", "nombre", "product", "product_name"],
      ["precio de venta", "precio_venta", "sale_price", "sale_price_awg"],
      ["tipo contenedor", "tipo_contenedor", "container_type"],
    ]);

    if (headerRowIndex === -1) {
      response.status(400).json({
        message: "No se encontro la fila de encabezados en el Excel. Revisa que la plantilla incluya categoria, nombre, precio de venta y tipo de contenedor.",
      });
      return;
    }

    const rows = mapImportRowsFromSheet(rawRows, headerRowIndex);

    if (rows.length === 0) {
      response.status(400).json({ message: "El Excel no contiene filas para importar." });
      return;
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    let lastCategoryName = "";

    for (const [index, row] of rows.entries()) {
      const name = normalizeImportText(getImportRowField(row, ["nombre completo del producto/servicio", "producto", "nombre", "product", "product_name"])).toUpperCase();
      const derivedSkuBase = normalizeImportText(getImportRowField(row, ["sku", "codigo", "codigo_producto", "product_code"]));
      const categoryName = normalizeImportText(getImportRowField(row, ["categoria", "category"])) || lastCategoryName;
      const supplierName = normalizeImportText(getImportRowField(row, ["proveedor", "supplier"])) || "IMPORTADO SPS ARUBA";
      const sku = (derivedSkuBase || name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]+/gi, "-")
        .replace(/^-+|-+$/g, "")
        .toUpperCase();

      if (!sku || !name) {
        skippedCount += 1;
        continue;
      }

      if (!categoryName) {
        skippedCount += 1;
        continue;
      }

      lastCategoryName = categoryName;

      const category = await ensureImportCategory(categoryName);
      const supplier = await ensureImportSupplier(supplierName);
      const description = normalizeImportText(getImportRowField(row, ["descripcion", "descripción", "description"]));
      const presentationValue = normalizeImportText(getImportRowField(row, ["presentacion", "presentation"])).toLowerCase();
      const containerTypeValue = normalizeImportText(getImportRowField(row, ["tipo contenedor", "tipo_contenedor", "contenedor", "container_type"])).toLowerCase();
      const variableSalePrice = normalizeImportBoolean(getImportRowField(row, ["precio_variable", "variable_sale_price"]), false);
      const salePrice = normalizeImportNumber(getImportRowField(row, ["precio de venta", "precio_venta", "precio_venta_awg", "sale_price", "sale_price_awg"]), 0);

      const payload = {
        sku,
        name,
        category: String(category.name ?? categoryName).trim(),
        supplier: String(supplier.name ?? supplierName).trim(),
        imageUrl: normalizeImportText(getImportRowField(row, ["imagen", "image", "image_url"])),
        cost: normalizeImportNumber(getImportRowField(row, ["costo", "cost", "cost_usd"]), 0),
        arubaPurchaseCostUsd: normalizeImportNumber(getImportRowField(row, ["costo_compra_aruba_usd", "aruba_purchase_cost_usd"]), 0),
        arubaUsdToAwgRate: normalizeImportNumber(getImportRowField(row, ["tasa_usd_awg", "aruba_usd_to_awg_rate"]), 1.79),
        variableSalePrice,
        salePrice: variableSalePrice ? null : salePrice,
        presentation:
          ["kg", "lb", "unidad", "paquete", "caja"].includes(presentationValue)
            ? presentationValue
            : description.toLowerCase().includes("caja")
              ? "caja"
              : "unidad",
        containerType: containerTypeValue === "refrigerado" ? "refrigerado" : "seco",
        shareWithAruba: normalizeImportBoolean(getImportRowField(row, ["compartir_aruba", "share_with_aruba", "aruba"]), true),
        productWeightKg: normalizeImportNumber(getImportRowField(row, ["peso kg", "peso_kg", "peso", "product_weight_kg", "peso (kg)"]), 0),
        displaysPerBox: normalizeImportNumber(getImportRowField(row, ["display", "displays", "displays_por_caja", "displays_per_box"]), 1) || 1,
        unitsPerBox: normalizeImportNumber(getImportRowField(row, ["unidades", "unidades_por_caja", "units_per_box"]), 0),
        unitsPerBoxUnit: ["kg", "lb", "unidad", "paquete"].includes(normalizeImportText(getImportRowField(row, ["unidad_caja", "units_per_box_unit"])).toLowerCase())
          ? normalizeImportText(getImportRowField(row, ["unidad_caja", "units_per_box_unit"])).toLowerCase()
          : "unidad",
        inventoryAlert: normalizeImportNumber(getImportRowField(row, ["alerta inventario", "alerta_inventario", "inventory_alert", "stock_alert"]), 0),
        boxLengthCm: normalizeImportNumber(getImportRowField(row, ["largo", "largo_cm", "box_length_cm", "length_cm"]), 0),
        boxWidthCm: normalizeImportNumber(getImportRowField(row, ["ancho", "ancho_cm", "box_width_cm", "width_cm"]), 0),
        boxHeightCm: normalizeImportNumber(getImportRowField(row, ["alto", "alto_cm", "box_height_cm", "height_cm"]), 0),
        active: normalizeImportBoolean(getImportRowField(row, ["activo", "active"]), true),
      };

      const existingProduct = await Product.findOne({ sku }).lean();

      if (existingProduct) {
        await Product.findByIdAndUpdate(existingProduct._id, payload, { new: true, runValidators: true });
        updatedCount += 1;
      } else {
        await Product.create(payload);
        createdCount += 1;
      }

      if (index === rows.length - 1) {
        continue;
      }
    }

    response.json({
      message: `Importacion completada. ${createdCount} creado(s), ${updatedCount} actualizado(s) y ${skippedCount} omitido(s).`,
      processedCount: rows.length,
      createdCount,
      updatedCount,
      skippedCount,
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

apiRouter.post("/management/ops-clients", async (request, response) => {
  try {
    const payload = await normalizeOperationsClientPayload(request.body);
    const client = await OperationsClient.create({
      code: buildInternalCode("OCL"),
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

apiRouter.put("/management/ops-clients/:id", async (request, response) => {
  try {
    const payload = await normalizeOperationsClientPayload(request.body);
    const client = await OperationsClient.findByIdAndUpdate(request.params.id, payload, {
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

    await removeStoreFromAllRoutes(String(client._id));

    response.json({ message: "Cliente borrado correctamente." });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/ops-clients/:id", async (request, response) => {
  try {
    const client = await OperationsClient.findByIdAndDelete(request.params.id);

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
        stockRowId: item.stockRowId,
        lotName: item.lotName || product.name,
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
    assertTwilioWhatsAppConfigured();

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

    const deliveryResults = await Promise.allSettled(
      payload.clientIds.map(async (clientId) => {
        const client = clientsById.get(clientId);

        if (!client) {
          throw new Error("Cliente no encontrado.");
        }

        const destinationNumber = resolveClientWhatsappNumber(client);

        if (!destinationNumber) {
          throw new Error(`El cliente ${client.name} no tiene un telefono valido para WhatsApp.`);
        }

        const messageBody = renderCatalogWhatsappMessage(payload.message, {
          clientName: client.name,
          catalogName: catalog.name,
          fileName: payload.fileName,
        });

        await sendWhatsAppMessage({
          to: destinationNumber,
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
      const reason = result.reason instanceof Error ? result.reason.message : "Error desconocido";
      return [{
        name: client?.name ?? payload.clientIds[index],
        reason,
      }];
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
      failedClients: failedClients.map((entry) => entry.name),
      failedDetails: failedClients,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/webhooks/twilio/whatsapp", async (request, response) => {
  response.status(200).type("text/plain").send("");

  try {
    assertTwilioWhatsAppConfigured();

    const incomingFrom = typeof request.body?.From === "string"
      ? request.body.From.replace(/^whatsapp:/i, "")
      : "";
    const incomingBody = typeof request.body?.Body === "string" ? request.body.Body.trim() : "";
    const senderNumber = normalizePhoneForWhatsApp(incomingFrom);
    const twilioSenderNumber = normalizePhoneForWhatsApp(env.TWILIO_WHATSAPP_FROM_NUMBER);

    if (!senderNumber || !incomingBody || senderNumber === twilioSenderNumber) {
      return;
    }

    await sendWhatsAppMessage({
      to: senderNumber,
      body: buildInboundWhatsappAutoReplyMessage(),
    });
  } catch (error) {
    console.error("Twilio inbound WhatsApp webhook failed", error);
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
    void notifyRouteAssigned(route);
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
    void notifyRouteAssigned(route);
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
        expirationDate: normalizeOptionalDateValue(row.expirationDate)?.toISOString().slice(0, 10) ?? "",
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
    const invoiceClientId = typeof request.body?.clientId === "string" ? request.body.clientId.trim() : "";
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

    if (!invoiceClientId) {
      response.status(400).json({ message: "Selecciona el cliente de la factura antes de guardar." });
      return;
    }

    if (rawRows.length === 0) {
      response.status(400).json({ message: "La factura no contiene productos para guardar." });
      return;
    }

    const [batchRows, invoiceClient] = await Promise.all([
      ImportCost.find({ containerReference, active: { $ne: false } }).lean(),
      OperationsClient.findById(invoiceClientId).lean(),
    ]);

    if (batchRows.length === 0) {
      response.status(404).json({ message: "El lote de exportacion no existe." });
      return;
    }

    if (!invoiceClient) {
      response.status(404).json({ message: "El cliente seleccionado para la factura ya no existe." });
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
              invoiceClientId,
              invoiceClientCode: String(invoiceClient.code ?? ""),
              invoiceClientName: String(invoiceClient.name ?? ""),
              invoiceClientManagerName: String(invoiceClient.managerName ?? ""),
              invoiceClientEmail: String(invoiceClient.email ?? ""),
              invoiceClientPhone: String(invoiceClient.phone ?? ""),
              invoiceClientAddress: String(invoiceClient.address ?? ""),
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
    const normalizedGiftItems = (order.giftItems ?? []).flatMap((item) => {
      const productId = String(item.productId ?? "").trim();
      const quantity = Number(item.quantity ?? 0);

      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        return [];
      }

      const product = productsById.get(productId);
      const arubaPurchaseCostUsd = Number(product?.arubaPurchaseCostUsd ?? 0);
      const arubaUsdToAwgRate = Number(product?.arubaUsdToAwgRate ?? 1.79);
      const arubaCostAwg = arubaPurchaseCostUsd * arubaUsdToAwgRate;
      const fallbackCostAwg = Number(latestCostMap.get(productId) ?? Number(product?.cost ?? 0));
      const unitCostAwg = Math.max(0, arubaCostAwg > 0 ? arubaCostAwg : (Number.isFinite(fallbackCostAwg) ? fallbackCostAwg : 0));

      return [{
        productId,
        productName: String(product?.name ?? "Producto"),
        productSku: String(product?.sku ?? "-"),
        quantity,
        salePriceAwg: 0,
        lineTotalAwg: 0,
        unitCostAwg,
        lineUtilityAwg: -unitCostAwg * quantity,
      }];
    });
    const normalizedItems = [
      ...(order.items ?? []).flatMap((item) => {
      const productId = String(item.productId ?? "").trim();
      const quantity = Number(item.quantity ?? 0);

      if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
        return [];
      }

      const product = productsById.get(productId);
      const clientSalePriceKey = storeId ? `${storeId}:${productId}` : "";
      const catalogSalePrice = clientSalePriceKey ? Number(clientProductSalePriceMap.get(clientSalePriceKey) ?? NaN) : NaN;
      const baseSalePrice = Number(product?.salePrice ?? 0);
      const fallbackSalePrice = Math.max(0, Number.isFinite(catalogSalePrice) ? catalogSalePrice : baseSalePrice);
      const salePriceAwg = resolveFrozenOrderItemSalePrice(item, fallbackSalePrice);
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
    }),
      ...normalizedGiftItems,
    ];

    if (normalizedItems.length === 0) {
      return;
    }

    const existingInvoice = await LogisticsInvoice.findOne({ orderId })
      .select({ active: 1, syncExcluded: 1 })
      .lean();

    if (existingInvoice?.syncExcluded || existingInvoice) {
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

apiRouter.get("/warehouse/cartera/pending-credit", async (request, response) => {
  const storeId = typeof request.query.storeId === "string" ? request.query.storeId.trim() : "";

  if (!storeId) {
    response.status(400).json({ message: "Indica el cliente para consultar su credito pendiente." });
    return;
  }

  await cleanupOrphanCarteraEntries();

  const entries = await CarteraEntry.find({
    storeId,
    active: { $ne: false },
    paymentMethod: "credito",
    outstandingAmountAwg: { $gt: 0 },
  })
    .sort({ invoicedAt: 1, createdAt: 1 })
    .lean();

  response.json(entries.map((entry) => mapCarteraEntryRecord(entry)));
});

apiRouter.get("/management/cartera", async (request, response) => {
  const storeIdFilter = typeof request.query.storeId === "string" ? request.query.storeId.trim() : "";
  const { startDate, endDate, collectionStartDate, collectionEndDate } = resolveCarteraDateRangeFilters(request.query);
  const collectionPaymentMethodFilter = typeof request.query.collectionPaymentMethod === "string"
    ? request.query.collectionPaymentMethod.trim().toLowerCase()
    : "";
  const filters: Record<string, unknown> = { active: { $ne: false } };
  const collectionFilters: Record<string, unknown> = { active: { $ne: false } };

  await syncDeliveredOrdersIntoCartera();
  await cleanupOrphanCarteraEntries();

  if (storeIdFilter) {
    filters.storeId = storeIdFilter;
    collectionFilters.storeId = storeIdFilter;
  }

  if (carteraCollectionPaymentMethods.has(collectionPaymentMethodFilter)) {
    collectionFilters.paymentMethod = collectionPaymentMethodFilter;
  }

  const invoicedAtDateFilter = buildBusinessDateRangeMongoFilter("invoicedAt", startDate, endDate);
  const collectedAtDateFilter = buildBusinessDateRangeMongoFilter("collectedAt", collectionStartDate, collectionEndDate);

  if (invoicedAtDateFilter) {
    Object.assign(filters, invoicedAtDateFilter);
  }

  if (collectedAtDateFilter) {
    Object.assign(collectionFilters, collectedAtDateFilter);
  }

  const [entries, collections, summary, overdueEntries] = await Promise.all([
    CarteraEntry.find(filters).sort({ invoicedAt: -1, createdAt: -1 }).lean(),
    CarteraCollection.find(collectionFilters).sort({ collectedAt: -1, createdAt: -1 }).lean(),
    buildCarteraSummary(),
    fetchOverdueCarteraEntries(),
  ]);

  response.json({
    summary,
    overdueEntries,
    entries: entries.map((entry) => mapCarteraEntryRecord(entry)),
    collections: collections.map((collection) => ({
      _id: String(collection._id),
      carteraEntryId: String(collection.carteraEntryId ?? ""),
      storeId: String(collection.storeId ?? ""),
      storeName: String(collection.storeName ?? ""),
      relatedOrderId: String(collection.relatedOrderId ?? ""),
      amountAwg: Number(collection.amountAwg ?? 0),
      paymentMethod: String(collection.paymentMethod ?? ""),
      collectedAt: collection.collectedAt,
      salesRepId: String(collection.salesRepId ?? ""),
      salesRepName: String(collection.salesRepName ?? ""),
      notes: String(collection.notes ?? ""),
      createdAt: collection.createdAt,
      updatedAt: collection.updatedAt,
    })),
  });
});

apiRouter.post("/management/cartera/entries/:id/collect", async (request, response) => {
  try {
    const entry = await CarteraEntry.findById(request.params.id).lean();

    if (!entry || entry.active === false) {
      response.status(404).json({ message: "La factura no existe." });
      return;
    }

    const amountAwg = normalizeCarteraInvoiceAmount(request.body?.amountAwg);
    const paymentMethod = normalizeCarteraCollectionPaymentMethod(request.body?.paymentMethod);
    const collectedAtValue = typeof request.body?.collectedAt === "string" ? request.body.collectedAt.trim() : "";
    const collectedAt = collectedAtValue ? new Date(`${collectedAtValue}T12:00:00`) : new Date();

    if (Number.isNaN(collectedAt.getTime())) {
      throw new Error("La fecha de recaudo no es valida.");
    }

    if (amountAwg <= 0) {
      throw new Error("Indica un monto de recaudo valido.");
    }

    const outstandingAmountAwg = Number(entry.outstandingAmountAwg ?? 0);

    if (amountAwg > outstandingAmountAwg + 0.009) {
      throw new Error("El monto supera el saldo pendiente de la factura.");
    }

    await applyCreditCollections([{
      carteraEntryId: String(entry._id),
      amountAwg,
      paymentMethod,
    }], {
      storeId: String(entry.storeId ?? ""),
      storeName: String(entry.storeName ?? ""),
      relatedOrderId: "",
      salesRepId: "",
      salesRepName: "",
      collectedAt,
      notes: "Recaudo registrado desde cartera.",
    });

    const updatedEntry = await CarteraEntry.findById(entry._id).lean();

    response.json({
      message: "Recaudo registrado correctamente.",
      entry: updatedEntry ? mapCarteraEntryRecord(updatedEntry) : null,
    });
  } catch (error) {
    sendCreationError(response, error);
  }
});

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
      { active: false, syncExcluded: true },
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

apiRouter.get("/management/import-templates", async (request, response) => {
  try {
    const userId = typeof request.query.userId === "string" ? request.query.userId : "";

    if (!userId) {
      response.status(400).json({ message: "userId is required" });
      return;
    }

    const templates = await ImportTemplate.find({ userId }).lean();
    response.json(templates);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.post("/management/import-templates", async (request, response) => {
  try {
    const userId = typeof request.body.userId === "string" ? request.body.userId : "";
    const name = typeof request.body.name === "string" ? request.body.name.trim() : "";

    if (!userId || !name) {
      response.status(400).json({ message: "userId and name are required" });
      return;
    }

    const template = new ImportTemplate({
      userId,
      name,
      containerType: request.body.containerType,
      containerSize: request.body.containerSize,
      measurementUnit: request.body.measurementUnit,
      notes: request.body.notes || "",
      expenseItems: request.body.expenseItems || [],
      products: request.body.products || [],
    });

    await template.save();
    response.status(201).json(template.toObject());
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.put("/management/import-templates/:id", async (request, response) => {
  try {
    const userId = typeof request.body.userId === "string" ? request.body.userId : "";

    if (!userId) {
      response.status(400).json({ message: "userId is required" });
      return;
    }

    const template = await ImportTemplate.findOneAndUpdate(
      { _id: request.params.id, userId },
      {
        name: request.body.name,
        containerType: request.body.containerType,
        containerSize: request.body.containerSize,
        measurementUnit: request.body.measurementUnit,
        notes: request.body.notes,
        expenseItems: request.body.expenseItems,
        products: request.body.products,
      },
      { new: true, runValidators: true },
    ).lean();

    if (!template) {
      response.status(404).json({ message: "Template not found" });
      return;
    }

    response.json(template);
  } catch (error) {
    sendCreationError(response, error);
  }
});

apiRouter.delete("/management/import-templates/:id", async (request, response) => {
  try {
    const userId = typeof request.query.userId === "string" ? request.query.userId : "";

    if (!userId) {
      response.status(400).json({ message: "userId is required" });
      return;
    }

    const template = await ImportTemplate.findOneAndDelete({ _id: request.params.id, userId });

    if (!template) {
      response.status(404).json({ message: "Template not found" });
      return;
    }

    response.json({ message: "Template deleted successfully" });
  } catch (error) {
    sendCreationError(response, error);
  }
});
