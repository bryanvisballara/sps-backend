import { Schema } from "mongoose";
export declare const PushToken: import("mongoose").Model<{
    active: boolean;
    userId: string;
    fcmToken: string;
    expiresAt: NativeDate;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    active: boolean;
    userId: string;
    fcmToken: string;
    expiresAt: NativeDate;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    active: boolean;
    userId: string;
    fcmToken: string;
    expiresAt: NativeDate;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    active: boolean;
    userId: string;
    fcmToken: string;
    expiresAt: NativeDate;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    active: boolean;
    userId: string;
    fcmToken: string;
    expiresAt: NativeDate;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    active: boolean;
    userId: string;
    fcmToken: string;
    expiresAt: NativeDate;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=push-token.model.d.ts.map