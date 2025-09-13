import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, UserPreferences } from './types';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

// This is a placeholder for a font that supports the required characters.
// jsPDF's default fonts have limited character support. For full unicode,
// you would need to load a custom font file (e.g., a .ttf file) into the virtual filesystem.
// For this example, we'll try to use a standard font and handle potential issues.
const FONT_NAME = 'Helvetica';

// Helper to add a custom font if you have the .ttf file
// async function loadFont(doc: jsPDF) {
//   const font = await fetch('/path/to/your/font.ttf').then(res => res.arrayBuffer());
//   const fontBytes = new Uint8Array(font);
//   doc.addFileToVFS('MyFont.ttf', Buffer.from(fontBytes).toString('base64'));
//   doc.addFont('MyFont.ttf', 'MyFont', 'normal');
//   return 'MyFont';
// }

export const generateInvoicePdf = async (
  invoice: Invoice,
  prefs: UserPreferences,
  t: (key: string, replacements?: Record<string, string | number>) => string
) => {
  const doc = new jsPDF({
    orientation: 'p',
    unit: 'mm',
    format: 'a4',
  });

  // It's crucial to set the font if you need non-ASCII characters.
  // We'll proceed with Helvetica, but a custom font would be more robust.
  try {
    doc.setFont(FONT_NAME);
  } catch (e) {
    console.error("Font could not be set. Characters may not render correctly.", e);
  }
  
  const dateLocale = invoice.language === 'fr' ? fr : enUS;

  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let cursorY = margin;

  const addHeader = () => {
    // Company Logo
    if (prefs.logoDataUrl) {
      try {
        const img = new Image();
        img.src = prefs.logoDataUrl;
        // You might need to adjust width/height based on your logo's aspect ratio
        doc.addImage(img, 'PNG', margin, cursorY, 40, 20);
      } catch (e) {
        console.error("Could not add company logo to PDF.", e);
      }
    }

    // Company Header Text
    if (prefs.invoiceHeader) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(prefs.invoiceHeader, margin + 45, cursorY + 5);
    }
    
    // Invoice Title
    doc.setFontSize(22);
    doc.setFont(FONT_NAME, 'bold');
    doc.text(t('invoiceDetailPage.invoiceTitle').toUpperCase(), pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 8;

    doc.setFontSize(10);
    doc.setFont(FONT_NAME, 'normal');
    doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 15;
  };
  
  const addFooter = (pageNumber: number, totalPages: number) => {
      doc.setFontSize(8);
      doc.setTextColor(150);
      const footerText = prefs.invoiceFooter || "";
      const pageStr = `Page ${pageNumber} of ${totalPages}`;
      
      doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
      doc.text(pageStr, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };


  // --- PDF CONTENT STARTS HERE ---

  // Initial Header
  addHeader();

  // Client Info and Dates
  doc.setLineWidth(0.5);
  doc.line(margin, cursorY, pageWidth - margin, cursorY);
  cursorY += 10;

  const billToY = cursorY;
  doc.setFontSize(11);
  doc.setFont(FONT_NAME, 'bold');
  doc.text(t('invoiceDetailPage.billTo'), margin, cursorY);
  cursorY += 5;

  doc.setFontSize(10);
  doc.setFont(FONT_NAME, 'normal');
  doc.setTextColor(50);
  let clientAddress = `${invoice.clientName}\n`;
  if(invoice.clientCompany) clientAddress += `${invoice.clientCompany}\n`;
  if(invoice.clientAddress) clientAddress += `${invoice.clientAddress.replace(/\\n/g, '\n')}\n`;
  if(invoice.clientEmail) clientAddress += `${invoice.clientEmail}\n`;
  if(invoice.clientICE) clientAddress += `ICE: ${invoice.clientICE}`;

  doc.text(clientAddress, margin, cursorY);

  // Dates on the right side
  const dateX = pageWidth - margin;
  doc.setFontSize(11);
  doc.setFont(FONT_NAME, 'bold');
  doc.text(t('invoiceDetailPage.issueDate'), dateX, billToY, { align: 'right' });
  doc.setFont(FONT_NAME, 'normal');
  doc.setTextColor(50);
  doc.text(format(new Date(invoice.issueDate), "PPP", { locale: dateLocale }), dateX, billToY + 5, { align: 'right' });

  doc.setFontSize(11);
  doc.setFont(FONT_NAME, 'bold');
  doc.text(t('invoiceDetailPage.dueDate'), dateX, billToY + 12, { align: 'right' });
  doc.setFont(FONT_NAME, 'normal');
  doc.setTextColor(50);
  doc.text(format(new Date(invoice.dueDate), "PPP", { locale: dateLocale }), dateX, billToY + 17, { align: 'right' });

  cursorY += 30;


  // Invoice Items Table
  const tableBody = invoice.items.map(item => [
      item.description,
      item.quantity.toString(),
      item.unitPrice.toFixed(2),
      (item.quantity * item.unitPrice).toFixed(2)
  ]);

  autoTable(doc, {
      startY: cursorY,
      head: [[
          t('invoiceDetailPage.itemDescription'),
          t('invoiceDetailPage.itemQuantity'),
          t('invoiceDetailPage.itemUnitPrice'),
          t('invoiceDetailPage.itemTotal')
      ]],
      body: tableBody,
      theme: 'grid',
      headStyles: {
          fillColor: [230, 230, 230],
          textColor: 40,
          fontStyle: 'bold'
      },
      columnStyles: {
          0: { cellWidth: 'auto' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' }
      },
      didDrawPage: (data) => {
          // Add header and footer to each page created by autoTable
          cursorY = margin; // Reset cursor for header
          addHeader();
          const pageCount = (doc as any).internal.getNumberOfPages();
          addFooter(data.pageNumber, pageCount);
      },
      margin: { top: cursorY + 10 } // Start table below everything
  });

  // Get the Y position after the table
  let finalY = (doc as any).lastAutoTable.finalY || cursorY;

  // Summary section
  finalY += 10;

  // Check if there is enough space for the summary, otherwise add a new page
  if (finalY > pageHeight - 50) {
      doc.addPage();
      finalY = margin;
      addHeader();
  }
  
  const summaryX = pageWidth - margin - 60; // Position for the summary box
  doc.setFillColor(245, 245, 245);
  doc.rect(summaryX - 5, finalY - 5, 70, 30, 'F');

  doc.setFontSize(10);
  doc.setFont(FONT_NAME, 'bold');
  doc.text(`${t('invoiceDetailPage.subtotal')}`, summaryX, finalY);
  doc.setFont(FONT_NAME, 'normal');
  doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, summaryX + 60, finalY, { align: 'right'});

  finalY += 7;
  doc.setFont(FONT_NAME, 'bold');
  doc.text(`${t('invoiceDetailPage.tax')} (${invoice.taxRate || 0}%)`, summaryX, finalY);
  doc.setFont(FONT_NAME, 'normal');
  doc.text(`${invoice.currency} ${invoice.taxAmount?.toFixed(2) || '0.00'}`, summaryX + 60, finalY, { align: 'right'});

  finalY += 3;
  doc.setLineWidth(0.2);
  doc.line(summaryX, finalY, summaryX + 60, finalY);
  finalY += 5;

  doc.setFontSize(12);
  doc.setFont(FONT_NAME, 'bold');
  doc.text(`${t('invoiceDetailPage.total')}`, summaryX, finalY);
  doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, summaryX + 60, finalY, { align: 'right'});

  // Add notes if they exist
  if (invoice.notes || invoice.appliedDefaultPaymentTerms) {
    finalY += 20;
    if (invoice.notes) {
      doc.setFontSize(10).setFont(FONT_NAME, 'bold').text(t('invoiceDetailPage.notes'), margin, finalY);
      finalY += 5;
      doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(80).text(invoice.notes, margin, finalY, { maxWidth: pageWidth - margin * 2 - 80 });
      finalY += 15;
    }
    if (invoice.appliedDefaultPaymentTerms) {
        doc.setFontSize(10).setFont(FONT_NAME, 'bold').text(t('invoiceDetailPage.paymentTerms'), margin, finalY);
        finalY += 5;
        doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(80).text(invoice.appliedDefaultPaymentTerms, margin, finalY, { maxWidth: pageWidth - margin * 2 - 80 });
    }
  }


  // Finalize footers for all pages
  const totalPages = (doc as any).internal.getNumberOfPages();
  for(let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    // Re-draw footer on all pages to ensure it's there
    addFooter(i, totalPages);
  }

  // Save the PDF
  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
};
