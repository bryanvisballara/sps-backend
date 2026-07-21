import { CarteraEntry } from "../modules/accounting/cartera-entry.model.js";
import { LogisticsInvoice } from "../modules/accounting/logistics-invoice.model.js";
import { Product } from "../modules/catalog/product.model.js";
import { Order } from "../modules/orders/order.model.js";
import { Store } from "../modules/stores/store.model.js";
import {
  formatQuickBooksCsvHeaderRow,
  formatQuickBooksCsvRow,
  joinQuickBooksCsvRows,
} from "./quickbooks-csv.js";
import {
  normalizeQuickBooksPaymentTerm,
  resolveDueDateKeyForPaymentTerm,
} from "./quickbooks-payment-terms.js";

const BUSINESS_TIMEZONE = "America/Aruba";

const CSV_HEADERS = [
  "*InvoiceNo",
  "*Customer",
  "*InvoiceDate",
  "*DueDate",
  "Terms",
  "Location",
  "Memo",
  "Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "*ItemAmount",
  "*ItemTaxCode",
  "ItemTaxAmount",
  "Service Date",
] as const;

function getBusinessDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseBusinessDateKey(value: string) {
  return new Date(`${value}T12:00:00`);
}

function isValidDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDaysToDateKey(dateKey: string, days: number) {
  const parsed = parseBusinessDateKey(dateKey);
  parsed.setDate(parsed.getDate() + days);
  return getBusinessDateKey(parsed);
}

function resolveDefaultDateRange() {
  const endDate = getBusinessDateKey(new Date());
  const startDate = `${endDate.slice(0, 7)}-01`;
  return { startDate, endDate };
}

function resolveOrderInvoiceDateKey(order: {
  deliveryDate?: Date | string;
  updatedAt?: Date | string;
  createdAt?: Date | string;
}) {
  if (order.deliveryDate) {
    const delivery = order.deliveryDate instanceof Date ? order.deliveryDate : new Date(order.deliveryDate);

    if (!Number.isNaN(delivery.getTime())) {
      return getBusinessDateKey(delivery);
    }
  }

  if (order.updatedAt) {
    const updatedAt = order.updatedAt instanceof Date ? order.updatedAt : new Date(order.updatedAt);

    if (!Number.isNaN(updatedAt.getTime())) {
      return getBusinessDateKey(updatedAt);
    }
  }

  if (order.createdAt) {
    const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(order.createdAt);

    if (!Number.isNaN(createdAt.getTime())) {
      return getBusinessDateKey(createdAt);
    }
  }

  return getBusinessDateKey(new Date());
}

function formatQuickBooksDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-");
  return `${day}/${month}/${year}`;
}

function resolvePaymentTerms(params: {
  storePaymentTerm?: string;
  paymentMethod?: string;
}) {
  if (params.storePaymentTerm) {
    return normalizeQuickBooksPaymentTerm(params.storePaymentTerm);
  }

  return normalizeQuickBooksPaymentTerm(params.paymentMethod);
}

function resolveDueDateKey(invoiceDateKey: string, paymentTerm: string) {
  return resolveDueDateKeyForPaymentTerm(invoiceDateKey, paymentTerm, addDaysToDateKey);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeSku(value: string) {
  return String(value ?? "").trim().toUpperCase();
}

function resolveQuickBooksItemName(product: {
  quickbooksName?: string | null;
  name?: string | null;
} | null | undefined, fallbackName = "Producto") {
  const quickbooksName = String(product?.quickbooksName ?? "").trim();

  if (quickbooksName) {
    return quickbooksName;
  }

  const productName = String(product?.name ?? "").trim();

  if (productName) {
    return productName;
  }

  const fallback = String(fallbackName ?? "").trim();
  return fallback || "Producto";
}

function resolveQuickBooksItemDescription(product: {
  description?: string | null;
  name?: string | null;
} | null | undefined, fallback = "") {
  const description = String(product?.description ?? "").trim();

  if (description) {
    return description;
  }

  const fallbackText = String(fallback ?? "").trim();
  return fallbackText;
}

type ExportLineItem = {
  productName: string;
  productSku: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export async function buildQuickBooksInvoiceExportCsv(params: {
  startDate?: string;
  endDate?: string;
}) {
  const defaults = resolveDefaultDateRange();
  const startDate = isValidDateKey(params.startDate ?? "") ? String(params.startDate) : defaults.startDate;
  const endDate = isValidDateKey(params.endDate ?? "") ? String(params.endDate) : defaults.endDate;

  const deliveredOrders = await Order.find({ status: "delivered" })
    .sort({ deliveryDate: 1, updatedAt: 1 })
    .lean();

  const filteredOrders = deliveredOrders.filter((order) => {
    const invoiceDateKey = resolveOrderInvoiceDateKey(order);
    return invoiceDateKey >= startDate && invoiceDateKey <= endDate;
  });

  if (filteredOrders.length === 0) {
    return {
      csv: joinQuickBooksCsvRows([formatQuickBooksCsvHeaderRow(CSV_HEADERS)]),
      fileName: `quickbooks-facturas-${startDate}-a-${endDate}.csv`,
      invoiceCount: 0,
      lineCount: 0,
    };
  }

  const orderIds = filteredOrders.map((order) => String(order._id));
  const storeIds = Array.from(new Set(filteredOrders.map((order) => String(order.storeId ?? "")).filter(Boolean)));
  const [carteraEntries, logisticsInvoices, stores] = await Promise.all([
    CarteraEntry.find({ orderId: { $in: orderIds }, active: { $ne: false } }).lean(),
    LogisticsInvoice.find({ orderId: { $in: orderIds }, active: { $ne: false }, syncExcluded: { $ne: true } }).lean(),
    storeIds.length > 0
      ? Store.find({ _id: { $in: storeIds } }).select({ _id: 1, defaultPaymentMethod: 1 }).lean()
      : Promise.resolve([]),
  ]);

  const carteraByOrderId = new Map(carteraEntries.map((entry) => [String(entry.orderId), entry]));
  const logisticsByOrderId = new Map(logisticsInvoices.map((invoice) => [String(invoice.orderId ?? ""), invoice]));
  const storesById = new Map(stores.map((store) => [String(store._id), store]));

  const productIds = Array.from(new Set(
    filteredOrders.flatMap((order) => {
      const logisticsInvoice = logisticsByOrderId.get(String(order._id));

      return [
        ...(order.items ?? []).map((item) => String(item.productId ?? "")),
        ...(order.giftItems ?? []).map((item) => String(item.productId ?? "")),
        ...(logisticsInvoice?.items ?? []).map((item) => String(item.productId ?? "")),
      ].filter(Boolean);
    }),
  ));

  const products = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1, description: 1, quickbooksName: 1 }).lean()
    : [];
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  const productsBySku = new Map(
    products
      .map((product) => [normalizeSku(String(product.sku ?? "")), product] as const)
      .filter(([sku]) => Boolean(sku)),
  );

  const rows: string[] = [formatQuickBooksCsvHeaderRow(CSV_HEADERS)];
  let lineCount = 0;

  for (const order of filteredOrders) {
    const orderId = String(order._id);
    const carteraEntry = carteraByOrderId.get(orderId);
    const logisticsInvoice = logisticsByOrderId.get(orderId);
    const invoiceDateKey = carteraEntry?.invoicedAt
      ? getBusinessDateKey(new Date(carteraEntry.invoicedAt))
      : resolveOrderInvoiceDateKey(order);
    const paymentMethod = String(carteraEntry?.paymentMethod ?? "credito");
    const invoiceNumber = Number(carteraEntry?.invoiceNumber ?? order.invoiceNumber ?? 0) || orderId.slice(-6);
    const customerName = String(order.storeName ?? "Cliente");
    const store = storesById.get(String(order.storeId ?? ""));
    const terms = resolvePaymentTerms({
      storePaymentTerm: store?.defaultPaymentMethod,
      paymentMethod,
    });
    const dueDateKey = resolveDueDateKey(invoiceDateKey, terms);
    const location = String(order.deliveryZone ?? "");
    const memoParts = [
      String(order.routeName ?? "").trim(),
      String(order.salesRepName ?? "").trim(),
      String(order.orderNotes ?? "").trim(),
    ].filter(Boolean);
    const memo = memoParts.join(" - ");

    const resolveProduct = (productId?: string, productSku?: string) => (
      productsById.get(String(productId ?? ""))
      ?? productsBySku.get(normalizeSku(String(productSku ?? "")))
      ?? null
    );

    const lineItems: ExportLineItem[] = logisticsInvoice?.items?.length
      ? logisticsInvoice.items.map((item) => {
        const product = resolveProduct(item.productId, item.productSku);
        const productName = resolveQuickBooksItemName(product, String(item.productName ?? "Producto"));

        return {
          productName,
          productSku: String(item.productSku ?? product?.sku ?? "-"),
          description: resolveQuickBooksItemDescription(product),
          quantity: Number(item.quantity ?? 0),
          rate: roundMoney(Number(item.salePriceAwg ?? 0)),
          amount: roundMoney(Number(item.lineTotalAwg ?? 0)),
        };
      })
      : [
        ...(order.items ?? []).flatMap((item) => {
          const quantity = Number(item.quantity ?? 0);

          if (!Number.isFinite(quantity) || quantity <= 0) {
            return [];
          }

          const product = resolveProduct(String(item.productId ?? ""));
          const rate = roundMoney(Number(item.salePriceAwg ?? 0));
          const productName = resolveQuickBooksItemName(product, "Producto");

          return [{
            productName,
            productSku: String(product?.sku ?? "-"),
            description: resolveQuickBooksItemDescription(product, String(item.notes ?? "")),
            quantity,
            rate,
            amount: roundMoney(rate * quantity),
          }];
        }),
        ...(order.giftItems ?? []).flatMap((item) => {
          const quantity = Number(item.quantity ?? 0);

          if (!Number.isFinite(quantity) || quantity <= 0) {
            return [];
          }

          const product = resolveProduct(String(item.productId ?? ""));
          const productName = resolveQuickBooksItemName(product, "Obsequio");

          return [{
            productName,
            productSku: String(product?.sku ?? "-"),
            description: resolveQuickBooksItemDescription(product, String(item.notes ?? "Obsequio")),
            quantity,
            rate: 0,
            amount: 0,
          }];
        }),
      ];

    if (lineItems.length === 0) {
      continue;
    }

    lineItems.forEach((lineItem) => {
      rows.push(formatQuickBooksCsvRow([
        invoiceNumber,
        customerName,
        formatQuickBooksDate(invoiceDateKey),
        formatQuickBooksDate(dueDateKey),
        terms,
        location,
        memo,
        lineItem.productName,
        lineItem.description,
        lineItem.quantity,
        lineItem.rate,
        lineItem.amount,
        "Exempt",
        0,
        "",
      ]));
      lineCount += 1;
    });
  }

  return {
    csv: joinQuickBooksCsvRows(rows),
    fileName: `quickbooks-facturas-${startDate}-a-${endDate}.csv`,
    invoiceCount: filteredOrders.length,
    lineCount,
  };
}
