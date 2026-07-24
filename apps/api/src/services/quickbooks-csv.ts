/**
 * QuickBooks Online (Spanish / Windows) reads invoice CSV imports as a
 * single-byte ANSI code page. UTF-8 multi-byte accents (ó, ñ) are misread
 * and fail Terms / Item name matching. Export Windows-1252-compatible bytes.
 */

export function sanitizeQuickBooksCsvText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    // Spanish keyboards often type acute (´) or curly quotes instead of ASCII apostrophe.
    .replace(/[\u00B4\u2018\u2019\u2032]/g, "'")
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
 * Always quote values that contain an apostrophe. Some QBO/locale CSV parsers treat
 * `'` as a quote delimiter, which breaks customers like `PIZZA BOB'S` into a bad name.
 */
export function escapeQuickBooksCsvField(value: string | number): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  const raw = sanitizeQuickBooksCsvText(value);

  if (!raw) {
    return "";
  }

  if (/["',\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }

  return raw;
}

export function formatQuickBooksCsvRow(values: Array<string | number>): string {
  return values.map((value) => escapeQuickBooksCsvField(value)).join(",");
}

/** Keep header names unquoted to match the Intuit import template exactly. */
export function formatQuickBooksCsvHeaderRow(headers: readonly string[]): string {
  return headers.join(",");
}

export function joinQuickBooksCsvRows(rows: string[]): string {
  return `${rows.join("\r\n")}\r\n`;
}

/** Encode Unicode CSV text as Windows-1252 / Latin-1 bytes for QBO import. */
export function encodeQuickBooksCsvBuffer(csv: string): Buffer {
  let encoded = "";

  for (const ch of csv) {
    const code = ch.codePointAt(0) ?? 0;
    encoded += code <= 0xff ? ch : "?";
  }

  return Buffer.from(encoded, "latin1");
}
