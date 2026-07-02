import { Schema, Types } from "mongoose";
export declare const Order: import("mongoose").Model<{
    status: "draft" | "submitted" | "picking" | "dispatched" | "delivered";
    storeId: string;
    storeName: string;
    salesRepId: string;
    salesRepName: string;
    routeId: string;
    routeName: string;
    routeDay: string;
    deliveryZone: string;
    items: Types.DocumentArray<{
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }> & {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }>;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    status: "draft" | "submitted" | "picking" | "dispatched" | "delivered";
    storeId: string;
    storeName: string;
    salesRepId: string;
    salesRepName: string;
    routeId: string;
    routeName: string;
    routeDay: string;
    deliveryZone: string;
    items: Types.DocumentArray<{
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }> & {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }>;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    status: "draft" | "submitted" | "picking" | "dispatched" | "delivered";
    storeId: string;
    storeName: string;
    salesRepId: string;
    salesRepName: string;
    routeId: string;
    routeName: string;
    routeDay: string;
    deliveryZone: string;
    items: Types.DocumentArray<{
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }> & {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }>;
} & import("mongoose").DefaultTimestampProps & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    status: "draft" | "submitted" | "picking" | "dispatched" | "delivered";
    storeId: string;
    storeName: string;
    salesRepId: string;
    salesRepName: string;
    routeId: string;
    routeName: string;
    routeDay: string;
    deliveryZone: string;
    items: Types.DocumentArray<{
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }> & {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }>;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    status: "draft" | "submitted" | "picking" | "dispatched" | "delivered";
    storeId: string;
    storeName: string;
    salesRepId: string;
    salesRepName: string;
    routeId: string;
    routeName: string;
    routeDay: string;
    deliveryZone: string;
    items: Types.DocumentArray<{
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }> & {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }>;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    status: "draft" | "submitted" | "picking" | "dispatched" | "delivered";
    storeId: string;
    storeName: string;
    salesRepId: string;
    salesRepName: string;
    routeId: string;
    routeName: string;
    routeDay: string;
    deliveryZone: string;
    items: Types.DocumentArray<{
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }, Types.Subdocument<import("bson").ObjectId, any, {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }> & {
        productId: {
            prototype?: Types.ObjectId | null | undefined;
            cacheHexString?: unknown;
            generate?: {} | null | undefined;
            createFromTime?: {} | null | undefined;
            createFromHexString?: {} | null | undefined;
            createFromBase64?: {} | null | undefined;
            isValid?: {} | null | undefined;
        };
        quantity: number;
        notes?: string | null | undefined;
        stockCurrent?: number | null | undefined;
    }>;
} & import("mongoose").DefaultTimestampProps> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=order.model.d.ts.map