
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
    
    // Left side: Logo and Company Info
    if (prefs.logoDataUrl) {
      try {
        const img = new Image();
        img.src = prefs.logoDataUrl;
        doc.addImage(img, 'PNG', margin, cursorY, 40, 20); // Logo
        cursorY += 25; // Move cursor down after logo
      } catch (e) { 
        console.error("Could not add company logo to PDF.", e); 
        cursorY += 25;
      }
    }
    
    if (prefs.invoiceHeader) {
      doc.setFontSize(11);
      doc.setFont(FONT_NAME, 'bold');
      doc.setTextColor(33, 33, 33); // Dark Grey for company name/header
      doc.text(prefs.invoiceHeader.split('\n'), margin, cursorY);
    }
    
    // Right side: Invoice Title Block
    const titleX = pageWidth - margin - 70;
    const titleY = margin;
    doc.setFillColor(230, 230, 230); // Light grey background for title
    doc.rect(titleX, titleY, 70, 15, 'F');
    
    doc.setFontSize(20);
    doc.setFont(FONT_NAME, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(
      t('invoiceDetailPage.invoiceTitle').toUpperCase(), 
      titleX + 35, // Center text in the box
      titleY + 10, 
      { align: 'center' }
    );

    doc.setFontSize(10);
    doc.setFont(FONT_NAME, 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`# ${invoice.invoiceNumber}`, titleX + 68, titleY + 20, { align: 'right' });


    // Separator line
    let separatorY = Math.max(cursorY + 10, titleY + 30);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.line(margin, separatorY, pageWidth - margin, separatorY);
    

    // Client Info and Dates only on the first page
    if (isFirstPage) {
        let infoY = separatorY + 10;
        const billToY = infoY;
        doc.setFontSize(11);
        doc.setFont(FONT_NAME, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(t('invoiceDetailPage.billTo'), margin, infoY);
        infoY += 6;

        doc.setFontSize(10);
        doc.setFont(FONT_NAME, 'normal');
        doc.setTextColor(50, 50, 50);
        let clientAddress = `${invoice.clientName}\n`;
        if(invoice.clientCompany) clientAddress += `${invoice.clientCompany}\n`;
        if(invoice.clientAddress) clientAddress += `${invoice.clientAddress.replace(/\\n/g, '\n')}\n`;
        if(invoice.clientEmail) clientAddress += `${invoice.clientEmail}\n`;
        if(invoice.clientICE) clientAddress += `ICE: ${invoice.clientICE}`;

        doc.text(clientAddress, margin, infoY);

        const dateX = pageWidth - margin;
        doc.setFontSize(11);
        doc.setFont(FONT_NAME, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(t('invoiceDetailPage.issueDate'), dateX, billToY, { align: 'right' });
        
        doc.setFont(FONT_NAME, 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text(format(new Date(invoice.issueDate), "PPP", { locale: dateLocale }), dateX, billToY + 6, { align: 'right' });

        doc.setFontSize(11);
        doc.setFont(FONT_NAME, 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text(t('invoiceDetailPage.dueDate'), dateX, billToY + 14, { align: 'right' });
        
        doc.setFont(FONT_NAME, 'normal');
        doc.setTextColor(50, 50, 50);
        doc.text(format(new Date(invoice.dueDate), "PPP", { locale: dateLocale }), dateX, billToY + 20, { align: 'right' });
    }
  };

  const addPageFooter = (pageNumber: number, totalPages: number) => {
    const footerY = pageHeight - 15;
    doc.setLineWidth(0.5);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, footerY - 5, pageWidth - margin, footerY - 5);

    doc.setFontSize(8);
    doc.setTextColor(150);
    const footerText = prefs.invoiceFooter || "";
    const pageStr = `Page ${pageNumber} of ${totalPages}`;

    doc.text(footerText, pageWidth / 2, footerY, { align: 'center' });
    doc.text(pageStr, pageWidth - margin, footerY, { align: 'right' });
  };
  
  const addSummaryAndNotes = (startY: number) => {
    let finalY = startY + 10;
    
    // Check if there is enough space, if not, add a new page
    // 80mm is a safe estimate for the summary, notes, and footer
    if (pageHeight - finalY < 80) {
      return false; // Signal to create a new page
    }
    
    const summaryX = pageWidth - margin - 80;

    if (invoice.notes || invoice.appliedDefaultPaymentTerms) {
        let notesY = finalY;
        if (invoice.notes) {
            doc.setFontSize(10).setFont(FONT_NAME, 'bold').text(t('invoiceDetailPage.notes'), margin, notesY);
            notesY += 5;
            doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(80).text(invoice.notes, margin, notesY, { maxWidth: pageWidth - margin * 2 - 95 });
        }
        if (invoice.appliedDefaultPaymentTerms) {
            const paymentTermsY = notesY + (invoice.notes ? 15 : 0); // Adjust space based on if notes exist
            doc.setFontSize(10).setFont(FONT_NAME, 'bold').text(t('invoiceDetailPage.paymentTerms'), margin, paymentTermsY);
            notesY = paymentTermsY + 5;
            doc.setFontSize(9).setFont(FONT_NAME, 'normal').setTextColor(80).text(invoice.appliedDefaultPaymentTerms, margin, notesY, { maxWidth: pageWidth - margin * 2 - 95 });
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
    
    return true; // Signal that summary was added
  }

  // --- PDF CONTENT STARTS HERE ---

  const itemChunks = chunkArray(invoice.items, ROWS_PER_PAGE);
  const totalPages = itemChunks.length;
  let summaryAdded = false;

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
      startY: isFirstPage ? 110 : 80, // More space on first page for client details
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
        summaryAdded = addSummaryAndNotes((doc as any).lastAutoTable.finalY);
    }
    
    addPageFooter(index + 1, totalPages + (isLastPage && !summaryAdded ? 1 : 0));
    
    if (!isLastPage) {
      doc.addPage();
    }
  });

  // If summary didn't fit on the last page, add a new page for it
  if (!summaryAdded) {
    doc.addPage();
    addPageHeader(false); // Not the first page
    addSummaryAndNotes(80);
    addPageFooter(totalPages + 1, totalPages + 1);
  }


  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
};
