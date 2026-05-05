import { Schema } from "mongoose";
export declare const User: import("mongoose").Model<{
    name: string;
    active: boolean;
    email: string;
    password: string;
    role: "sales-rep-aruba" | "warehouse-aruba" | "colombia-ops" | "management";
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    name: string;
    active: boolean;
    email: string;
    password: string;
    role: "sales-rep-aruba" | "warehouse-aruba" | "colombia-ops" | "management";
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    name: string;
    active: boolean;
    email: string;
    password: string;
    role: "sales-rep-aruba" | "warehouse-aruba" | "colombia-ops" | "management";
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    name: string;
    active: boolean;
    email: string;
    password: string;
    role: "sales-rep-aruba" | "warehouse-aruba" | "colombia-ops" | "management";
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    name: string;
    active: boolean;
    email: string;
    password: string;
    role: "sales-rep-aruba" | "warehouse-aruba" | "colombia-ops" | "management";
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    name: string;
    active: boolean;
    email: string;
    password: string;
    role: "sales-rep-aruba" | "warehouse-aruba" | "colombia-ops" | "management";
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=user.model.d.ts.map