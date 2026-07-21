import { Product } from "../modules/catalog/product.model.js";
import { InventoryAdjustment } from "../modules/inventory/inventory-adjustment.model.js";
import { formatQuickBooksCsvHeaderRow, formatQuickBooksCsvRow, joinQuickBooksCsvRows, } from "./quickbooks-csv.js";
const BUSINESS_TIMEZONE = "America/Aruba";
const BILL_DUE_DAYS = 30;
const CSV_HEADERS = [
    "*BillNo",
    "*Supplier",
    "*BillDate",
    "*DueDate",
    "Terms",
    "Location",
    "Memo",
    "*Account",
    "LineDescription",
    "*LineAmount",
];
const DEFAULT_INVENTORY_ACCOUNT = "Inventory";
function getBusinessDateKey(date) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: BUSINESS_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(date);
}
function parseBusinessDateKey(value) {
    return new Date(`${value}T12:00:00`);
}
function isValidDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
function addDaysToDateKey(dateKey, days) {
    const parsed = parseBusinessDateKey(dateKey);
    parsed.setDate(parsed.getDate() + days);
    return getBusinessDateKey(parsed);
}
function resolveDefaultDateRange() {
    const endDate = getBusinessDateKey(new Date());
    const startDate = `${endDate.slice(0, 7)}-01`;
    return { startDate, endDate };
}
function formatQuickBooksDate(dateKey) {
    const [year, month, day] = dateKey.split("-");
    return `${day}/${month}/${year}`;
}
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function resolveAdjustmentDateKey(adjustment) {
    if (adjustment.createdAt) {
        const createdAt = adjustment.createdAt instanceof Date
            ? adjustment.createdAt
            : new Date(adjustment.createdAt);
        if (!Number.isNaN(createdAt.getTime())) {
            return getBusinessDateKey(createdAt);
        }
    }
    return getBusinessDateKey(new Date());
}
function resolveGroupSupplier(items) {
    const supplierCounts = new Map();
    for (const item of items) {
        const supplier = item.supplier.trim() || "Proveedor general";
        supplierCounts.set(supplier, (supplierCounts.get(supplier) ?? 0) + 1);
    }
    if (supplierCounts.size === 0) {
        return "Proveedor general";
    }
    if (supplierCounts.size === 1) {
        return Array.from(supplierCounts.keys())[0] ?? "Proveedor general";
    }
    const dominantSupplier = Array.from(supplierCounts.entries())
        .sort((left, right) => right[1] - left[1])[0]?.[0];
    return dominantSupplier ?? "Varios proveedores";
}
function buildEntryGroups(adjustments, productsById) {
    const groups = new Map();
    for (const adjustment of adjustments) {
        const source = String(adjustment.source ?? "");
        if (source !== "inventory-entry") {
            continue;
        }
        const groupId = String(adjustment.entryGroupId ?? "").trim();
        if (!groupId) {
            continue;
        }
        const product = productsById.get(String(adjustment.productId ?? ""));
        const productId = String(adjustment.productId ?? "");
        const quantity = Number(adjustment.quantity ?? 0);
        const unitCostUsd = Number(adjustment.entryCostUsd ?? 0) > 0
            ? Number(adjustment.entryCostUsd)
            : Number(product?.arubaPurchaseCostUsd ?? 0);
        const usdToAwgRate = Number(adjustment.entryUsdToAwgRate ?? 0) > 0
            ? Number(adjustment.entryUsdToAwgRate)
            : Number(product?.arubaUsdToAwgRate ?? 1.79);
        const createdAt = String(adjustment.createdAt ?? new Date().toISOString());
        const current = groups.get(groupId) ?? {
            id: groupId,
            createdAt,
            warehouseName: String(adjustment.entryWarehouseName ?? "").trim(),
            usdToAwgRate,
            items: [],
        };
        current.items.push({
            productId,
            productName: String(product?.name ?? "Producto"),
            productSku: String(product?.sku ?? ""),
            supplier: String(product?.supplier ?? ""),
            quantity,
            unitCostUsd,
        });
        if (String(createdAt).localeCompare(String(current.createdAt)) > 0) {
            current.createdAt = createdAt;
        }
        if (!current.warehouseName && adjustment.entryWarehouseName) {
            current.warehouseName = String(adjustment.entryWarehouseName);
        }
        if (!(current.usdToAwgRate > 0) && usdToAwgRate > 0) {
            current.usdToAwgRate = usdToAwgRate;
        }
        groups.set(groupId, current);
    }
    return Array.from(groups.values())
        .sort((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)));
}
export async function buildQuickBooksBillExportCsv(params) {
    const defaults = resolveDefaultDateRange();
    const startDate = isValidDateKey(params.startDate ?? "") ? String(params.startDate) : defaults.startDate;
    const endDate = isValidDateKey(params.endDate ?? "") ? String(params.endDate) : defaults.endDate;
    const groupId = typeof params.groupId === "string" ? params.groupId.trim() : "";
    const adjustments = await InventoryAdjustment.find({
        source: "inventory-entry",
        hiddenFromHistory: { $ne: true },
        ...(groupId ? { entryGroupId: groupId } : { entryGroupId: { $ne: "" } }),
    }).sort({ createdAt: 1 }).lean();
    const productIds = Array.from(new Set(adjustments.map((adjustment) => String(adjustment.productId ?? "")).filter(Boolean)));
    const products = productIds.length > 0
        ? await Product.find({ _id: { $in: productIds } }).select({
            _id: 1,
            name: 1,
            sku: 1,
            supplier: 1,
            arubaPurchaseCostUsd: 1,
            arubaUsdToAwgRate: 1,
        }).lean()
        : [];
    const productsById = new Map(products.map((product) => [String(product._id), product]));
    const entryGroups = buildEntryGroups(adjustments, productsById);
    const filteredGroups = entryGroups.filter((group) => {
        const billDateKey = resolveAdjustmentDateKey({ createdAt: group.createdAt });
        return billDateKey >= startDate && billDateKey <= endDate;
    });
    if (filteredGroups.length === 0) {
        return {
            csv: joinQuickBooksCsvRows([formatQuickBooksCsvHeaderRow(CSV_HEADERS)]),
            fileName: groupId
                ? `quickbooks-factura-proveedor-${groupId}.csv`
                : `quickbooks-facturas-proveedor-${startDate}-a-${endDate}.csv`,
            billCount: 0,
            lineCount: 0,
        };
    }
    const rows = [formatQuickBooksCsvHeaderRow(CSV_HEADERS)];
    let lineCount = 0;
    filteredGroups.forEach((group, groupIndex) => {
        const billDateKey = resolveAdjustmentDateKey({ createdAt: group.createdAt });
        const dueDateKey = addDaysToDateKey(billDateKey, BILL_DUE_DAYS);
        const billNumber = groupIndex + 1;
        const supplier = resolveGroupSupplier(group.items);
        const location = group.warehouseName || "";
        const memo = `Entrada inventario - ${group.items.length} producto${group.items.length === 1 ? "" : "s"}`;
        group.items.forEach((item, index) => {
            const isFirstLine = index === 0;
            const lineAmount = roundMoney(Number(item.quantity ?? 0) * Number(item.unitCostUsd ?? 0));
            const description = item.productSku
                ? `${item.productName} (${item.productSku})`
                : item.productName;
            rows.push(formatQuickBooksCsvRow([
                isFirstLine ? billNumber : "",
                isFirstLine ? supplier : "",
                isFirstLine ? formatQuickBooksDate(billDateKey) : "",
                isFirstLine ? formatQuickBooksDate(dueDateKey) : "",
                isFirstLine ? "Net 30" : "",
                isFirstLine ? location : "",
                isFirstLine ? memo : "",
                DEFAULT_INVENTORY_ACCOUNT,
                description,
                lineAmount,
            ]));
            lineCount += 1;
        });
    });
    return {
        csv: joinQuickBooksCsvRows(rows),
        fileName: groupId
            ? `quickbooks-factura-proveedor-${groupId}.csv`
            : `quickbooks-facturas-proveedor-${startDate}-a-${endDate}.csv`,
        billCount: filteredGroups.length,
        lineCount,
    };
}
//# sourceMappingURL=quickbooks-bill-export.service.js.map