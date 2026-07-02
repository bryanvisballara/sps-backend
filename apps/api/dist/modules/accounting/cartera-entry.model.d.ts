import { Schema } from "mongoose";
export declare const CarteraEntry: import("mongoose").Model<{
    active: boolean;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    orderId: string;
    invoiceAmountAwg: number;
    collectedAmountAwg: number;
    outstandingAmountAwg: number;
    invoicedAt: NativeDate;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeId?: string | null | undefined;
    routeName?: string | null | undefined;
    routeDay?: string | null | undefined;
    deliveryZone?: string | null | undefined;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    active: boolean;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    orderId: string;
    invoiceAmountAwg: number;
    collectedAmountAwg: number;
    outstandingAmountAwg: number;
    invoicedAt: NativeDate;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeId?: string | null | undefined;
    routeName?: string | null | undefined;
    routeDay?: string | null | undefined;
    deliveryZone?: string | null | undefined;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    active: boolean;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    orderId: string;
    invoiceAmountAwg: number;
    collectedAmountAwg: number;
    outstandingAmountAwg: number;
    invoicedAt: NativeDate;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeId?: string | null | undefined;
    routeName?: string | null | undefined;
    routeDay?: string | null | undefined;
    deliveryZone?: string | null | undefined;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    active: boolean;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    orderId: string;
    invoiceAmountAwg: number;
    collectedAmountAwg: number;
    outstandingAmountAwg: number;
    invoicedAt: NativeDate;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeId?: string | null | undefined;
    routeName?: string | null | undefined;
    routeDay?: string | null | undefined;
    deliveryZone?: string | null | undefined;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    active: boolean;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    orderId: string;
    invoiceAmountAwg: number;
    collectedAmountAwg: number;
    outstandingAmountAwg: number;
    invoicedAt: NativeDate;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeId?: string | null | undefined;
    routeName?: string | null | undefined;
    routeDay?: string | null | undefined;
    deliveryZone?: string | null | undefined;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    active: boolean;
    storeId: string;
    storeName: string;
    paymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    orderId: string;
    invoiceAmountAwg: number;
    collectedAmountAwg: number;
    outstandingAmountAwg: number;
    invoicedAt: NativeDate;
    salesRepId?: string | null | undefined;
    salesRepName?: string | null | undefined;
    routeId?: string | null | undefined;
    routeName?: string | null | undefined;
    routeDay?: string | null | undefined;
    deliveryZone?: string | null | undefined;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=cartera-entry.model.d.ts.map