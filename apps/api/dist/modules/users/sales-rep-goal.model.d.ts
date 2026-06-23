import { Schema } from "mongoose";
export declare const SalesRepGoal: import("mongoose").Model<{
    active: boolean;
    salesRepId: string;
    weeklyGoalAwg: number;
    monthlyGoalAwg: number;
    weeklyBonusAwg: number;
    monthlyBonusAwg: number;
} & import("mongoose").DefaultTimestampProps, {}, {}, {}, import("mongoose").Document<unknown, {}, {
    active: boolean;
    salesRepId: string;
    weeklyGoalAwg: number;
    monthlyGoalAwg: number;
    weeklyBonusAwg: number;
    monthlyBonusAwg: number;
} & import("mongoose").DefaultTimestampProps, {}, {
    timestamps: true;
}> & {
    active: boolean;
    salesRepId: string;
    weeklyGoalAwg: number;
    monthlyGoalAwg: number;
    weeklyBonusAwg: number;
    monthlyBonusAwg: number;
} & import("mongoose").DefaultTimestampProps & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}, Schema<any, import("mongoose").Model<any, any, any, any, any, any>, {}, {}, {}, {}, {
    timestamps: true;
}, {
    active: boolean;
    salesRepId: string;
    weeklyGoalAwg: number;
    monthlyGoalAwg: number;
    weeklyBonusAwg: number;
    monthlyBonusAwg: number;
} & import("mongoose").DefaultTimestampProps, import("mongoose").Document<unknown, {}, import("mongoose").FlatRecord<{
    active: boolean;
    salesRepId: string;
    weeklyGoalAwg: number;
    monthlyGoalAwg: number;
    weeklyBonusAwg: number;
    monthlyBonusAwg: number;
} & import("mongoose").DefaultTimestampProps>, {}, import("mongoose").MergeType<import("mongoose").DefaultSchemaOptions, {
    timestamps: true;
}>> & import("mongoose").FlatRecord<{
    active: boolean;
    salesRepId: string;
    weeklyGoalAwg: number;
    monthlyGoalAwg: number;
    weeklyBonusAwg: number;
    monthlyBonusAwg: number;
} & import("mongoose").DefaultTimestampProps> & {
    _id: import("mongoose").Types.ObjectId;
} & {
    __v: number;
}>>;
//# sourceMappingURL=sales-rep-goal.model.d.ts.map