'use client';

/** Print the invoice (or save it as a PDF from the print dialog). Hidden on paper. */
export function PrintButton() {
  return <button type="button" dir="rtl" lang="fa" onClick={() => window.print()}>چاپ یا ذخیرهٔ PDF</button>;
}
