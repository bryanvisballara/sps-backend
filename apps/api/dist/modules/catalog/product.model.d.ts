import { Schema } from "mongoose";
export declare const Product: import("mongoose").Model<{
    name: string;
    category: string;
    active: boolean;
    cost: number;
    variableSalePrice: boolean;
    sku: string;
    supplier: string;
    arubaPurchaseCostUsd: number;
    arubaUsdToAwgRate: number;
    presentation: "kg" | "lb" | "unidad" | "paquete" | "caja";
    productWeightKg: number;
    unitsPerBox: number;
    unitsPerBoxUnit: "kg" | "lb" | "unidad" | "paquete";
    inventoryAlert: number;
    boxLengthCm: number;
    boxWidthCm: number;
    boxHeightCm: number;
    salePrice?: number | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    imageUrl?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    name: string;
    category: string;
    active: boolean;
    cost: number;
    variableSalePrice: boolean;
    sku: string;
    supplier: string;
    arubaPurchaseCostUsd: number;
    arubaUsdToAwgRate: number;
    presentation: "kg" | "lb" | "unidad" | "paquete" | "caja";
    productWeightKg: number;
    unitsPerBox: number;
    unitsPerBoxUnit: "kg" | "lb" | "unidad" | "paquete";
    inventoryAlert: number;
    boxLengthCm: number;
    boxWidthCm: number;
    boxHeightCm: number;
    salePrice?: number | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    imageUrl?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    name: string;
    category: string;
    active: boolean;
    cost: number;
    variableSalePrice: boolean;
    sku: string;
    supplier: string;
    arubaPurchaseCostUsd: number;
    arubaUsdToAwgRate: number;
    presentation: "kg" | "lb" | "unidad" | "paquete" | "caja";
    productWeightKg: number;
    unitsPerBox: number;
    unitsPerBoxUnit: "kg" | "lb" | "unidad" | "paquete";
    inventoryAlert: number;
    boxLengthCm: number;
    boxWidthCm: number;
    boxHeightCm: number;
    salePrice?: number | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    imageUrl?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    name: string;
    category: string;
    active: boolean;
    cost: number;
    variableSalePrice: boolean;
    sku: string;
    supplier: string;
    arubaPurchaseCostUsd: number;
    arubaUsdToAwgRate: number;
    presentation: "kg" | "lb" | "unidad" | "paquete" | "caja";
    productWeightKg: number;
    unitsPerBox: number;
    unitsPerBoxUnit: "kg" | "lb" | "unidad" | "paquete";
    inventoryAlert: number;
    boxLengthCm: number;
    boxWidthCm: number;
    boxHeightCm: number;
    salePrice?: number | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    imageUrl?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    name: string;
    category: string;
    active: boolean;
    cost: number;
    variableSalePrice: boolean;
    sku: string;
    supplier: string;
    arubaPurchaseCostUsd: number;
    arubaUsdToAwgRate: number;
    presentation: "kg" | "lb" | "unidad" | "paquete" | "caja";
    productWeightKg: number;
    unitsPerBox: number;
    unitsPerBoxUnit: "kg" | "lb" | "unidad" | "paquete";
    inventoryAlert: number;
    boxLengthCm: number;
    boxWidthCm: number;
    boxHeightCm: number;
    salePrice?: number | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    imageUrl?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    name: string;
    category: string;
    active: boolean;
    cost: number;
    variableSalePrice: boolean;
    sku: string;
    supplier: string;
    arubaPurchaseCostUsd: number;
    arubaUsdToAwgRate: number;
    presentation: "kg" | "lb" | "unidad" | "paquete" | "caja";
    productWeightKg: number;
    unitsPerBox: number;
    unitsPerBoxUnit: "kg" | "lb" | "unidad" | "paquete";
    inventoryAlert: number;
    boxLengthCm: number;
    boxWidthCm: number;
    boxHeightCm: number;
    salePrice?: number | null | undefined;
    expirationDate?: NativeDate | null | undefined;
    imageUrl?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=product.model.d.ts.map