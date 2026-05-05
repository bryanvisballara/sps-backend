import { Schema } from "mongoose";
export declare const SalesRoute: import("mongoose").Model<{
    code: string;
    name: string;
    active: boolean;
    salesRepName: string;
    salesRepId: string;
    weekStart: NativeDate;
    weekLabel: string;
    days: import("mongoose").Types.DocumentArray<{
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }> & {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }>;
    assignedDays: number;
    plannedStops: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    code: string;
    name: string;
    active: boolean;
    salesRepName: string;
    salesRepId: string;
    weekStart: NativeDate;
    weekLabel: string;
    days: import("mongoose").Types.DocumentArray<{
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }> & {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }>;
    assignedDays: number;
    plannedStops: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    code: string;
    name: string;
    active: boolean;
    salesRepName: string;
    salesRepId: string;
    weekStart: NativeDate;
    weekLabel: string;
    days: import("mongoose").Types.DocumentArray<{
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }> & {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }>;
    assignedDays: number;
    plannedStops: number;
    notes?: string | null | undefined;
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
    salesRepName: string;
    salesRepId: string;
    weekStart: NativeDate;
    weekLabel: string;
    days: import("mongoose").Types.DocumentArray<{
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }> & {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }>;
    assignedDays: number;
    plannedStops: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    code: string;
    name: string;
    active: boolean;
    salesRepName: string;
    salesRepId: string;
    weekStart: NativeDate;
    weekLabel: string;
    days: import("mongoose").Types.DocumentArray<{
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }> & {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }>;
    assignedDays: number;
    plannedStops: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    code: string;
    name: string;
    active: boolean;
    salesRepName: string;
    salesRepId: string;
    weekStart: NativeDate;
    weekLabel: string;
    days: import("mongoose").Types.DocumentArray<{
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }> & {
        day: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
        stores: import("mongoose").Types.DocumentArray<{
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }, import("mongoose").Types.Subdocument<import("bson").ObjectId, any, {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }> & {
            storeName: string;
            storeId: string;
            address?: string | null | undefined;
        }>;
    }>;
    assignedDays: number;
    plannedStops: number;
    notes?: string | null | undefined;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=route.model.d.ts.map