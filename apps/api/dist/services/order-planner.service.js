import { Order } from "../modules/orders/order.model.js";
import { Product } from "../modules/catalog/product.model.js";
import { Store } from "../modules/stores/store.model.js";
import { WarehouseStock } from "../modules/inventory/warehouse-stock.model.js";
const BUSINESS_TIMEZONE = "America/Aruba";
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
function resolveOrderSalesDate(order) {
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
function isDateInRange(dateKey, startDate, endDate) {
    if (startDate && dateKey < startDate) {
        return false;
    }
    if (endDate && dateKey > endDate) {
        return false;
    }
    return true;
}
function countInclusiveDays(startDate, endDate) {
    const start = parseBusinessDateKey(startDate);
    const end = parseBusinessDateKey(endDate);
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1);
}
function addDaysToDateKey(dateKey, days) {
    const parsed = parseBusinessDateKey(dateKey);
    parsed.setDate(parsed.getDate() + days);
    return getBusinessDateKey(parsed);
}
function daysBetweenDateKeys(fromKey, toKey) {
    const from = parseBusinessDateKey(fromKey);
    const to = parseBusinessDateKey(toKey);
    return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
function roundUnits(value) {
    return Math.round(value * 100) / 100;
}
function resolveDefaultDateRange() {
    const endDate = getBusinessDateKey(new Date());
    const startDate = addDaysToDateKey(endDate, -29);
    return { startDate, endDate };
}
function resolveRotationLabel(avgWeeklyUnits, unitsSoldInPeriod) {
    if (unitsSoldInPeriod <= 0) {
        return "Sin ventas";
    }
    if (avgWeeklyUnits >= 35) {
        return "Rotacion muy alta";
    }
    if (avgWeeklyUnits >= 15) {
        return "Rotacion alta";
    }
    if (avgWeeklyUnits >= 5) {
        return "Rotacion media";
    }
    return "Rotacion baja";
}
function resolveTrend(firstHalfDaily, secondHalfDaily) {
    if (firstHalfDaily <= 0 && secondHalfDaily <= 0) {
        return { trend: "unknown", trendPercent: null };
    }
    if (firstHalfDaily <= 0 && secondHalfDaily > 0) {
        return { trend: "up", trendPercent: 100 };
    }
    const change = ((secondHalfDaily - firstHalfDaily) / firstHalfDaily) * 100;
    if (Math.abs(change) < 8) {
        return { trend: "stable", trendPercent: roundUnits(change) };
    }
    return {
        trend: change > 0 ? "up" : "down",
        trendPercent: roundUnits(change),
    };
}
function resolveAlert(params) {
    const { avgDailyUnits, daysUntilStockout, currentStock, minStockAlert, unitsSoldInPeriod, daysUntilExpiration, coverageDaysTarget, } = params;
    if (unitsSoldInPeriod <= 0 && currentStock > 0) {
        return {
            alertLevel: "no_demand",
            alertMessage: "Hay stock pero no hubo ventas en el periodo analizado.",
        };
    }
    if (unitsSoldInPeriod <= 0 && currentStock <= 0) {
        return {
            alertLevel: "ok",
            alertMessage: "Sin ventas ni stock actual.",
        };
    }
    if (daysUntilStockout !== null && daysUntilStockout <= 7) {
        return {
            alertLevel: "critical",
            alertMessage: `Quiebre estimado en ${daysUntilStockout} dia(s). Pedir pronto.`,
        };
    }
    if (currentStock <= minStockAlert && unitsSoldInPeriod > 0) {
        return {
            alertLevel: "critical",
            alertMessage: "Stock por debajo del minimo configurado.",
        };
    }
    if (daysUntilExpiration !== null && daysUntilExpiration <= 30 && currentStock > 0 && avgDailyUnits > 0) {
        const daysToSellStock = currentStock / avgDailyUnits;
        if (daysToSellStock > daysUntilExpiration) {
            return {
                alertLevel: "warning",
                alertMessage: "Riesgo de vencimiento: el stock actual no se agota antes de la fecha de lote.",
            };
        }
    }
    if (daysUntilStockout !== null && daysUntilStockout <= 14) {
        return {
            alertLevel: "warning",
            alertMessage: `Quedan aprox. ${daysUntilStockout} dia(s) de inventario al ritmo actual.`,
        };
    }
    if (daysUntilStockout !== null && daysUntilStockout <= coverageDaysTarget) {
        return {
            alertLevel: "watch",
            alertMessage: `Inventario cubre menos de ${coverageDaysTarget} dias. Considera reponer.`,
        };
    }
    return {
        alertLevel: "ok",
        alertMessage: "Stock saludable para el ritmo de venta actual.",
    };
}
function getWeekStartKey(dateKey) {
    const date = parseBusinessDateKey(dateKey);
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    date.setDate(date.getDate() + mondayOffset);
    return getBusinessDateKey(date);
}
function formatWeekLabel(weekStart) {
    const parsed = parseBusinessDateKey(weekStart);
    return parsed.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
export async function buildOrderPlannerReport(params) {
    const defaults = resolveDefaultDateRange();
    const startDate = isValidDateKey(params.startDate ?? "") ? String(params.startDate) : defaults.startDate;
    const endDate = isValidDateKey(params.endDate ?? "") ? String(params.endDate) : defaults.endDate;
    const coverageDays = Math.min(90, Math.max(1, Math.round(Number(params.coverageDays ?? 14) || 14)));
    const category = String(params.category ?? "").trim();
    const productId = String(params.productId ?? "").trim();
    const alertsOnly = params.alertsOnly === true || String(params.alertsOnly ?? "") === "true";
    const periodDays = countInclusiveDays(startDate, endDate);
    const todayKey = getBusinessDateKey(new Date());
    const notes = [
        "Las ventas se calculan desde pedidos entregados (status delivered) en el rango de fechas.",
        "Consumo diario = unidades vendidas / dias del periodo seleccionado.",
        "Dias restantes = stock actual / consumo diario. Si no hay ventas, no se estima quiebre.",
        `Cantidad sugerida = (consumo diario x ${coverageDays} dias de cobertura) - stock actual.`,
        "La tendencia compara la primera mitad vs la segunda mitad del periodo seleccionado.",
    ];
    const comparisonStartDate = addDaysToDateKey(startDate, -periodDays);
    const midDate = addDaysToDateKey(startDate, Math.floor(periodDays / 2) - 1);
    const [products, deliveredOrders, warehouseStocks, stores] = await Promise.all([
        Product.find({ active: { $ne: false }, shareWithAruba: { $ne: false } }).sort({ name: 1 }).lean(),
        Order.find({ status: "delivered" })
            .select({ storeId: 1, storeName: 1, items: 1, deliveryDate: 1, createdAt: 1, updatedAt: 1 })
            .lean(),
        WarehouseStock.find({ availableUnits: { $gt: 0 } })
            .select({ productId: 1, availableUnits: 1, expirationDate: 1, minUnits: 1 })
            .lean(),
        Store.find({ active: { $ne: false } }).select({ name: 1, address: 1 }).lean(),
    ]);
    const storeAddressById = new Map(stores.map((store) => [String(store._id), String(store.address ?? "")]));
    const productMap = new Map();
    for (const product of products) {
        if (category && String(product.category ?? "") !== category) {
            continue;
        }
        const id = String(product._id);
        productMap.set(id, {
            productId: id,
            productSku: String(product.sku ?? ""),
            productName: String(product.name ?? ""),
            category: String(product.category ?? ""),
            supplier: String(product.supplier ?? ""),
            minStockAlert: Math.max(0, Number(product.inventoryAlert ?? 0)),
            currentStock: 0,
            nearestExpiration: null,
            unitsSoldInPeriod: 0,
            unitsSoldFirstHalf: 0,
            unitsSoldSecondHalf: 0,
            orderIdsInPeriod: new Set(),
            storeIdsInPeriod: new Set(),
            storeConsumption: new Map(),
        });
    }
    for (const stock of warehouseStocks) {
        const id = String(stock.productId ?? "");
        const current = productMap.get(id);
        if (!current) {
            continue;
        }
        current.currentStock += Number(stock.availableUnits ?? 0);
        const expirationKey = stock.expirationDate ? getBusinessDateKey(new Date(stock.expirationDate)) : null;
        if (expirationKey && (!current.nearestExpiration || expirationKey < current.nearestExpiration)) {
            current.nearestExpiration = expirationKey;
        }
        const stockMin = Number(stock.minUnits ?? 0);
        if (stockMin > current.minStockAlert) {
            current.minStockAlert = stockMin;
        }
    }
    const weeklyTrendMap = new Map();
    for (const order of deliveredOrders) {
        const salesDate = resolveOrderSalesDate(order);
        const orderId = String(order._id);
        const storeId = String(order.storeId ?? "");
        const storeName = String(order.storeName ?? "Sin tienda");
        const inComparisonWindow = isDateInRange(salesDate, comparisonStartDate, endDate);
        const inSelectedPeriod = isDateInRange(salesDate, startDate, endDate);
        const isFirstHalf = salesDate >= startDate && salesDate <= midDate;
        const isSecondHalf = salesDate > midDate && salesDate <= endDate;
        if (!inComparisonWindow) {
            continue;
        }
        for (const item of order.items ?? []) {
            const itemProductId = String(item.productId ?? "").trim();
            const quantity = Number(item.quantity ?? 0);
            const current = productMap.get(itemProductId);
            if (!current || !Number.isFinite(quantity) || quantity <= 0) {
                continue;
            }
            if (inSelectedPeriod) {
                current.unitsSoldInPeriod += quantity;
                current.orderIdsInPeriod.add(orderId);
                if (storeId) {
                    current.storeIdsInPeriod.add(storeId);
                    const storeRow = current.storeConsumption.get(storeId) ?? {
                        storeName,
                        unitsSold: 0,
                        orderIds: new Set(),
                    };
                    storeRow.unitsSold += quantity;
                    storeRow.orderIds.add(orderId);
                    current.storeConsumption.set(storeId, storeRow);
                }
                const weekStart = getWeekStartKey(salesDate);
                weeklyTrendMap.set(weekStart, (weeklyTrendMap.get(weekStart) ?? 0) + quantity);
            }
            if (isFirstHalf) {
                current.unitsSoldFirstHalf += quantity;
            }
            else if (isSecondHalf) {
                current.unitsSoldSecondHalf += quantity;
            }
        }
    }
    const halfPeriodDays = Math.max(1, Math.ceil(periodDays / 2));
    const productRows = [];
    for (const current of productMap.values()) {
        const avgDailyUnits = roundUnits(current.unitsSoldInPeriod / periodDays);
        const avgWeeklyUnits = roundUnits(avgDailyUnits * 7);
        const daysUntilStockout = avgDailyUnits > 0
            ? Math.max(0, Math.floor(current.currentStock / avgDailyUnits))
            : null;
        const targetStock = Math.ceil(avgDailyUnits * coverageDays);
        let suggestedOrderQty = Math.max(0, targetStock - current.currentStock);
        if (current.currentStock < current.minStockAlert && avgDailyUnits > 0) {
            suggestedOrderQty = Math.max(suggestedOrderQty, current.minStockAlert - current.currentStock);
        }
        const daysUntilExpiration = current.nearestExpiration
            ? daysBetweenDateKeys(todayKey, current.nearestExpiration)
            : null;
        const firstHalfDaily = current.unitsSoldFirstHalf / halfPeriodDays;
        const secondHalfDaily = current.unitsSoldSecondHalf / halfPeriodDays;
        const { trend, trendPercent } = resolveTrend(firstHalfDaily, secondHalfDaily);
        const { alertLevel, alertMessage } = resolveAlert({
            avgDailyUnits,
            daysUntilStockout,
            currentStock: current.currentStock,
            minStockAlert: current.minStockAlert,
            unitsSoldInPeriod: current.unitsSoldInPeriod,
            daysUntilExpiration,
            coverageDaysTarget: coverageDays,
        });
        productRows.push({
            productId: current.productId,
            productSku: current.productSku,
            productName: current.productName,
            category: current.category,
            supplier: current.supplier,
            currentStock: current.currentStock,
            minStockAlert: current.minStockAlert,
            nearestExpiration: current.nearestExpiration,
            daysUntilExpiration,
            unitsSoldInPeriod: current.unitsSoldInPeriod,
            orderCountInPeriod: current.orderIdsInPeriod.size,
            storeCountInPeriod: current.storeIdsInPeriod.size,
            avgDailyUnits,
            avgWeeklyUnits,
            daysUntilStockout,
            coverageDaysTarget: coverageDays,
            suggestedOrderQty,
            trend,
            trendPercent,
            rotationLabel: resolveRotationLabel(avgWeeklyUnits, current.unitsSoldInPeriod),
            alertLevel,
            alertMessage,
        });
    }
    productRows.sort((left, right) => {
        const alertWeight = (level) => {
            switch (level) {
                case "critical": return 0;
                case "warning": return 1;
                case "watch": return 2;
                case "no_demand": return 3;
                default: return 4;
            }
        };
        const weightDiff = alertWeight(left.alertLevel) - alertWeight(right.alertLevel);
        if (weightDiff !== 0) {
            return weightDiff;
        }
        if (left.daysUntilStockout !== null && right.daysUntilStockout !== null && left.daysUntilStockout !== right.daysUntilStockout) {
            return left.daysUntilStockout - right.daysUntilStockout;
        }
        return right.unitsSoldInPeriod - left.unitsSoldInPeriod;
    });
    const filteredProducts = alertsOnly
        ? productRows.filter((row) => row.alertLevel === "critical" || row.alertLevel === "warning" || row.alertLevel === "watch")
        : productRows;
    let selectedProduct = null;
    if (productId) {
        const selectedAccumulator = [...productMap.values()].find((row) => row.productId === productId);
        const selectedRow = productRows.find((row) => row.productId === productId);
        if (selectedAccumulator && selectedRow) {
            const totalUnits = selectedAccumulator.unitsSoldInPeriod || 1;
            const storeRows = [...selectedAccumulator.storeConsumption.entries()]
                .map(([storeId, storeRow]) => ({
                storeId,
                storeName: storeRow.storeName,
                address: storeAddressById.get(storeId) ?? "",
                unitsSold: storeRow.unitsSold,
                orderCount: storeRow.orderIds.size,
                sharePercent: roundUnits((storeRow.unitsSold / totalUnits) * 100),
            }))
                .sort((left, right) => right.unitsSold - left.unitsSold);
            selectedProduct = {
                productId: selectedRow.productId,
                productName: selectedRow.productName,
                productSku: selectedRow.productSku,
                unitsSoldInPeriod: selectedRow.unitsSoldInPeriod,
                stores: storeRows,
            };
        }
    }
    const weeklyTrend = [...weeklyTrendMap.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([weekStart, totalUnits]) => ({
        weekStart,
        weekLabel: formatWeekLabel(weekStart),
        totalUnits,
    }));
    const summary = {
        totalProducts: filteredProducts.length,
        criticalCount: productRows.filter((row) => row.alertLevel === "critical").length,
        warningCount: productRows.filter((row) => row.alertLevel === "warning").length,
        watchCount: productRows.filter((row) => row.alertLevel === "watch").length,
        noDemandCount: productRows.filter((row) => row.alertLevel === "no_demand").length,
        suggestedOrderUnits: filteredProducts.reduce((sum, row) => sum + row.suggestedOrderQty, 0),
        periodDays,
        totalUnitsSold: filteredProducts.reduce((sum, row) => sum + row.unitsSoldInPeriod, 0),
    };
    return {
        filters: {
            startDate,
            endDate,
            coverageDays,
            category,
            productId,
            alertsOnly,
        },
        summary,
        products: filteredProducts,
        selectedProduct,
        weeklyTrend,
        notes,
    };
}
//# sourceMappingURL=order-planner.service.js.map