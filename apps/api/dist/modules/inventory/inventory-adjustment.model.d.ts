import { Schema, Types } from "mongoose";
export declare const InventoryAdjustment: import("mongoose").Model<{
    notes: string;
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
    reason: string;
    entryGroupId: string;
    entryWarehouseId: string;
    entryWarehouseName: string;
    entryUsdToAwgRate: number;
    entryCostUsd: number;
    source: "warehouse-stock" | "import-fallback" | "inventory-entry";
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    notes: string;
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
    reason: string;
    entryGroupId: string;
    entryWarehouseId: string;
    entryWarehouseName: string;
    entryUsdToAwgRate: number;
    entryCostUsd: number;
    source: "warehouse-stock" | "import-fallback" | "inventory-entry";
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    notes: string;
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
    reason: string;
    entryGroupId: string;
    entryWarehouseId: string;
    entryWarehouseName: string;
    entryUsdToAwgRate: number;
    entryCostUsd: number;
    source: "warehouse-stock" | "import-fallback" | "inventory-entry";
} & import("mongoose").DefaultTimestampProps & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    notes: string;
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
    reason: string;
    entryGroupId: string;
    entryWarehouseId: string;
    entryWarehouseName: string;
    entryUsdToAwgRate: number;
    entryCostUsd: number;
    source: "warehouse-stock" | "import-fallback" | "inventory-entry";
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    notes: string;
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
    reason: string;
    entryGroupId: string;
    entryWarehouseId: string;
    entryWarehouseName: string;
    entryUsdToAwgRate: number;
    entryCostUsd: number;
    source: "warehouse-stock" | "import-fallback" | "inventory-entry";
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    notes: string;
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
    reason: string;
    entryGroupId: string;
    entryWarehouseId: string;
    entryWarehouseName: string;
    entryUsdToAwgRate: number;
    entryCostUsd: number;
    source: "warehouse-stock" | "import-fallback" | "inventory-entry";
} & import("mongoose").DefaultTimestampProps> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=inventory-adjustment.model.d.ts.map