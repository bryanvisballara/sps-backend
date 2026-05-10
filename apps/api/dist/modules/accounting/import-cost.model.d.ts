import { Schema, Types } from "mongoose";
export declare const ImportCost: import("mongoose").Model<{
    active: boolean;
    containerReference: string;
    containerType: "refrigerado" | "seco";
    containerSize: "20ft" | "40ft";
    measurementUnit: "m3" | "pie3" | "kg";
    productId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    productName: string;
    productSku: string;
    seasonLabel: string;
    shipmentReference: string;
    importDate: NativeDate;
    importedQuantity: number;
    purchaseUnitCostOrigin: number;
    exchangeRate: number;
    seasonalAdjustmentPercent: number;
    freightCost: number;
    customsCost: number;
    inlandLogisticsCost: number;
    taxesCost: number;
    coldChainCost: number;
    additionalCostName: string;
    otherImportCosts: number;
    adjustedUnitCostOrigin: number;
    purchaseUnitCostLocal: number;
    merchandiseCostTotal: number;
    totalImportCost: number;
    landedUnitCost: number;
    invoicedSaleUnitUsd: number;
    invoicedSaleUnitCop: number;
    invoicedLineTotalCop: number;
    invoicedLineUtilityCop: number;
    invoiceClientId: string;
    invoiceClientCode: string;
    invoiceClientName: string;
    invoiceClientManagerName: string;
    invoiceClientEmail: string;
    invoiceClientPhone: string;
    invoiceClientAddress: string;
    expenseItems: Types.DocumentArray<{
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }> & {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }>;
    notes?: string | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    invoiceGeneratedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    active: boolean;
    containerReference: string;
    containerType: "refrigerado" | "seco";
    containerSize: "20ft" | "40ft";
    measurementUnit: "m3" | "pie3" | "kg";
    productId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    productName: string;
    productSku: string;
    seasonLabel: string;
    shipmentReference: string;
    importDate: NativeDate;
    importedQuantity: number;
    purchaseUnitCostOrigin: number;
    exchangeRate: number;
    seasonalAdjustmentPercent: number;
    freightCost: number;
    customsCost: number;
    inlandLogisticsCost: number;
    taxesCost: number;
    coldChainCost: number;
    additionalCostName: string;
    otherImportCosts: number;
    adjustedUnitCostOrigin: number;
    purchaseUnitCostLocal: number;
    merchandiseCostTotal: number;
    totalImportCost: number;
    landedUnitCost: number;
    invoicedSaleUnitUsd: number;
    invoicedSaleUnitCop: number;
    invoicedLineTotalCop: number;
    invoicedLineUtilityCop: number;
    invoiceClientId: string;
    invoiceClientCode: string;
    invoiceClientName: string;
    invoiceClientManagerName: string;
    invoiceClientEmail: string;
    invoiceClientPhone: string;
    invoiceClientAddress: string;
    expenseItems: Types.DocumentArray<{
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }> & {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }>;
    notes?: string | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    invoiceGeneratedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    active: boolean;
    containerReference: string;
    containerType: "refrigerado" | "seco";
    containerSize: "20ft" | "40ft";
    measurementUnit: "m3" | "pie3" | "kg";
    productId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    productName: string;
    productSku: string;
    seasonLabel: string;
    shipmentReference: string;
    importDate: NativeDate;
    importedQuantity: number;
    purchaseUnitCostOrigin: number;
    exchangeRate: number;
    seasonalAdjustmentPercent: number;
    freightCost: number;
    customsCost: number;
    inlandLogisticsCost: number;
    taxesCost: number;
    coldChainCost: number;
    additionalCostName: string;
    otherImportCosts: number;
    adjustedUnitCostOrigin: number;
    purchaseUnitCostLocal: number;
    merchandiseCostTotal: number;
    totalImportCost: number;
    landedUnitCost: number;
    invoicedSaleUnitUsd: number;
    invoicedSaleUnitCop: number;
    invoicedLineTotalCop: number;
    invoicedLineUtilityCop: number;
    invoiceClientId: string;
    invoiceClientCode: string;
    invoiceClientName: string;
    invoiceClientManagerName: string;
    invoiceClientEmail: string;
    invoiceClientPhone: string;
    invoiceClientAddress: string;
    expenseItems: Types.DocumentArray<{
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }> & {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }>;
    notes?: string | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    invoiceGeneratedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    active: boolean;
    containerReference: string;
    containerType: "refrigerado" | "seco";
    containerSize: "20ft" | "40ft";
    measurementUnit: "m3" | "pie3" | "kg";
    productId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    productName: string;
    productSku: string;
    seasonLabel: string;
    shipmentReference: string;
    importDate: NativeDate;
    importedQuantity: number;
    purchaseUnitCostOrigin: number;
    exchangeRate: number;
    seasonalAdjustmentPercent: number;
    freightCost: number;
    customsCost: number;
    inlandLogisticsCost: number;
    taxesCost: number;
    coldChainCost: number;
    additionalCostName: string;
    otherImportCosts: number;
    adjustedUnitCostOrigin: number;
    purchaseUnitCostLocal: number;
    merchandiseCostTotal: number;
    totalImportCost: number;
    landedUnitCost: number;
    invoicedSaleUnitUsd: number;
    invoicedSaleUnitCop: number;
    invoicedLineTotalCop: number;
    invoicedLineUtilityCop: number;
    invoiceClientId: string;
    invoiceClientCode: string;
    invoiceClientName: string;
    invoiceClientManagerName: string;
    invoiceClientEmail: string;
    invoiceClientPhone: string;
    invoiceClientAddress: string;
    expenseItems: Types.DocumentArray<{
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }> & {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }>;
    notes?: string | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    invoiceGeneratedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    active: boolean;
    containerReference: string;
    containerType: "refrigerado" | "seco";
    containerSize: "20ft" | "40ft";
    measurementUnit: "m3" | "pie3" | "kg";
    productId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    productName: string;
    productSku: string;
    seasonLabel: string;
    shipmentReference: string;
    importDate: NativeDate;
    importedQuantity: number;
    purchaseUnitCostOrigin: number;
    exchangeRate: number;
    seasonalAdjustmentPercent: number;
    freightCost: number;
    customsCost: number;
    inlandLogisticsCost: number;
    taxesCost: number;
    coldChainCost: number;
    additionalCostName: string;
    otherImportCosts: number;
    adjustedUnitCostOrigin: number;
    purchaseUnitCostLocal: number;
    merchandiseCostTotal: number;
    totalImportCost: number;
    landedUnitCost: number;
    invoicedSaleUnitUsd: number;
    invoicedSaleUnitCop: number;
    invoicedLineTotalCop: number;
    invoicedLineUtilityCop: number;
    invoiceClientId: string;
    invoiceClientCode: string;
    invoiceClientName: string;
    invoiceClientManagerName: string;
    invoiceClientEmail: string;
    invoiceClientPhone: string;
    invoiceClientAddress: string;
    expenseItems: Types.DocumentArray<{
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }> & {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }>;
    notes?: string | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    invoiceGeneratedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    active: boolean;
    containerReference: string;
    containerType: "refrigerado" | "seco";
    containerSize: "20ft" | "40ft";
    measurementUnit: "m3" | "pie3" | "kg";
    productId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    productName: string;
    productSku: string;
    seasonLabel: string;
    shipmentReference: string;
    importDate: NativeDate;
    importedQuantity: number;
    purchaseUnitCostOrigin: number;
    exchangeRate: number;
    seasonalAdjustmentPercent: number;
    freightCost: number;
    customsCost: number;
    inlandLogisticsCost: number;
    taxesCost: number;
    coldChainCost: number;
    additionalCostName: string;
    otherImportCosts: number;
    adjustedUnitCostOrigin: number;
    purchaseUnitCostLocal: number;
    merchandiseCostTotal: number;
    totalImportCost: number;
    landedUnitCost: number;
    invoicedSaleUnitUsd: number;
    invoicedSaleUnitCop: number;
    invoicedLineTotalCop: number;
    invoicedLineUtilityCop: number;
    invoiceClientId: string;
    invoiceClientCode: string;
    invoiceClientName: string;
    invoiceClientManagerName: string;
    invoiceClientEmail: string;
    invoiceClientPhone: string;
    invoiceClientAddress: string;
    expenseItems: Types.DocumentArray<{
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }> & {
        amount: number;
        key: "other" | "freight" | "customs" | "inlandLogistics" | "taxes";
        label: string;
        documents: Types.DocumentArray<{
            name: string;
            url: string;
        }, Types.Subdocument<import("bson").ObjectId, any, {
            name: string;
            url: string;
        }> & {
            name: string;
            url: string;
        }>;
    }>;
    notes?: string | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    invoiceGeneratedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=import-cost.model.d.ts.map