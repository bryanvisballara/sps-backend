import { CarteraEntry } from "../modules/accounting/cartera-entry.model.js";
import { LogisticsInvoice } from "../modules/accounting/logistics-invoice.model.js";
import { Product } from "../modules/catalog/product.model.js";
import { Order } from "../modules/orders/order.model.js";

const BUSINESS_TIMEZONE = "America/Aruba";
const CREDIT_DUE_DAYS = 30;

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

function escapeCsvField(value: string | number) {
  const normalized = String(value ?? "");

  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }

  return normalized;
}

function formatCsvRow(values: Array<string | number>) {
  return values.map((value) => escapeCsvField(value)).join(",");
}

function resolvePaymentTerms(paymentMethod: string) {
  if (paymentMethod === "credito") {
    return "Net 30";
  }

  return "Due on receipt";
}

function resolveDueDateKey(invoiceDateKey: string, paymentMethod: string) {
  if (paymentMethod === "credito") {
    return addDaysToDateKey(invoiceDateKey, CREDIT_DUE_DAYS);
  }

  return invoiceDateKey;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

type ExportLineItem = {
  productName: string;
  productSku: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  serviceDateKey: string;
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
      csv: `${CSV_HEADERS.join(",")}\n`,
      fileName: `quickbooks-facturas-${startDate}-a-${endDate}.csv`,
      invoiceCount: 0,
      lineCount: 0,
    };
  }

  const orderIds = filteredOrders.map((order) => String(order._id));
  const [carteraEntries, logisticsInvoices] = await Promise.all([
    CarteraEntry.find({ orderId: { $in: orderIds }, active: { $ne: false } }).lean(),
    LogisticsInvoice.find({ orderId: { $in: orderIds }, active: { $ne: false }, syncExcluded: { $ne: true } }).lean(),
  ]);

  const carteraByOrderId = new Map(carteraEntries.map((entry) => [String(entry.orderId), entry]));
  const logisticsByOrderId = new Map(logisticsInvoices.map((invoice) => [String(invoice.orderId ?? ""), invoice]));

  const productIds = Array.from(new Set(
    filteredOrders.flatMap((order) => [
      ...(order.items ?? []).map((item) => String(item.productId ?? "")),
      ...(order.giftItems ?? []).map((item) => String(item.productId ?? "")),
    ].filter(Boolean)),
  ));

  const products = productIds.length > 0
    ? await Product.find({ _id: { $in: productIds } }).select({ _id: 1, name: 1, sku: 1, description: 1 }).lean()
    : [];
  const productsById = new Map(products.map((product) => [String(product._id), product]));

  const rows: string[] = [CSV_HEADERS.join(",")];
  let lineCount = 0;

  for (const order of filteredOrders) {
    const orderId = String(order._id);
    const carteraEntry = carteraByOrderId.get(orderId);
    const logisticsInvoice = logisticsByOrderId.get(orderId);
    const invoiceDateKey = carteraEntry?.invoicedAt
      ? getBusinessDateKey(new Date(carteraEntry.invoicedAt))
      : resolveOrderInvoiceDateKey(order);
    const serviceDateKey = resolveOrderInvoiceDateKey(order);
    const paymentMethod = String(carteraEntry?.paymentMethod ?? "credito");
    const invoiceNumber = Number(carteraEntry?.invoiceNumber ?? order.invoiceNumber ?? 0) || orderId.slice(-6);
    const customerName = String(order.storeName ?? "Cliente");
    const terms = resolvePaymentTerms(paymentMethod);
    const dueDateKey = resolveDueDateKey(invoiceDateKey, paymentMethod);
    const location = String(order.deliveryZone ?? "");
    const memoParts = [
      String(order.routeName ?? "").trim(),
      String(order.salesRepName ?? "").trim(),
      String(order.orderNotes ?? "").trim(),
    ].filter(Boolean);
    const memo = memoParts.join(" · ");

    const lineItems: ExportLineItem[] = logisticsInvoice?.items?.length
      ? logisticsInvoice.items.map((item) => ({
        productName: String(item.productName ?? "Producto"),
        productSku: String(item.productSku ?? "-"),
        description: String(item.productName ?? ""),
        quantity: Number(item.quantity ?? 0),
        rate: roundMoney(Number(item.salePriceAwg ?? 0)),
        amount: roundMoney(Number(item.lineTotalAwg ?? 0)),
        serviceDateKey,
      }))
      : [
        ...(order.items ?? []).flatMap((item) => {
          const quantity = Number(item.quantity ?? 0);

          if (!Number.isFinite(quantity) || quantity <= 0) {
            return [];
          }

          const product = productsById.get(String(item.productId ?? ""));
          const rate = roundMoney(Number(item.salePriceAwg ?? 0));

          return [{
            productName: String(product?.name ?? "Producto"),
            productSku: String(product?.sku ?? "-"),
            description: String(product?.description ?? product?.name ?? item.notes ?? ""),
            quantity,
            rate,
            amount: roundMoney(rate * quantity),
            serviceDateKey,
          }];
        }),
        ...(order.giftItems ?? []).flatMap((item) => {
          const quantity = Number(item.quantity ?? 0);

          if (!Number.isFinite(quantity) || quantity <= 0) {
            return [];
          }

          const product = productsById.get(String(item.productId ?? ""));

          return [{
            productName: String(product?.name ?? "Obsequio"),
            productSku: String(product?.sku ?? "-"),
            description: String(item.notes ?? product?.description ?? "Obsequio"),
            quantity,
            rate: 0,
            amount: 0,
            serviceDateKey,
          }];
        }),
      ];

    if (lineItems.length === 0) {
      continue;
    }

    lineItems.forEach((lineItem) => {
      rows.push(formatCsvRow([
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
        formatQuickBooksDate(lineItem.serviceDateKey),
      ]));
      lineCount += 1;
    });
  }

  return {
    csv: `${rows.join("\n")}\n`,
    fileName: `quickbooks-facturas-${startDate}-a-${endDate}.csv`,
    invoiceCount: filteredOrders.length,
    lineCount,
  };
}
