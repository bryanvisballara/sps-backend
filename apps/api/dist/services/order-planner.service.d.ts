export type OrderPlannerAlertLevel = "critical" | "warning" | "watch" | "ok" | "no_demand";
export type OrderPlannerProductRow = {
    productId: string;
    productSku: string;
    productName: string;
    category: string;
    supplier: string;
    currentStock: number;
    minStockAlert: number;
    nearestExpiration: string | null;
    daysUntilExpiration: number | null;
    unitsSoldInPeriod: number;
    orderCountInPeriod: number;
    storeCountInPeriod: number;
    avgDailyUnits: number;
    avgWeeklyUnits: number;
    daysUntilStockout: number | null;
    coverageDaysTarget: number;
    suggestedOrderQty: number;
    trend: "up" | "down" | "stable" | "unknown";
    trendPercent: number | null;
    rotationLabel: string;
    alertLevel: OrderPlannerAlertLevel;
    alertMessage: string;
};
export type OrderPlannerStoreConsumption = {
    storeId: string;
    storeName: string;
    address: string;
    unitsSold: number;
    orderCount: number;
    sharePercent: number;
};
export type OrderPlannerWeeklyBucket = {
    weekStart: string;
    weekLabel: string;
    totalUnits: number;
};
export type OrderPlannerResult = {
    filters: {
        startDate: string;
        endDate: string;
        coverageDays: number;
        category: string;
        productId: string;
        alertsOnly: boolean;
    };
    summary: {
        totalProducts: number;
        criticalCount: number;
        warningCount: number;
        watchCount: number;
        noDemandCount: number;
        suggestedOrderUnits: number;
        periodDays: number;
        totalUnitsSold: number;
    };
    products: OrderPlannerProductRow[];
    selectedProduct: {
        productId: string;
        productName: string;
        productSku: string;
        unitsSoldInPeriod: number;
        stores: OrderPlannerStoreConsumption[];
    } | null;
    weeklyTrend: OrderPlannerWeeklyBucket[];
    notes: string[];
};
export declare function buildOrderPlannerReport(params: {
    startDate?: string;
    endDate?: string;
    coverageDays?: number;
    category?: string;
    productId?: string;
    alertsOnly?: boolean;
}): Promise<{
    filters: {
        startDate: string;
        endDate: string;
        coverageDays: number;
        category: string;
        productId: string;
        alertsOnly: boolean;
    };
    summary: {
        totalProducts: number;
        criticalCount: number;
        warningCount: number;
        watchCount: number;
        noDemandCount: number;
        suggestedOrderUnits: number;
        periodDays: number;
        totalUnitsSold: number;
    };
    products: OrderPlannerProductRow[];
    selectedProduct: {
        productId: string;
        productName: string;
        productSku: string;
        unitsSoldInPeriod: number;
        stores: OrderPlannerStoreConsumption[];
    } | null;
    weeklyTrend: OrderPlannerWeeklyBucket[];
    notes: string[];
}>;
//# sourceMappingURL=order-planner.service.d.ts.map