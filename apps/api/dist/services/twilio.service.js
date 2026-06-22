import twilio from "twilio";
import { env } from "../config/env.js";
export function normalizePhoneForWhatsApp(value) {
    const normalizedValue = typeof value === "string" ? value.trim() : "";
    if (!normalizedValue) {
        return "";
    }
    const compactValue = normalizedValue
        .replace(/[\s()-]/g, "")
        .replace(/(?!^)\+/g, "");
    if (!compactValue) {
        return "";
    }
    return compactValue.startsWith("+") ? compactValue : `+${compactValue}`;
}
export function resolveClientWhatsappNumber(client) {
    const storedPhone = typeof client.phone === "string" ? client.phone.trim() : "";
    const normalizedStoredPhone = normalizePhoneForWhatsApp(storedPhone);
    if (normalizedStoredPhone) {
        return normalizedStoredPhone;
    }
    const phoneCountryCode = typeof client.phoneCountryCode === "string" ? client.phoneCountryCode.trim() : "";
    const localPhone = storedPhone.replace(/[^\d]/g, "");
    if (!phoneCountryCode || !localPhone) {
        return "";
    }
    return normalizePhoneForWhatsApp(`${phoneCountryCode}${localPhone}`);
}
export function assertTwilioWhatsAppConfigured() {
    const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
    const authToken = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
    const apiKeySid = env.TWILIO_API_KEY_SID?.trim() ?? "";
    const apiKeySecret = env.TWILIO_API_KEY_SECRET?.trim() ?? "";
    const fromNumber = normalizePhoneForWhatsApp(env.TWILIO_WHATSAPP_FROM_NUMBER);
    if (!accountSid.startsWith("AC")) {
        throw new Error("Configura TWILIO_ACCOUNT_SID (debe iniciar con AC) en Render.");
    }
    const hasAuthToken = authToken.length > 0;
    const hasApiKey = apiKeySid.startsWith("SK") && apiKeySecret.length > 0;
    if (!hasAuthToken && !hasApiKey) {
        throw new Error("Configura TWILIO_AUTH_TOKEN o TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET en Render.");
    }
    if (!fromNumber) {
        throw new Error("Configura TWILIO_WHATSAPP_FROM_NUMBER con el numero de WhatsApp de Twilio.");
    }
    return {
        accountSid,
        fromNumber,
    };
}
export function buildWhatsAppContactLink(value) {
    const normalizedPhone = normalizePhoneForWhatsApp(value).replace(/^\+/, "");
    return normalizedPhone ? `https://wa.me/${normalizedPhone}` : "";
}
export function getBusinessWhatsAppContact() {
    const businessNumber = normalizePhoneForWhatsApp(env.TWILIO_BUSINESS_WHATSAPP_NUMBER);
    return {
        number: businessNumber,
        link: buildWhatsAppContactLink(businessNumber),
    };
}
export function renderCatalogWhatsappMessage(template, values) {
    const businessContact = getBusinessWhatsAppContact();
    const fallbackTemplate = [
        "Hola {{cliente}}, te compartimos el catalogo {{catalogo}} de SPS Trading Enterprises.",
        "",
        "Revisa el PDF adjunto. Para pedidos o consultas, escribenos directamente aqui:",
        "{{whatsapp_link}}",
    ].join("\n");
    const resolvedTemplate = template.trim() || fallbackTemplate;
    return resolvedTemplate
        .replace(/\{\{\s*cliente\s*\}\}/gi, values.clientName)
        .replace(/\{\{\s*catalogo\s*\}\}/gi, values.catalogName)
        .replace(/\{\{\s*archivo\s*\}\}/gi, values.fileName)
        .replace(/\{\{\s*whatsapp\s*\}\}/gi, businessContact.number || "+2976993103")
        .replace(/\{\{\s*whatsapp_link\s*\}\}/gi, businessContact.link || "https://wa.me/2976993103");
}
export function buildInboundWhatsappAutoReplyMessage() {
    const businessContact = getBusinessWhatsAppContact();
    const contactLine = businessContact.link
        ? `${businessContact.link}`
        : businessContact.number;
    return [
        "Gracias por tu mensaje.",
        "Este numero es solo para envio automatico de catalogos SPS.",
        "",
        "Para pedidos, precios o atencion directa, escribenos al WhatsApp principal:",
        contactLine,
    ].join("\n");
}
export function createTwilioClient() {
    const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
    const authToken = env.TWILIO_AUTH_TOKEN?.trim() ?? "";
    const apiKeySid = env.TWILIO_API_KEY_SID?.trim() ?? "";
    const apiKeySecret = env.TWILIO_API_KEY_SECRET?.trim() ?? "";
    if (apiKeySid.startsWith("SK") && apiKeySecret.length > 0) {
        return twilio(apiKeySid, apiKeySecret, { accountSid });
    }
    return twilio(accountSid, authToken);
}
export async function sendWhatsAppMessage(input) {
    const { fromNumber } = assertTwilioWhatsAppConfigured();
    const destinationNumber = normalizePhoneForWhatsApp(input.to);
    if (!destinationNumber) {
        throw new Error("El numero de destino no es valido para WhatsApp.");
    }
    const twilioClient = createTwilioClient();
    return twilioClient.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${destinationNumber}`,
        body: input.body,
        ...(input.mediaUrl && input.mediaUrl.length > 0 ? { mediaUrl: input.mediaUrl } : {}),
    });
}
//# sourceMappingURL=twilio.service.js.map