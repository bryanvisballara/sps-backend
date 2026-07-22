import { Schema } from "mongoose";
export declare const OrderEditLog: import("mongoose").Model<{
    storeName: string;
    orderId: string;
    source: "contabilidad" | "management" | "seller" | "warehouse" | "system";
    editedByUserId: string;
    editedByUserName: string;
    editedByRole: string;
    action: "update_order" | "update_invoice_number" | "invoice_completed" | "reprint" | "invoice_voided";
    changes: import("mongoose").Types.DocumentArray<{
        before: string;
        after: string;
        field: string;
        summary: string;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        before: string;
        after: string;
        field: string;
        summary: string;
    }> & {
        before: string;
        after: string;
        field: string;
        summary: string;
    }>;
    editedAt: NativeDate;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    storeName: string;
    orderId: string;
    source: "contabilidad" | "management" | "seller" | "warehouse" | "system";
    editedByUserId: string;
    editedByUserName: string;
    editedByRole: string;
    action: "update_order" | "update_invoice_number" | "invoice_completed" | "reprint" | "invoice_voided";
    changes: import("mongoose").Types.DocumentArray<{
        before: string;
        after: string;
        field: string;
        summary: string;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        before: string;
        after: string;
        field: string;
        summary: string;
    }> & {
        before: string;
        after: string;
        field: string;
        summary: string;
    }>;
    editedAt: NativeDate;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    storeName: string;
    orderId: string;
    source: "contabilidad" | "management" | "seller" | "warehouse" | "system";
    editedByUserId: string;
    editedByUserName: string;
    editedByRole: string;
    action: "update_order" | "update_invoice_number" | "invoice_completed" | "reprint" | "invoice_voided";
    changes: import("mongoose").Types.DocumentArray<{
        before: string;
        after: string;
        field: string;
        summary: string;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        before: string;
        after: string;
        field: string;
        summary: string;
    }> & {
        before: string;
        after: string;
        field: string;
        summary: string;
    }>;
    editedAt: NativeDate;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    storeName: string;
    orderId: string;
    source: "contabilidad" | "management" | "seller" | "warehouse" | "system";
    editedByUserId: string;
    editedByUserName: string;
    editedByRole: string;
    action: "update_order" | "update_invoice_number" | "invoice_completed" | "reprint" | "invoice_voided";
    changes: import("mongoose").Types.DocumentArray<{
        before: string;
        after: string;
        field: string;
        summary: string;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        before: string;
        after: string;
        field: string;
        summary: string;
    }> & {
        before: string;
        after: string;
        field: string;
        summary: string;
    }>;
    editedAt: NativeDate;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    storeName: string;
    orderId: string;
    source: "contabilidad" | "management" | "seller" | "warehouse" | "system";
    editedByUserId: string;
    editedByUserName: string;
    editedByRole: string;
    action: "update_order" | "update_invoice_number" | "invoice_completed" | "reprint" | "invoice_voided";
    changes: import("mongoose").Types.DocumentArray<{
        before: string;
        after: string;
        field: string;
        summary: string;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        before: string;
        after: string;
        field: string;
        summary: string;
    }> & {
        before: string;
        after: string;
        field: string;
        summary: string;
    }>;
    editedAt: NativeDate;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    storeName: string;
    orderId: string;
    source: "contabilidad" | "management" | "seller" | "warehouse" | "system";
    editedByUserId: string;
    editedByUserName: string;
    editedByRole: string;
    action: "update_order" | "update_invoice_number" | "invoice_completed" | "reprint" | "invoice_voided";
    changes: import("mongoose").Types.DocumentArray<{
        before: string;
        after: string;
        field: string;
        summary: string;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        before: string;
        after: string;
        field: string;
        summary: string;
    }> & {
        before: string;
        after: string;
        field: string;
        summary: string;
    }>;
    editedAt: NativeDate;
    invoiceNumber?: number | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=order-edit-log.model.d.ts.map