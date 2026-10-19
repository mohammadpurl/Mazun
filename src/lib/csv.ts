/** One CSV cell. Quotes when needed and neutralises spreadsheet formulas (=, +, -, @) that a
 *  customer could type into a name or note, so opening the export in Excel cannot run anything. */
export function csvCell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV with a UTF-8 BOM so Excel shows Persian and Arabic correctly. */
export const toCsv = (rows: unknown[][]) => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
