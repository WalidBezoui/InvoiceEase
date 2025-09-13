
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
    
    // Centered Logo
    if (prefs.logoDataUrl) {
      try {
        const img = new Image();
        img.src = prefs.logoDataUrl;
        const logoWidth = 40;
        const logoX = (pageWidth - logoWidth) / 2;
        doc.addImage(img, 'PNG', logoX, cursorY, logoWidth, 20, undefined, 'FAST');
        cursorY += 25; // Move cursor down after logo
      } catch (e) { 
        console.error("Could not add company logo to PDF.", e); 
        cursorY += 25;
      }
    } else {
        cursorY += 22; // Reserve space even if no logo
    }
    
    // Centered Company Header Text
    if (prefs.invoiceHeader) {
      doc.setFontSize(14); // Made bigger
      doc.setFont(FONT_NAME, 'bold');
      doc.setTextColor(30, 30, 30); // Darker text for prominence
      doc.text(prefs.invoiceHeader, pageWidth / 2, cursorY, { align: 'center' });
      cursorY += 15;
    }
    
    // Invoice Title Block
    doc.setFillColor(230, 230, 230); // Light grey background
    doc.rect(margin, cursorY, pageWidth - (margin * 2), 15, 'F');
    
    doc.setFontSize(20);
    doc.setFont(FONT_NAME, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(
      t('invoiceDetailPage.invoiceTitle').toUpperCase(), 
      pageWidth / 2, // Center text in the box
      cursorY + 10, 
      { align: 'center' }
    );

    doc.setFontSize(10);
    doc.setFont(FONT_NAME, 'normal');
    doc.setTextColor(80, 80, 80);
    doc.text(`# ${invoice.invoiceNumber}`, pageWidth - margin, cursorY + 20, { align: 'right' });


    // Separator line
    let separatorY = cursorY + 25;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.7); // Thicker line
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
  const totalPages = itemChunks.length === 0 ? 1 : itemChunks.length;
  let summaryAdded = false;

  if (itemChunks.length === 0) {
    // Handle case with no items
    addPageHeader(true);
    addSummaryAndNotes(110);
    addPageFooter(1, 1);
  } else {
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
  }


  // If summary didn't fit on the last page, add a new page for it
  if (!summaryAdded && itemChunks.length > 0) {
    doc.addPage();
    addPageHeader(false); // Not the first page
    addSummaryAndNotes(80);
    addPageFooter(totalPages + 1, totalPages + 1);
  }


  doc.save(`invoice-${invoice.invoiceNumber}.pdf`);
};
