export type FinancialReportLine = {
    key: string;
    label: string;
    amount: number;
    level: 0 | 1 | 2;
    tone?: "normal" | "subtotal" | "total" | "reference";
};
export type FinancialReportsResult = {
    filters: {
        startDate: string;
        endDate: string;
        storeId: string;
        storeName: string | null;
    };
    profitAndLoss: {
        lines: FinancialReportLine[];
        metrics: {
            revenue: number;
            costOfGoodsSold: number;
            grossProfit: number;
            operatingExpenses: number;
            fixedCosts: number;
            netIncome: number;
            collectionsInPeriod: number;
            invoiceCount: number;
        };
        expenseBreakdown: Array<{
            category: string;
            label: string;
            amount: number;
        }>;
        storeBreakdown: Array<{
            storeId: string;
            storeName: string;
            revenue: number;
            costOfGoodsSold: number;
            grossProfit: number;
        }> | null;
    };
    balance: {
        asOfDate: string;
        lines: Array<FinancialReportLine & {
            section: "assets" | "liabilities" | "equity";
        }>;
        metrics: {
            cashEstimate: number;
            accountsReceivable: number;
            inventory: number;
            totalAssets: number;
            totalLiabilities: number;
            retainedEarnings: number;
            totalEquity: number;
        };
    };
    notes: string[];
};
export declare function buildFinancialReports(params: {
    startDate?: string;
    endDate?: string;
    storeId?: string;
    storeName?: string | null;
}): Promise<{
    filters: {
        startDate: string;
        endDate: string;
        storeId: string;
        storeName: string | null;
    };
    profitAndLoss: {
        lines: FinancialReportLine[];
        metrics: {
            revenue: number;
            costOfGoodsSold: number;
            grossProfit: number;
            operatingExpenses: number;
            fixedCosts: number;
            netIncome: number;
            collectionsInPeriod: number;
            invoiceCount: number;
        };
        expenseBreakdown: {
            category: string;
            label: string;
            amount: number;
        }[];
        storeBreakdown: {
            storeId: string;
            storeName: string;
            revenue: number;
            costOfGoodsSold: number;
            grossProfit: number;
        }[] | null;
    };
    balance: {
        asOfDate: string;
        lines: (FinancialReportLine & {
            section: "assets" | "liabilities" | "equity";
        })[];
        metrics: {
            cashEstimate: number;
            accountsReceivable: number;
            inventory: number;
            totalAssets: number;
            totalLiabilities: number;
            retainedEarnings: number;
            totalEquity: number;
        };
    };
    notes: string[];
}>;
//# sourceMappingURL=financial-reports.service.d.ts.map