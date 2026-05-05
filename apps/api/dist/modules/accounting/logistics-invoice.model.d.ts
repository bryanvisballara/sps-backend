import { Schema } from "mongoose";
export declare const LogisticsInvoice: import("mongoose").Model<{
    active: boolean;
    invoiceDate: NativeDate;
    storeName: string;
    items: import("mongoose").Types.DocumentArray<{
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }> & {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }>;
    totalRevenueAwg: number;
    totalCostAwg: number;
    totalUtilityAwg: number;
    notes?: string | null | undefined;
    orderId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    active: boolean;
    invoiceDate: NativeDate;
    storeName: string;
    items: import("mongoose").Types.DocumentArray<{
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }> & {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }>;
    totalRevenueAwg: number;
    totalCostAwg: number;
    totalUtilityAwg: number;
    notes?: string | null | undefined;
    orderId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    active: boolean;
    invoiceDate: NativeDate;
    storeName: string;
    items: import("mongoose").Types.DocumentArray<{
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }> & {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }>;
    totalRevenueAwg: number;
    totalCostAwg: number;
    totalUtilityAwg: number;
    notes?: string | null | undefined;
    orderId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    active: boolean;
    invoiceDate: NativeDate;
    storeName: string;
    items: import("mongoose").Types.DocumentArray<{
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }> & {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }>;
    totalRevenueAwg: number;
    totalCostAwg: number;
    totalUtilityAwg: number;
    notes?: string | null | undefined;
    orderId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    active: boolean;
    invoiceDate: NativeDate;
    storeName: string;
    items: import("mongoose").Types.DocumentArray<{
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }> & {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }>;
    totalRevenueAwg: number;
    totalCostAwg: number;
    totalUtilityAwg: number;
    notes?: string | null | undefined;
    orderId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    active: boolean;
    invoiceDate: NativeDate;
    storeName: string;
    items: import("mongoose").Types.DocumentArray<{
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }> & {
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
        salePriceAwg: number;
        lineTotalAwg: number;
        unitCostAwg: number;
        lineUtilityAwg: number;
    }>;
    totalRevenueAwg: number;
    totalCostAwg: number;
    totalUtilityAwg: number;
    notes?: string | null | undefined;
    orderId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=logistics-invoice.model.d.ts.map