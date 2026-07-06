import { Schema } from "mongoose";
export declare const InvoiceChangeRequest: import("mongoose").Model<{
    status: "pending" | "approved" | "rejected";
    storeId: string;
    storeName: string;
    salesRepName: string;
    orderId: string;
    routeName: string;
    requestedByUserId: string;
    requestedByUserName: string;
    requestedByRole: string;
    requestNotes: string;
    reviewedByUserId: string;
    reviewedByUserName: string;
    reviewNotes: string;
    currentItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    proposedItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    currentInvoiceAmountAwg: number;
    proposedInvoiceAmountAwg: number;
    currentPaymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    invoiceNumber?: number | null | undefined;
    proposedInvoiceNumber?: number | null | undefined;
    reviewedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    status: "pending" | "approved" | "rejected";
    storeId: string;
    storeName: string;
    salesRepName: string;
    orderId: string;
    routeName: string;
    requestedByUserId: string;
    requestedByUserName: string;
    requestedByRole: string;
    requestNotes: string;
    reviewedByUserId: string;
    reviewedByUserName: string;
    reviewNotes: string;
    currentItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    proposedItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    currentInvoiceAmountAwg: number;
    proposedInvoiceAmountAwg: number;
    currentPaymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    invoiceNumber?: number | null | undefined;
    proposedInvoiceNumber?: number | null | undefined;
    reviewedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    status: "pending" | "approved" | "rejected";
    storeId: string;
    storeName: string;
    salesRepName: string;
    orderId: string;
    routeName: string;
    requestedByUserId: string;
    requestedByUserName: string;
    requestedByRole: string;
    requestNotes: string;
    reviewedByUserId: string;
    reviewedByUserName: string;
    reviewNotes: string;
    currentItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    proposedItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    currentInvoiceAmountAwg: number;
    proposedInvoiceAmountAwg: number;
    currentPaymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    invoiceNumber?: number | null | undefined;
    proposedInvoiceNumber?: number | null | undefined;
    reviewedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    status: "pending" | "approved" | "rejected";
    storeId: string;
    storeName: string;
    salesRepName: string;
    orderId: string;
    routeName: string;
    requestedByUserId: string;
    requestedByUserName: string;
    requestedByRole: string;
    requestNotes: string;
    reviewedByUserId: string;
    reviewedByUserName: string;
    reviewNotes: string;
    currentItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    proposedItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    currentInvoiceAmountAwg: number;
    proposedInvoiceAmountAwg: number;
    currentPaymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    invoiceNumber?: number | null | undefined;
    proposedInvoiceNumber?: number | null | undefined;
    reviewedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    status: "pending" | "approved" | "rejected";
    storeId: string;
    storeName: string;
    salesRepName: string;
    orderId: string;
    routeName: string;
    requestedByUserId: string;
    requestedByUserName: string;
    requestedByRole: string;
    requestNotes: string;
    reviewedByUserId: string;
    reviewedByUserName: string;
    reviewNotes: string;
    currentItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    proposedItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    currentInvoiceAmountAwg: number;
    proposedInvoiceAmountAwg: number;
    currentPaymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    invoiceNumber?: number | null | undefined;
    proposedInvoiceNumber?: number | null | undefined;
    reviewedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    status: "pending" | "approved" | "rejected";
    storeId: string;
    storeName: string;
    salesRepName: string;
    orderId: string;
    routeName: string;
    requestedByUserId: string;
    requestedByUserName: string;
    requestedByRole: string;
    requestNotes: string;
    reviewedByUserId: string;
    reviewedByUserName: string;
    reviewNotes: string;
    currentItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    proposedItems: import("mongoose").Types.DocumentArray<{
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }> & {
        notes: string;
        productId: string;
        productName: string;
        productSku: string;
        quantity: number;
    }>;
    currentInvoiceAmountAwg: number;
    proposedInvoiceAmountAwg: number;
    currentPaymentMethod: "datafono" | "transferencia" | "efectivo" | "credito";
    invoiceNumber?: number | null | undefined;
    proposedInvoiceNumber?: number | null | undefined;
    reviewedAt?: NativeDate | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=invoice-change-request.model.d.ts.map