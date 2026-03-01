export type PrintMode = "invoice" | "receipt" | "a5" | "token" | "list";
import type { Company } from "../types";
import type { PrintTemplateSettings } from "./printSettings";

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const isNarrowPrintMode = (mode: PrintMode) =>
  mode === "receipt" || mode === "token";

export const normalizePrintMode = (
  value: unknown,
  fallback: PrintMode = "invoice"
): PrintMode => {
  const normalized = String(value || "").trim().toLowerCase();
  if (
    normalized === "invoice" ||
    normalized === "receipt" ||
    normalized === "a5" ||
    normalized === "token" ||
    normalized === "list"
  ) {
    return normalized;
  }
  return fallback;
};

export const getPrintPageSize = (mode: PrintMode) => {
  if (isNarrowPrintMode(mode)) return "72mm auto";
  if (mode === "a5") return "148mm auto";
  return "auto";
};

export const getPrintBoxWidth = (mode: PrintMode) => {
  if (isNarrowPrintMode(mode)) return "68mm";
  if (mode === "a5") return "148mm";
  return "190mm";
};

export const getEmbeddedInvoicePrintCss = (mode: PrintMode) => `
@media print {
  @page {
    margin: 0;
    size: ${getPrintPageSize(mode)};
  }
  html, body {
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body * {
    visibility: hidden !important;
  }
  .invoice-print-root,
  .invoice-print-root * {
    visibility: visible !important;
  }
  .invoice-print-root {
    position: fixed !important;
    inset: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    display: block !important;
    overflow: hidden !important;
    background: #fff !important;
    z-index: 999999 !important;
  }
  .print-sheet-a4 {
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    background: #fff !important;
    page-break-after: always;
  }
  .print-sheet-80mm {
    width: 68mm !important;
    max-width: 68mm !important;
    margin: 0 !important;
    box-sizing: border-box !important;
    background: #fff !important;
  }
}
`;

interface PaymentPrintHtmlInput {
  mode: PrintMode;
  modeTitle: string;
  no: string;
  reference?: string;
  date: string;
  partyLabel: string;
  partyName?: string;
  ledgerAmount: number;
  ledgerSide: string;
  amount: number;
  notes?: string;
  company?: Company;
  settings?: Partial<PrintTemplateSettings>;
}

export const buildPaymentPrintHtml = ({
  mode,
  modeTitle,
  no,
  reference,
  date,
  partyLabel,
  partyName,
  ledgerAmount,
  ledgerSide,
  amount,
  notes,
  company,
  settings,
}: PaymentPrintHtmlInput) => {
  const boxWidth = getPrintBoxWidth(mode);
  const bodyPadding = isNarrowPrintMode(mode) ? "0" : "14px";
  const pageSize = getPrintPageSize(mode);

  const showCompanyLogo = settings?.showCompanyLogo !== false;
  const showCompanyAddress = settings?.showCompanyAddress !== false;
  const showTaxId = settings?.showTaxId !== false;
  const showNotes = settings?.showNotes !== false;
  const footerText = String(settings?.footerText || "").trim();
  const companyName = String(company?.name || "AFTAB AUTOS");
  const companyAddress = String(company?.address || "");
  const companyPhone = String(company?.phone || "");
  const companyTax = String(company?.ntn || "");
  const companyLogoUrl = String(company?.logoUrl || "");

  const companyHeaderHtml = `
<div class="company">
  ${
    showCompanyLogo && companyLogoUrl
      ? `<img src="${escapeHtml(companyLogoUrl)}" alt="Company logo" class="logo" />`
      : ""
  }
  <div class="cname">${escapeHtml(companyName)}</div>
  ${
    showCompanyAddress && (companyAddress || companyPhone)
      ? `<div class="cmeta">${escapeHtml(companyAddress)}${companyAddress && companyPhone ? " | " : ""}${escapeHtml(companyPhone)}</div>`
      : ""
  }
  ${
    showTaxId && companyTax
      ? `<div class="cmeta">Tax/NTN: ${escapeHtml(companyTax)}</div>`
      : ""
  }
</div>`;

  return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${escapeHtml(modeTitle)}</title>
<style>
@page{size:${pageSize};margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:${bodyPadding};color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.box{width:${boxWidth};max-width:${boxWidth};margin:0;padding:0 0.5mm}
.company{text-align:center;border-bottom:1px solid #111;padding-bottom:6px;margin-bottom:8px}
.company .logo{height:42px;display:block;margin:0 auto 4px auto;object-fit:contain}
.company .cname{font-weight:800;font-size:14px;letter-spacing:.04em;text-transform:uppercase}
.company .cmeta{font-size:10px;margin-top:2px}
.line{display:flex;justify-content:space-between;margin:4px 0}
.head{font-size:20px;font-weight:700;text-align:center;margin-bottom:8px}
.small{font-size:12px}
.row{border-top:1px solid #ddd;padding-top:8px;margin-top:8px}
.footer{border-top:1px dashed #888;margin-top:10px;padding-top:6px;text-align:center;font-size:10px;font-weight:700}
</style></head>
<body><div class="box">
${companyHeaderHtml}
<div class="head">${escapeHtml(modeTitle)}</div>
<div class="line"><span>No</span><span>${escapeHtml(no)}</span></div>
<div class="line"><span>Reference</span><span>${escapeHtml(reference || "-")}</span></div>
<div class="line"><span>Date</span><span>${escapeHtml(date)}</span></div>
<div class="line"><span>${escapeHtml(partyLabel)}</span><span>${escapeHtml(partyName || "-")}</span></div>
<div class="line"><span>Ledger Balance</span><span>Rs. ${Number(ledgerAmount || 0).toLocaleString()} ${escapeHtml(ledgerSide)}</span></div>
<div class="line"><span>Amount</span><span>Rs. ${Number(amount || 0).toLocaleString()}</span></div>
${showNotes ? `<div class="row small"><strong>Notes:</strong> ${escapeHtml(notes || "-")}</div>` : ""}
${footerText ? `<div class="footer">${escapeHtml(footerText)}</div>` : ""}
</div><script>window.onload=()=>window.print();</script></body></html>`;
};

export const openPrintWindow = (html: string) => {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
};
