/**
 * QuickBooks Online (Spanish / Windows) reads invoice CSV imports as a
 * single-byte ANSI code page. UTF-8 multi-byte accents (ó, ñ) are misread
 * and fail Terms / Item name matching. Export Windows-1252-compatible bytes.
 */
export declare function sanitizeQuickBooksCsvText(value: unknown): string;
/**
 * Quote only when needed. QBO treats quoted dates like `"17/07/2026"` as empty
 * InvoiceDate/DueDate; leave dates and amounts bare, and never emit `""` for blanks.
 *
 * Always quote values that contain an apostrophe. Some QBO/locale CSV parsers treat
 * `'` as a quote delimiter, which breaks customers like `PIZZA BOB'S` into a bad name.
 */
export declare function escapeQuickBooksCsvField(value: string | number): string;
export declare function formatQuickBooksCsvRow(values: Array<string | number>): string;
/** Keep header names unquoted to match the Intuit import template exactly. */
export declare function formatQuickBooksCsvHeaderRow(headers: readonly string[]): string;
export declare function joinQuickBooksCsvRows(rows: string[]): string;
/** Encode Unicode CSV text as Windows-1252 / Latin-1 bytes for QBO import. */
export declare function encodeQuickBooksCsvBuffer(csv: string): Buffer;
//# sourceMappingURL=quickbooks-csv.d.ts.map