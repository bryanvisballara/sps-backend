/** Exact QuickBooks Online payment terms (Lista de condiciones). */
export const QUICKBOOKS_PAYMENT_TERMS = [
    "Pago a la recepción del servicio",
    "Pago arriendo",
    "Pago en 15 días",
    "Pago en 30 días",
    "Pago en 60 días",
];
export const DEFAULT_QUICKBOOKS_PAYMENT_TERM = "Pago a la recepción del servicio";
const QUICKBOOKS_PAYMENT_TERM_SET = new Set(QUICKBOOKS_PAYMENT_TERMS);
const LEGACY_PAYMENT_METHOD_TO_TERM = {
    efectivo: "Pago a la recepción del servicio",
    transferencia: "Pago a la recepción del servicio",
    datafono: "Pago a la recepción del servicio",
    credito: "Pago en 30 días",
};
export function isQuickBooksPaymentTerm(value) {
    return QUICKBOOKS_PAYMENT_TERM_SET.has(value);
}
export function normalizeQuickBooksPaymentTerm(value) {
    const raw = typeof value === "string" ? value.trim() : "";
    if (isQuickBooksPaymentTerm(raw)) {
        return raw;
    }
    const legacy = LEGACY_PAYMENT_METHOD_TO_TERM[raw.toLowerCase()];
    if (legacy) {
        return legacy;
    }
    return DEFAULT_QUICKBOOKS_PAYMENT_TERM;
}
/** Maps client payment terms to cartera invoice payment method used in warehouse billing. */
export function paymentTermToCarteraMethod(term) {
    const normalized = normalizeQuickBooksPaymentTerm(term);
    return normalized === "Pago a la recepción del servicio" ? "efectivo" : "credito";
}
export function resolveDueDateKeyForPaymentTerm(invoiceDateKey, term, addDaysToDateKey) {
    const normalized = normalizeQuickBooksPaymentTerm(term);
    if (normalized === "Pago a la recepción del servicio") {
        return invoiceDateKey;
    }
    if (normalized === "Pago en 15 días") {
        return addDaysToDateKey(invoiceDateKey, 15);
    }
    if (normalized === "Pago en 30 días") {
        return addDaysToDateKey(invoiceDateKey, 30);
    }
    if (normalized === "Pago en 60 días") {
        return addDaysToDateKey(invoiceDateKey, 60);
    }
    // Pago arriendo: vencimiento el día 25 (según lista de condiciones QBO)
    const [year, month, day] = invoiceDateKey.split("-").map(Number);
    const invoiceDay = day || 1;
    let dueYear = year;
    let dueMonth = month;
    if (invoiceDay > 25) {
        dueMonth += 1;
        if (dueMonth > 12) {
            dueMonth = 1;
            dueYear += 1;
        }
    }
    return `${dueYear}-${String(dueMonth).padStart(2, "0")}-25`;
}
//# sourceMappingURL=quickbooks-payment-terms.js.map