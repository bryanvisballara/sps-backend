import { Schema, Types } from "mongoose";
export declare const CatalogClientPricing: import("mongoose").Model<{
    active: boolean;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
    }>;
    catalogId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    catalogName: string;
    clientId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    clientName: string;
    markupPercent: number;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    active: boolean;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
    }>;
    catalogId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    catalogName: string;
    clientId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    clientName: string;
    markupPercent: number;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    active: boolean;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
    }>;
    catalogId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    catalogName: string;
    clientId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    clientName: string;
    markupPercent: number;
} & import("mongoose").DefaultTimestampProps & {
    _id: Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    active: boolean;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
    }>;
    catalogId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    catalogName: string;
    clientId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    clientName: string;
    markupPercent: number;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    active: boolean;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
    }>;
    catalogId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    catalogName: string;
    clientId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    clientName: string;
    markupPercent: number;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    active: boolean;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
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
        productName: string;
        productSku: string;
        stockRowId: string;
        lotName: string;
        cost: number;
        salePrice: number;
    }>;
    catalogId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    catalogName: string;
    clientId: {
        prototype?: Types.ObjectId | null | undefined;
        cacheHexString?: unknown;
        generate?: {} | null | undefined;
        createFromTime?: {} | null | undefined;
        createFromHexString?: {} | null | undefined;
        createFromBase64?: {} | null | undefined;
        isValid?: {} | null | undefined;
    };
    clientName: string;
    markupPercent: number;
} & import("mongoose").DefaultTimestampProps> & {
    _id: Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=catalog-client-pricing.model.d.ts.map