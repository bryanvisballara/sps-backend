/**
 * QuickBooks Online (Spanish / Windows) reads invoice CSV imports as a
 * single-byte ANSI code page. UTF-8 multi-byte accents (ó, ñ) are misread
 * and fail Terms / Item name matching. Export Windows-1252-compatible bytes.
 */
/**
 * Windows-1252 byte 0x92 (RIGHT SINGLE QUOTATION MARK). Written via latin1 so
 * the file byte is 0x92; QBO/Windows then display it as a curly apostrophe.
 * ASCII `'` (U+0027) breaks QBO CSV parsing and customer matching.
 */
const WINDOWS1252_APOSTROPHE = "\x92";
/** Map Unicode punctuation that is missing from ISO-8859-1 but present in CP1252. */
const WINDOWS1252_EXTRA = {
    0x20ac: 0x80, // €
    0x201a: 0x82, // ‚
    0x0192: 0x83, // ƒ
    0x201e: 0x84, // „
    0x2026: 0x85, // …
    0x2020: 0x86, // †
    0x2021: 0x87, // ‡
    0x02c6: 0x88, // ˆ
    0x2030: 0x89, // ‰
    0x0160: 0x8a, // Š
    0x2039: 0x8b, // ‹
    0x0152: 0x8c, // Œ
    0x017d: 0x8e, // Ž
    0x2018: 0x91, // ‘
    0x2019: 0x92, // ’
    0x201c: 0x93, // “
    0x201d: 0x94, // ”
    0x2022: 0x95, // •
    0x2013: 0x96, // –
    0x2014: 0x97, // —
    0x02dc: 0x98, // ˜
    0x2122: 0x99, // ™
    0x0161: 0x9a, // š
    0x203a: 0x9b, // ›
    0x0153: 0x9c, // œ
    0x017e: 0x9e, // ž
    0x0178: 0x9f, // Ÿ
};
export function sanitizeQuickBooksCsvText(value) {
    return String(value ?? "")
        .normalize("NFC")
        .replace(/\uFFFD/g, "")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        // QBO rejects ASCII apostrophe (U+0027) on CSV import; use CP1252 curly form.
        // Also normalize Spanish acute (´) and Unicode quotes to that same byte.
        .replace(/['\u00B4\u2018\u2019\u2032]/g, WINDOWS1252_APOSTROPHE)
        .replace(/\u00B7/g, "-")
        .replace(/\r\n|\r|\n/g, " ")
        .replace(/[ \t]+/g, " ")
        .replace(/[^\u0000-\u00FF]/g, "?")
        .trim();
}
/**
 * Quote only when needed. QBO treats quoted dates like `"17/07/2026"` as empty
 * InvoiceDate/DueDate; leave dates and amounts bare, and never emit `""` for blanks.
 *
 * Do not emit ASCII apostrophes — sanitize replaces them with CP1252 0x92 so the
 * CSV parser never treats `'` as a field delimiter (customers like JOHNSON'S).
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
/** Encode Unicode CSV text as Windows-1252 bytes for QBO import. */
export function encodeQuickBooksCsvBuffer(csv) {
    const bytes = Buffer.alloc(csv.length);
    let offset = 0;
    for (const ch of csv) {
        const code = ch.codePointAt(0) ?? 0;
        if (code <= 0xff) {
            bytes[offset++] = code;
            continue;
        }
        const mapped = WINDOWS1252_EXTRA[code];
        bytes[offset++] = mapped ?? 0x3f; // "?"
    }
    return bytes.subarray(0, offset);
}
//# sourceMappingURL=quickbooks-csv.js.map