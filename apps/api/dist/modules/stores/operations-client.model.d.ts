import { Schema } from "mongoose";
export declare const OperationsClient: import("mongoose").Model<{
    code: string;
    name: string;
    active: boolean;
    address?: string | null | undefined;
    email?: string | null | undefined;
    phoneCountryCode?: string | null | undefined;
    phone?: string | null | undefined;
    managerName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    code: string;
    name: string;
    active: boolean;
    address?: string | null | undefined;
    email?: string | null | undefined;
    phoneCountryCode?: string | null | undefined;
    phone?: string | null | undefined;
    managerName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    code: string;
    name: string;
    active: boolean;
    address?: string | null | undefined;
    email?: string | null | undefined;
    phoneCountryCode?: string | null | undefined;
    phone?: string | null | undefined;
    managerName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    code: string;
    name: string;
    active: boolean;
    address?: string | null | undefined;
    email?: string | null | undefined;
    phoneCountryCode?: string | null | undefined;
    phone?: string | null | undefined;
    managerName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    code: string;
    name: string;
    active: boolean;
    address?: string | null | undefined;
    email?: string | null | undefined;
    phoneCountryCode?: string | null | undefined;
    phone?: string | null | undefined;
    managerName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    code: string;
    name: string;
    active: boolean;
    address?: string | null | undefined;
    email?: string | null | undefined;
    phoneCountryCode?: string | null | undefined;
    phone?: string | null | undefined;
    managerName?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=operations-client.model.d.ts.map