/**
 * QuickBooks Online (Spanish / Windows) reads invoice CSV imports as a
 * single-byte ANSI code page. UTF-8 multi-byte accents (ó, ñ) are misread
 * and fail Terms / Item name matching. Export Windows-1252-compatible bytes.
 */
export function sanitizeQuickBooksCsvText(value) {
    return String(value ?? "")
        .normalize("NFC")
        .replace(/\uFFFD/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .replace(/\u00B7/g, "-")
        .replace(/\r\n|\r|\n/g, " ")
        .replace(/[^\u0000-\u00FF]/g, "?")
        .trim();
}
/**
 * Quote only when needed. QBO treats quoted dates like `"17/07/2026"` as empty
 * InvoiceDate/DueDate; leave dates and amounts bare, and never emit `""` for blanks.
 */
export function escapeQuickBooksCsvField(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return String(value);
    }
    const raw = sanitizeQuickBooksCsvText(value);
    if (!raw) {
        return "";
    }
    if (/[",\n\r]/.test(raw)) {
        return `"${raw.replace(/"/g, "\"\"")}"`;
    }
    return raw;
}
export function formatQuickBooksCsvRow(values) {
    return values.map((value) => escapeQuickBooksCsvField(value)).join(",");
}
/** Keep header names unquoted to match the Intuit import template exactly. */
export function formatQuickBooksCsvHeaderRow(headers) {
    return headers.join(",");
}
export function joinQuickBooksCsvRows(rows) {
    return `${rows.join("\r\n")}\r\n`;
}
/** Encode Unicode CSV text as Windows-1252 / Latin-1 bytes for QBO import. */
export function encodeQuickBooksCsvBuffer(csv) {
    let encoded = "";
    for (const ch of csv) {
        const code = ch.codePointAt(0) ?? 0;
        encoded += code <= 0xff ? ch : "?";
    }
    return Buffer.from(encoded, "latin1");
}
//# sourceMappingURL=quickbooks-csv.js.map