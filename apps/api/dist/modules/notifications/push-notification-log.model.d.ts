import { Schema } from "mongoose";
export declare const PushNotificationLog: import("mongoose").Model<{
    key: string;
    kind: string;
    sentAt: NativeDate;
}, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    key: string;
    kind: string;
    sentAt: NativeDate;
}, {}, {
    timestamps: false;
}> & {
    key: string;
    kind: string;
    sentAt: NativeDate;
} & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: false;
}, {
    key: string;
    kind: string;
    sentAt: NativeDate;
}, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    key: string;
    kind: string;
    sentAt: NativeDate;
}>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: false;
}>> & import("mongoose").FlatRecord<{
    key: string;
    kind: string;
    sentAt: NativeDate;
}> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=push-notification-log.model.d.ts.map