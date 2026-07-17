/** Exact QuickBooks Online payment terms (Lista de condiciones). */
export declare const QUICKBOOKS_PAYMENT_TERMS: readonly ["Pago a la recepción del servicio", "Pago arriendo", "Pago en 15 días", "Pago en 30 días", "Pago en 60 días"];
export type QuickBooksPaymentTerm = (typeof QUICKBOOKS_PAYMENT_TERMS)[number];
export declare const DEFAULT_QUICKBOOKS_PAYMENT_TERM: QuickBooksPaymentTerm;
export declare function isQuickBooksPaymentTerm(value: string): value is QuickBooksPaymentTerm;
export declare function normalizeQuickBooksPaymentTerm(value: unknown): QuickBooksPaymentTerm;
/** Maps client payment terms to cartera invoice payment method used in warehouse billing. */
export declare function paymentTermToCarteraMethod(term: string): "credito" | "efectivo";
export declare function resolveDueDateKeyForPaymentTerm(invoiceDateKey: string, term: string, addDaysToDateKey: (dateKey: string, days: number) => string): string;
//# sourceMappingURL=quickbooks-payment-terms.d.ts.map