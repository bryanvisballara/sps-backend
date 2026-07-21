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
    .replace(/\u00B7/g, "-")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/[^\u0000-\u00FF]/g, "?")
    .trim();
}

/** Always quote data fields so commas inside product names never shift columns. */
export function escapeQuickBooksCsvField(value: string | number): string {
  const raw = typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : sanitizeQuickBooksCsvText(value);

  return `"${raw.replace(/"/g, "\"\"")}"`;
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
