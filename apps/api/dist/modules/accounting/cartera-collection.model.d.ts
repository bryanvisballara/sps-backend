import { Schema } from "mongoose";
export declare const CarteraCollection: import("mongoose").Model<{
    active: boolean;
    amountAwg: number;
    carteraEntryId: string;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo";
    collectedAt: NativeDate;
    notes?: string | null | undefined;
    relatedOrderId?: string | null | undefined;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    active: boolean;
    amountAwg: number;
    carteraEntryId: string;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo";
    collectedAt: NativeDate;
    notes?: string | null | undefined;
    relatedOrderId?: string | null | undefined;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    active: boolean;
    amountAwg: number;
    carteraEntryId: string;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo";
    collectedAt: NativeDate;
    notes?: string | null | undefined;
    relatedOrderId?: string | null | undefined;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    active: boolean;
    amountAwg: number;
    carteraEntryId: string;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo";
    collectedAt: NativeDate;
    notes?: string | null | undefined;
    relatedOrderId?: string | null | undefined;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    active: boolean;
    amountAwg: number;
    carteraEntryId: string;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo";
    collectedAt: NativeDate;
    notes?: string | null | undefined;
    relatedOrderId?: string | null | undefined;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    active: boolean;
    amountAwg: number;
    carteraEntryId: string;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo";
    collectedAt: NativeDate;
    notes?: string | null | undefined;
    relatedOrderId?: string | null | undefined;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=cartera-collection.model.d.ts.map