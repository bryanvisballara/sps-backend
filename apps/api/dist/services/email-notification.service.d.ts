type EmailPayload = {
    subject: string;
    text: string;
    html?: string;
};
export declare function isEmailNotificationConfigured(): boolean;
export declare function sendEmailToRoles(roles: string[], payload: EmailPayload): Promise<{
    sent: number;
    skipped: boolean;
    failed?: undefined;
} | {
    sent: number;
    skipped: boolean;
    failed: boolean;
}>;
export {};
//# sourceMappingURL=email-notification.service.d.ts.map