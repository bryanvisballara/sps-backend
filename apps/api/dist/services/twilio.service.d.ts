export declare function normalizePhoneForWhatsApp(value: unknown): string;
export declare function resolveClientWhatsappNumber(client: {
    phone?: unknown;
    phoneCountryCode?: unknown;
}): string;
export declare function assertTwilioWhatsAppConfigured(): {
    accountSid: string;
    fromNumber: string;
};
export declare function buildWhatsAppContactLink(value: unknown): string;
export declare function getBusinessWhatsAppContact(): {
    number: string;
    link: string;
};
export declare function renderCatalogWhatsappMessage(template: string, values: {
    clientName: string;
    catalogName: string;
    fileName: string;
}): string;
export declare function buildInboundWhatsappAutoReplyMessage(): string;
export declare function createTwilioClient(): import("twilio/lib/rest/Twilio.js");
type SendWhatsAppMessageInput = {
    to: string;
    body: string;
    mediaUrl?: string[];
};
export declare function sendWhatsAppMessage(input: SendWhatsAppMessageInput): Promise<import("twilio/lib/rest/api/v2010/account/message.js").MessageInstance>;
export {};
//# sourceMappingURL=twilio.service.d.ts.map