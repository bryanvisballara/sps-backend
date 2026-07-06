import { CarteraCollection } from "../modules/accounting/cartera-collection.model.js";
import { CarteraEntry } from "../modules/accounting/cartera-entry.model.js";
import { LogisticsExpense } from "../modules/accounting/logistics-expense.model.js";
import { LogisticsFixedCost } from "../modules/accounting/logistics-fixed-cost.model.js";
import { LogisticsInvoice } from "../modules/accounting/logistics-invoice.model.js";
import { WarehouseStock } from "../modules/inventory/warehouse-stock.model.js";
const BUSINESS_TIMEZONE = "America/Aruba";
const expenseCategoryLabels = {
    payroll: "Nomina",
    rent: "Arriendo",
    utilities: "Servicios",
    fuel: "Combustible",
    maintenance: "Mantenimiento",
    administration: "Administracion",
    unforeseen: "Imprevisto",
    delivery: "Despacho",
    tolls: "Peajes",
    other: "Otro",
};
function roundMoney(value) {
    return Math.round(value * 100) / 100;
}
function isValidDateKey(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
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
function isDateInRange(dateValue, startDate, endDate) {
    if (!dateValue) {
        return false;
    }
    const dateKey = getBusinessDateKey(new Date(dateValue));
    if (startDate && dateKey < startDate) {
        return false;
    }
    if (endDate && dateKey > endDate) {
        return false;
    }
    return true;
}
function isDateOnOrBefore(dateValue, endDate) {
    if (!dateValue || !endDate) {
        return false;
    }
    const dateKey = getBusinessDateKey(new Date(dateValue));
    return dateKey <= endDate;
}
function enumerateMonthKeys(startDate, endDate) {
    if (!isValidDateKey(startDate) || !isValidDateKey(endDate)) {
        return [];
    }
    const months = [];
    const cursor = parseBusinessDateKey(startDate);
    cursor.setDate(1);
    const end = parseBusinessDateKey(endDate);
    while (cursor <= end) {
        months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return months;
}
function normalizeMonthlyAmount(amount, frequency) {
    switch (frequency) {
        case "weekly":
            return amount * 4;
        case "biweekly":
            return amount * 2;
        case "annual":
            return amount / 12;
        case "one-time":
            return amount;
        case "monthly":
        default:
            return amount;
    }
}
function getFixedCostAmountForMonth(row, monthKey) {
    const startMonth = getBusinessDateKey(new Date(row.startDate)).slice(0, 7);
    const amount = Number(row.amountAwg ?? 0);
    if (String(row.frequency ?? "") === "one-time") {
        return startMonth === monthKey ? amount : 0;
    }
    return normalizeMonthlyAmount(amount, String(row.frequency ?? "monthly"));
}
function sumFixedCostsForMonths(rows, monthKeys) {
    return rows.reduce((total, row) => {
        if (row.active === false) {
            return total;
        }
        return total + monthKeys.reduce((monthTotal, monthKey) => monthTotal + getFixedCostAmountForMonth(row, monthKey), 0);
    }, 0);
}
function matchesStoreFilter(row, storeId) {
    return !storeId || String(row.storeId ?? "") === storeId;
}
function buildLogisticsCostMap(invoices) {
    const map = new Map();
    for (const invoice of invoices) {
        const orderId = String(invoice.orderId ?? "").trim();
        if (!orderId) {
            continue;
        }
        map.set(orderId, Number(invoice.totalCostAwg ?? 0));
    }
    return map;
}
function sumCogsForEntries(entries, logisticsCostByOrderId) {
    return entries.reduce((sum, entry) => sum + (logisticsCostByOrderId.get(String(entry.orderId ?? "")) ?? 0), 0);
}
function resolveDefaultDateRange() {
    const today = getBusinessDateKey(new Date());
    const monthStart = `${today.slice(0, 7)}-01`;
    return { startDate: monthStart, endDate: today };
}
export async function buildFinancialReports(params) {
    const defaults = resolveDefaultDateRange();
    const startDate = isValidDateKey(params.startDate ?? "") ? String(params.startDate) : defaults.startDate;
    const endDate = isValidDateKey(params.endDate ?? "") ? String(params.endDate) : defaults.endDate;
    const storeId = String(params.storeId ?? "").trim();
    const notes = [];
    const [carteraEntries, collections, logisticsInvoices, expenses, fixedCosts, warehouseStockRows,] = await Promise.all([
        CarteraEntry.find({ active: { $ne: false } }).lean(),
        CarteraCollection.find({ active: { $ne: false } }).lean(),
        LogisticsInvoice.find({ active: { $ne: false }, syncExcluded: { $ne: true } }).lean(),
        LogisticsExpense.find({ active: { $ne: false } }).lean(),
        LogisticsFixedCost.find({ active: { $ne: false } }).lean(),
        WarehouseStock.find({}).lean(),
    ]);
    const logisticsCostByOrderId = buildLogisticsCostMap(logisticsInvoices);
    const storeName = storeId
        ? params.storeName
            ?? String(carteraEntries.find((entry) => String(entry.storeId ?? "") === storeId)?.storeName ?? "")
            ?? null
        : null;
    const periodEntries = carteraEntries.filter((entry) => matchesStoreFilter(entry, storeId) && isDateInRange(entry.invoicedAt, startDate, endDate));
    const revenue = roundMoney(periodEntries.reduce((sum, entry) => sum + Number(entry.invoiceAmountAwg ?? 0), 0));
    const costOfGoodsSold = roundMoney(sumCogsForEntries(periodEntries, logisticsCostByOrderId));
    const grossProfit = roundMoney(revenue - costOfGoodsSold);
    const periodExpenses = expenses.filter((expense) => isDateInRange(expense.expenseDate, startDate, endDate));
    const expenseBreakdownMap = new Map();
    for (const expense of periodExpenses) {
        const category = String(expense.category ?? "other");
        expenseBreakdownMap.set(category, (expenseBreakdownMap.get(category) ?? 0) + Number(expense.amountAwg ?? 0));
    }
    const expenseBreakdown = [...expenseBreakdownMap.entries()]
        .map(([category, amount]) => ({
        category,
        label: expenseCategoryLabels[category] ?? category,
        amount: roundMoney(amount),
    }))
        .filter((row) => row.amount > 0)
        .sort((left, right) => right.amount - left.amount);
    const operatingExpenses = roundMoney(expenseBreakdown.reduce((sum, row) => sum + row.amount, 0));
    const periodMonths = enumerateMonthKeys(startDate, endDate);
    const fixedCostsTotal = roundMoney(sumFixedCostsForMonths(fixedCosts, periodMonths));
    const netIncome = roundMoney(grossProfit - operatingExpenses - fixedCostsTotal);
    const collectionsInPeriod = roundMoney(collections
        .filter((collection) => matchesStoreFilter(collection, storeId) && isDateInRange(collection.collectedAt, startDate, endDate))
        .reduce((sum, collection) => sum + Number(collection.amountAwg ?? 0), 0));
    if (storeId) {
        notes.push("Los gastos operativos y costos fijos corresponden a toda la operacion, no solo a la tienda seleccionada.");
    }
    if (periodEntries.some((entry) => !logisticsCostByOrderId.has(String(entry.orderId ?? "")))) {
        notes.push("Algunas facturas no tienen costo registrado en despacho; el costo de ventas puede estar subestimado.");
    }
    notes.push("Las ventas se calculan por fecha de facturacion en cartera (AWG).");
    notes.push("El recaudo del periodo es referencia de caja; no reemplaza las ventas facturadas en el P&G.");
    const profitAndLossLines = [
        { key: "revenue-header", label: "Ingresos", amount: 0, level: 0, tone: "subtotal" },
        { key: "revenue", label: "Ventas facturadas", amount: revenue, level: 1 },
        { key: "cogs-header", label: "Costo de ventas", amount: 0, level: 0, tone: "subtotal" },
        { key: "cogs", label: "Costo de mercancia vendida", amount: costOfGoodsSold, level: 1 },
        { key: "gross-profit", label: "Utilidad bruta", amount: grossProfit, level: 0, tone: "subtotal" },
        { key: "opex-header", label: "Gastos operativos", amount: 0, level: 0, tone: "subtotal" },
    ];
    for (const expenseRow of expenseBreakdown) {
        profitAndLossLines.push({
            key: `expense-${expenseRow.category}`,
            label: expenseRow.label,
            amount: expenseRow.amount,
            level: 1,
        });
    }
    profitAndLossLines.push({ key: "fixed-costs", label: "Costos fijos del periodo", amount: fixedCostsTotal, level: 1 }, { key: "net-income", label: "Utilidad neta del periodo", amount: netIncome, level: 0, tone: "total" }, { key: "collections-ref", label: "Recaudo del periodo (referencia)", amount: collectionsInPeriod, level: 1, tone: "reference" });
    let storeBreakdown = null;
    if (!storeId) {
        const storeMap = new Map();
        for (const entry of periodEntries) {
            const entryStoreId = String(entry.storeId ?? "");
            const entryStoreName = String(entry.storeName ?? "Sin tienda");
            const current = storeMap.get(entryStoreId) ?? {
                storeId: entryStoreId,
                storeName: entryStoreName,
                revenue: 0,
                costOfGoodsSold: 0,
            };
            current.revenue += Number(entry.invoiceAmountAwg ?? 0);
            current.costOfGoodsSold += logisticsCostByOrderId.get(String(entry.orderId ?? "")) ?? 0;
            storeMap.set(entryStoreId, current);
        }
        storeBreakdown = [...storeMap.values()]
            .map((row) => ({
            ...row,
            revenue: roundMoney(row.revenue),
            costOfGoodsSold: roundMoney(row.costOfGoodsSold),
            grossProfit: roundMoney(row.revenue - row.costOfGoodsSold),
        }))
            .sort((left, right) => right.revenue - left.revenue);
    }
    const receivableEntries = carteraEntries.filter((entry) => matchesStoreFilter(entry, storeId) && isDateOnOrBefore(entry.invoicedAt, endDate));
    const accountsReceivable = roundMoney(receivableEntries.reduce((sum, entry) => sum + Number(entry.outstandingAmountAwg ?? 0), 0));
    const cumulativeCollections = roundMoney(collections
        .filter((collection) => matchesStoreFilter(collection, storeId) && isDateOnOrBefore(collection.collectedAt, endDate))
        .reduce((sum, collection) => sum + Number(collection.amountAwg ?? 0), 0));
    const cumulativeExpenses = roundMoney(expenses
        .filter((expense) => isDateOnOrBefore(expense.expenseDate, endDate))
        .reduce((sum, expense) => sum + Number(expense.amountAwg ?? 0), 0));
    const earliestMonth = carteraEntries.reduce((earliest, entry) => {
        const monthKey = getBusinessDateKey(new Date(entry.invoicedAt)).slice(0, 7);
        return !earliest || monthKey < earliest ? monthKey : earliest;
    }, "");
    const balanceMonths = earliestMonth
        ? enumerateMonthKeys(`${earliestMonth}-01`, endDate)
        : enumerateMonthKeys(startDate, endDate);
    const cumulativeFixedCosts = roundMoney(sumFixedCostsForMonths(fixedCosts, balanceMonths));
    const inventory = storeId
        ? 0
        : roundMoney(warehouseStockRows.reduce((sum, row) => sum + Number(row.availableUnits ?? 0) * Number(row.salePriceAwg ?? 0), 0));
    const cashEstimate = storeId
        ? cumulativeCollections
        : roundMoney(cumulativeCollections - cumulativeExpenses - cumulativeFixedCosts);
    const cumulativeEntries = carteraEntries.filter((entry) => matchesStoreFilter(entry, storeId) && isDateOnOrBefore(entry.invoicedAt, endDate));
    const cumulativeRevenue = roundMoney(cumulativeEntries.reduce((sum, entry) => sum + Number(entry.invoiceAmountAwg ?? 0), 0));
    const cumulativeCogs = roundMoney(sumCogsForEntries(cumulativeEntries, logisticsCostByOrderId));
    const retainedEarnings = roundMoney(cumulativeRevenue - cumulativeCogs - cumulativeExpenses - cumulativeFixedCosts);
    const totalAssets = roundMoney(cashEstimate + accountsReceivable + inventory);
    const totalLiabilities = 0;
    const totalEquity = roundMoney(retainedEarnings);
    const balanceDifference = roundMoney(totalAssets - totalLiabilities - totalEquity);
    if (storeId) {
        notes.push("El efectivo estimado muestra recaudos acumulados de la tienda; no descuenta gastos globales.");
        notes.push("El inventario no se desglosa por tienda; consulta el balance sin filtro de tienda para verlo.");
    }
    else {
        notes.push("Efectivo estimado = recaudos acumulados - gastos operativos - costos fijos acumulados.");
        notes.push("Inventario valorizado al precio de venta actual (snapshot, no historico).");
    }
    notes.push("Cuentas por cobrar usan saldo pendiente actual de facturas emitidas hasta la fecha de corte.");
    notes.push("Resultados acumulados = ventas acumuladas - costo de ventas - gastos - costos fijos hasta la fecha de corte.");
    const balanceLines = [
        { key: "assets-header", label: "Activos", amount: 0, level: 0, tone: "subtotal", section: "assets" },
        { key: "cash", label: storeId ? "Recaudos acumulados (tienda)" : "Efectivo estimado", amount: cashEstimate, level: 1, section: "assets" },
        { key: "ar", label: "Cuentas por cobrar", amount: accountsReceivable, level: 1, section: "assets" },
    ];
    if (!storeId) {
        balanceLines.push({
            key: "inventory",
            label: "Inventario (precio de venta)",
            amount: inventory,
            level: 1,
            section: "assets",
        });
    }
    balanceLines.push({ key: "total-assets", label: "Total activos", amount: totalAssets, level: 0, tone: "total", section: "assets" }, { key: "liabilities-header", label: "Pasivos", amount: 0, level: 0, tone: "subtotal", section: "liabilities" }, { key: "liabilities-none", label: "Sin pasivos registrados", amount: totalLiabilities, level: 1, section: "liabilities" }, { key: "total-liabilities", label: "Total pasivos", amount: totalLiabilities, level: 0, tone: "subtotal", section: "liabilities" }, { key: "equity-header", label: "Patrimonio", amount: 0, level: 0, tone: "subtotal", section: "equity" }, { key: "retained-earnings", label: "Resultados acumulados", amount: totalEquity, level: 1, section: "equity" }, { key: "total-equity", label: "Total patrimonio", amount: totalEquity, level: 0, tone: "total", section: "equity" }, {
        key: "balance-check",
        label: balanceDifference === 0 ? "Activos = Pasivos + Patrimonio" : "Diferencia de cuadre (referencia)",
        amount: balanceDifference,
        level: 0,
        tone: balanceDifference === 0 ? "reference" : "subtotal",
        section: "equity",
    });
    return {
        filters: {
            startDate,
            endDate,
            storeId,
            storeName: storeName || null,
        },
        profitAndLoss: {
            lines: profitAndLossLines,
            metrics: {
                revenue,
                costOfGoodsSold,
                grossProfit,
                operatingExpenses,
                fixedCosts: fixedCostsTotal,
                netIncome,
                collectionsInPeriod,
                invoiceCount: periodEntries.length,
            },
            expenseBreakdown,
            storeBreakdown,
        },
        balance: {
            asOfDate: endDate,
            lines: balanceLines,
            metrics: {
                cashEstimate,
                accountsReceivable,
                inventory,
                totalAssets,
                totalLiabilities,
                retainedEarnings: totalEquity,
                totalEquity,
            },
        },
        notes,
    };
}
//# sourceMappingURL=financial-reports.service.js.map