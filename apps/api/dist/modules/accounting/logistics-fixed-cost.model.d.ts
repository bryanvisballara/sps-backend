import { Schema } from "mongoose";
export declare const LogisticsFixedCost: import("mongoose").Model<{
    name: string;
    category: "payroll" | "rent" | "utilities" | "administration" | "other";
    frequency: "monthly" | "biweekly" | "weekly" | "annual" | "one-time";
    startDate: NativeDate;
    active: boolean;
    amountAwg: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    name: string;
    category: "payroll" | "rent" | "utilities" | "administration" | "other";
    frequency: "monthly" | "biweekly" | "weekly" | "annual" | "one-time";
    startDate: NativeDate;
    active: boolean;
    amountAwg: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    name: string;
    category: "payroll" | "rent" | "utilities" | "administration" | "other";
    frequency: "monthly" | "biweekly" | "weekly" | "annual" | "one-time";
    startDate: NativeDate;
    active: boolean;
    amountAwg: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    name: string;
    category: "payroll" | "rent" | "utilities" | "administration" | "other";
    frequency: "monthly" | "biweekly" | "weekly" | "annual" | "one-time";
    startDate: NativeDate;
    active: boolean;
    amountAwg: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    name: string;
    category: "payroll" | "rent" | "utilities" | "administration" | "other";
    frequency: "monthly" | "biweekly" | "weekly" | "annual" | "one-time";
    startDate: NativeDate;
    active: boolean;
    amountAwg: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    name: string;
    category: "payroll" | "rent" | "utilities" | "administration" | "other";
    frequency: "monthly" | "biweekly" | "weekly" | "annual" | "one-time";
    startDate: NativeDate;
    active: boolean;
    amountAwg: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=logistics-fixed-cost.model.d.ts.map