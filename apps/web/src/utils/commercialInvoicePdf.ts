import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const COMPANY = {
  legalName: "SPS TRADING ENTERPRISE VBA",
  addressLine1: "OOSTRAT 4",
  addressLine2: "Oranjestad, Aruba  0000",
  phone: "+297 6993103",
  email: "comercial@spsenterprise.com",
  bankLine: "SPS TRADING ENTERPRISE  -  ACCOUNT NUMBER: 7700000100370846 BUSS - ROYAL BANK",
} as const;

export type CommercialInvoiceLineItem = {
  productLabel: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
};

export type CommercialInvoiceDocumentInput = {
  documentKind: "invoice" | "dispatch";
  invoiceNumber?: number | null;
  invoiceDate: Date;
  billToName: string;
  billToLocation: string;
  lineItems: CommercialInvoiceLineItem[];
  totalAmount: number;
};

function formatInvoiceDate(value: Date) {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const year = value.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatInvoiceAmount(value: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatInvoiceQuantity(value: number) {
  const quantity = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(quantity);
}

function sanitizePdfFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function loadImageForPdf(imageUrl: string) {
  try {
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("No fue posible leer la imagen."));
      reader.readAsDataURL(blob);
    });
    const format = blob.type.includes("png") ? "PNG" : "JPEG";

    return { dataUrl, format: format as "PNG" | "JPEG" };
  } catch {
    return null;
  }
}

export async function buildCommercialInvoicePdf(input: CommercialInvoiceDocumentInput) {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 40;
  const isDispatch = input.documentKind === "dispatch";
  const logoImage = await loadImageForPdf("/invoice-logo.png");

  const drawPage = (pageNumber: number, totalPages: number) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(60, 60, 60);
    pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, 28, { align: "right" });

    if (logoImage) {
      pdf.addImage(logoImage.dataUrl, logoImage.format, margin, 44, 164, 48);
    }

    pdf.setTextColor(17, 17, 17);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.text(COMPANY.legalName, pageWidth - margin, 58, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(COMPANY.addressLine1, pageWidth - margin, 72, { align: "right" });
    pdf.text(COMPANY.addressLine2, pageWidth - margin, 84, { align: "right" });
    pdf.text(COMPANY.phone, pageWidth - margin, 96, { align: "right" });
    pdf.text(COMPANY.email, pageWidth - margin, 108, { align: "right" });

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text("INVOICE", margin, 116);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("BILL TO", margin, 132);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(input.billToName.toUpperCase(), margin, 146);

    const normalizedBillToName = input.billToName.trim().toUpperCase();
    const normalizedBillToLocation = input.billToLocation.trim().toUpperCase();

    if (normalizedBillToLocation && normalizedBillToLocation !== normalizedBillToName) {
      pdf.text(normalizedBillToLocation, margin, 160);
    }

    const documentNumber = input.invoiceNumber ? String(input.invoiceNumber) : "—";
    const invoiceValue = documentNumber === "—" ? "—" : `#${documentNumber}`;
    const dateValue = `#${formatInvoiceDate(input.invoiceDate)}`;
    const metadataRightX = pageWidth - margin;
    const metadataGapPt = 28;
    const metadataValueWidth = Math.max(
      pdf.getTextWidth(invoiceValue),
      pdf.getTextWidth(dateValue),
    );
    const metadataLabelX = metadataRightX - metadataValueWidth - metadataGapPt;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("INVOICE", metadataLabelX, 132, { align: "right" });
    pdf.text(invoiceValue, metadataRightX, 132, { align: "right" });
    pdf.text("DATE", metadataLabelX, 146, { align: "right" });
    pdf.text(dateValue, metadataRightX, 146, { align: "right" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(60, 60, 60);
    pdf.text(COMPANY.bankLine, pageWidth / 2, pageHeight - 24, { align: "center" });
  };

  const tableBody = input.lineItems.map((item) => [
    item.productLabel.toUpperCase(),
    item.description.toUpperCase(),
    formatInvoiceQuantity(item.quantity),
    formatInvoiceAmount(item.rate),
    formatInvoiceAmount(item.amount),
  ]);

  autoTable(pdf, {
    startY: 178,
    margin: { top: 178, left: margin, right: margin, bottom: 56 },
    head: [["PRODUCT", "DESCRIPTION", "QTY", "RATE", "AMOUNT"]],
    body: tableBody,
    showHead: "everyPage",
    styles: {
      font: "helvetica",
      fontSize: 8.4,
      cellPadding: 4,
      overflow: "linebreak",
      valign: "top",
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [17, 17, 17],
      fontStyle: "bold",
      lineWidth: 0.2,
      lineColor: [17, 17, 17],
    },
    alternateRowStyles: {
      fillColor: [243, 244, 246],
    },
    columnStyles: {
      0: { cellWidth: 210, overflow: "ellipsize" },
      1: { cellWidth: 150 },
      2: { cellWidth: 42, halign: "right" },
      3: { cellWidth: 52, halign: "right" },
      4: { cellWidth: 62, halign: "right" },
    },
    theme: "plain",
    didDrawPage: () => {
      drawPage(pdf.getCurrentPageInfo().pageNumber, pdf.getNumberOfPages());
    },
  });

  const finalY = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 178;
  const footerY = Math.min(finalY + 28, pageHeight - 48);
  const footerLabel = input.invoiceNumber ? "TOTAL AWG" : "REFERENCE TOTAL AWG";

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(17, 17, 17);
  pdf.text("Thank you for choosing us", margin, footerY);
  pdf.setFont("helvetica", "bold");
  pdf.text(`${footerLabel} ${formatInvoiceAmount(input.totalAmount)}`, pageWidth - margin, footerY, { align: "right" });

  const dateLabel = formatInvoiceDate(input.invoiceDate).replace(/\//g, "-");
  const fileName = sanitizePdfFileName(
    input.invoiceNumber
      ? `invoice-${input.invoiceNumber}-${input.billToName}`
      : isDispatch
        ? `dispatch-${input.billToName}-${dateLabel}`
        : `invoice-${input.billToName}-${dateLabel}`,
  ) || (input.invoiceNumber ? "invoice" : "dispatch");

  return { pdf, fileName };
}
