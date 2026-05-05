import { Schema } from "mongoose";
export declare const LogisticsExpense: import("mongoose").Model<{
    name: string;
    category: "other" | "fuel" | "maintenance" | "unforeseen" | "delivery" | "tolls";
    active: boolean;
    amountAwg: number;
    expenseDate: NativeDate;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    name: string;
    category: "other" | "fuel" | "maintenance" | "unforeseen" | "delivery" | "tolls";
    active: boolean;
    amountAwg: number;
    expenseDate: NativeDate;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    name: string;
    category: "other" | "fuel" | "maintenance" | "unforeseen" | "delivery" | "tolls";
    active: boolean;
    amountAwg: number;
    expenseDate: NativeDate;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    name: string;
    category: "other" | "fuel" | "maintenance" | "unforeseen" | "delivery" | "tolls";
    active: boolean;
    amountAwg: number;
    expenseDate: NativeDate;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    name: string;
    category: "other" | "fuel" | "maintenance" | "unforeseen" | "delivery" | "tolls";
    active: boolean;
    amountAwg: number;
    expenseDate: NativeDate;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    name: string;
    category: "other" | "fuel" | "maintenance" | "unforeseen" | "delivery" | "tolls";
    active: boolean;
    amountAwg: number;
    expenseDate: NativeDate;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=logistics-expense.model.d.ts.map