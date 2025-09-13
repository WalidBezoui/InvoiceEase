
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, UserPreferences } from './types';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

const FONT_NAME = 'Helvetica';
const ROWS_PER_PAGE = 10;

// Helper to chunk the items array into pages of a specific size
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunkedArr: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunkedArr.push(array.slice(i, i + size));
  }
  return chunkedArr;
}

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

  try {
    doc.setFont(FONT_NAME);
  } catch (e) {
    console.error("Font could not be set. Characters may not render correctly.", e);
  }

  const dateLocale = invoice.language === 'fr' ? fr : enUS;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  const addPageHeader = (isFirstPage: boolean) => {
    let cursorY = margin;
    // Company Logo & Header Text
    if (prefs.logoDataUrl) {
      try {
        const img = new Image();
        img.src = prefs.logoDataUrl;
        doc.addImage(img, 'PNG', margin, cursorY, 40, 20);
      } catch (e) { console.error("Could not add company logo to PDF.", e); }
    }
    if (prefs.invoiceHeader) {
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(prefs.invoiceHeader, margin + 45, cursorY + 5, { maxWidth: pageWidth - margin * 2 - 45 });
    }

    // Invoice Title
    doc.setFontSize(22);
    doc.setFont(FONT_NAME, 'bold');
    doc.setTextColor(0,0,0);
    doc.text(t('invoiceDetailPage.invoiceTitle').toUpperCase(), pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 8;

    doc.setFontSize(10);
    doc.setFont(FONT_NAME, 'normal');
    doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, cursorY, { align: 'right' });
    cursorY += 15;

    // Client Info and Dates only on the first page
    if (isFirstPage) {
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

        const dateX = pageWidth - margin;
        doc.setFontSize(11);
        doc.setFont(FONT_NAME, 'bold');
        doc.setTextColor(0,0,0);
        doc.text(t('invoiceDetailPage.issueDate'), dateX, billToY, { align: 'right' });
        doc.setFont(FONT_NAME, 'normal');
        doc.setTextColor(50);
        doc.text(format(new Date(invoice.issueDate), "PPP", { locale: dateLocale }), dateX, billToY + 5, { align: 'right' });

        doc.setFontSize(11);
        doc.setFont(FONT_NAME, 'bold');
        doc.setTextColor(0,0,0);
        doc.text(t('invoiceDetailPage.dueDate'), dateX, billToY + 12, { align: 'right' });
        doc.setFont(FONT_NAME, 'normal');
        doc.setTextColor(50);
        doc.text(format(new Date(invoice.dueDate), "PPP", { locale: dateLocale }), dateX, billToY + 17, { align: 'right' });
    }
  };

  const addPageFooter = (pageNumber: number, totalPages: number) => {
    doc.setFontSize(8);
    doc.setTextColor(150);
    const footerText = prefs.invoiceFooter || "";
    const pageStr = `Page ${pageNumber} of ${totalPages}`;

    doc.text(footerText, pageWidth / 2, pageHeight - 10, { align: 'center' });
    doc.text(pageStr, pageWidth - margin, pageHeight - 10, { align: 'right' });
  };
  
  const addSummaryAndNotes = () => {
    let finalY = (doc as any).lastAutoTable.finalY || pageHeight / 2;
    const availableSpace = pageHeight - finalY - 20; // Space left at bottom
    
    // If not enough space for summary, push it down, it will be on the same page still
    if(availableSpace < 50) {
        finalY = pageHeight - 70;
    } else {
        finalY += 10;
    }
    
    const summaryX = pageWidth - margin - 80;

    if (invoice.notes || invoice.appliedDefaultPaymentTerms) {
        let notesY = finalY;
        if (invoice.notes) {
            doc.setFontSize(10).setFont(FONT_NAME, 'bold').text(t('invoiceDetailPage.notes'), margin, notesY);
            notesY += 5;
            doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(80).text(invoice.notes, margin, notesY, { maxWidth: pageWidth - margin * 2 - 90 });
            notesY += 15;
        }
        if (invoice.appliedDefaultPaymentTerms) {
            doc.setFontSize(10).setFont(FONT_NAME, 'bold').text(t('invoiceDetailPage.paymentTerms'), margin, notesY);
            notesY += 5;
            doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(80).text(invoice.appliedDefaultPaymentTerms, margin, notesY, { maxWidth: pageWidth - margin * 2 - 90 });
        }
    }

    // Summary Box
    doc.setFillColor(245, 245, 245);
    doc.rect(summaryX - 5, finalY - 5, 85, 30, 'F');
    
    doc.setFontSize(10);
    doc.setFont(FONT_NAME, 'bold');
    doc.text(`${t('invoiceDetailPage.subtotal')}`, summaryX, finalY);
    doc.setFont(FONT_NAME, 'normal');
    doc.text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, summaryX + 75, finalY, { align: 'right'});

    finalY += 7;
    doc.setFont(FONT_NAME, 'bold');
    doc.text(`${t('invoiceDetailPage.tax')} (${invoice.taxRate || 0}%)`, summaryX, finalY);
    doc.setFont(FONT_NAME, 'normal');
    doc.text(`${invoice.currency} ${invoice.taxAmount?.toFixed(2) || '0.00'}`, summaryX + 75, finalY, { align: 'right'});

    finalY += 3;
    doc.setLineWidth(0.2);
    doc.line(summaryX, finalY, summaryX + 75, finalY);
    finalY += 5;

    doc.setFontSize(12);
    doc.setFont(FONT_NAME, 'bold');
    doc.text(`${t('invoiceDetailPage.total')}`, summaryX, finalY);
    doc.text(`${invoice.currency} ${invoice.totalAmount.toFixed(2)}`, summaryX + 75, finalY, { align: 'right'});
  }

  // --- PDF CONTENT STARTS HERE ---

  const itemChunks = chunkArray(invoice.items, ROWS_PER_PAGE);
  const totalPages = itemChunks.length;

  itemChunks.forEach((chunk, index) => {
    const isFirstPage = index === 0;
    const isLastPage = index === totalPages - 1;

    addPageHeader(isFirstPage);
    
    const tableBody = chunk.map(item => [
        item.description,
        item.quantity.toString(),
        item.unitPrice.toFixed(2),
        (item.quantity * item.unitPrice).toFixed(2)
    ]);
    
    autoTable(doc, {
      startY: isFirstPage ? 90 : margin + 40,
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
      margin: { left: margin, right: margin }
    });

    if (isLastPage) {
        addSummaryAndNotes();
    }
    
    addPageFooter(index + 1, totalPages);
    
    if (!isLastPage) {
      doc.addPage();
    }
  });

  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
};
