type PushPayload = {
    title: string;
    body: string;
    url?: string;
};
export declare function registerPushToken(userId: string, fcmToken: string): Promise<{
    expiresAt: Date;
}>;
export declare function unregisterPushToken(userId: string, fcmToken: string): Promise<void>;
export declare function sendPushToRoles(roles: string[], payload: PushPayload): Promise<{
    sent: number;
    skipped: boolean;
}>;
export declare function sendPushToUser(userId: string, payload: PushPayload): Promise<{
    sent: number;
    skipped: boolean;
}>;
export declare function notifyNewSalesOrder(order: {
    storeName?: string;
    salesRepName?: string;
    _id?: unknown;
}): Promise<void>;
export declare function notifyRouteAssigned(route: {
    salesRepId?: string;
    salesRepName?: string;
    name?: string;
    weekLabel?: string;
}): Promise<void>;
export declare function notifyInventoryAlert(productName: string, sku: string, quantity: number, alertLevel: number): Promise<void>;
export declare function notifyExpiryThreshold(thresholdDays: 60 | 30 | 15, productName: string, sku: string, expirationDate: Date): Promise<void>;
export declare function sendDedupedNotification(key: string, kind: string, send: () => Promise<void>): Promise<boolean>;
export declare function clearNotificationLog(key: string): Promise<void>;
export {};
//# sourceMappingURL=push-notification.service.d.ts.map