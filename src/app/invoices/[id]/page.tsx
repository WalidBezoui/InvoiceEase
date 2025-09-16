
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage, type Locale } from "@/hooks/use-language"; 
import { db } from "@/lib/firebase";
import type { Invoice, UserPreferences, Product, ProductTransaction } from "@/lib/types";
import { doc, getDoc, updateDoc, serverTimestamp, type FieldValue, collection, where, query, getDocs, writeBatch } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Edit, Loader2, AlertTriangle, Printer, ChevronDown, Send, DollarSign, AlertCircle as AlertCircleIcon, XCircle, Undo, FilePenLine } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr, enUS as en } from "date-fns/locale"; 
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogTrigger,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { generateInvoicePdf } from "@/lib/pdf-generator";


const currencyWordForms: { [key: string]: { singular: string, plural: string, centimeSingular: string, centimePlural: string } } = {
  MAD: { singular: "Dirham Marocain", plural: "Dirhams Marocains", centimeSingular: "centime", centimePlural: "centimes" },
  EUR: { singular: "Euro", plural: "Euros", centimeSingular: "centime", centimePlural: "centimes" },
  USD: { singular: "Dollar Américain", plural: "Dollars Américains", centimeSingular: "cent", centimePlural: "cents" },
};

function numberToFrenchWords(num: number, currencyCode: string): string {
  const currentCurrency = currencyWordForms[currencyCode.toUpperCase()] || currencyWordForms["MAD"]; 

  const units = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const teens = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  const tens = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante-dix", "quatre-vingt", "quatre-vingt-dix"];

  const numToWords = (n: number, isRecursiveCall = false): string => {
    if (n === 0) return isRecursiveCall ? "" : "zéro";
    let words = "";

    if (n >= 1000000000) {
      words += numToWords(Math.floor(n / 1000000000)) + " milliard" + (Math.floor(n / 1000000000) > 1 ? "s" : "") + " ";
      n %= 1000000000;
    }
    if (n >= 1000000) {
      words += numToWords(Math.floor(n / 1000000)) + " million" + (Math.floor(n / 1000000) > 1 ? "s" : "") + " ";
      n %= 1000000;
    }
    if (n >= 1000) {
      const thousands = Math.floor(n / 1000);
      words += (thousands === 1 ? "mille" : numToWords(thousands) + " mille") + " ";
      n %= 1000;
    }
    if (n >= 100) {
      const hundreds = Math.floor(n / 100);
      words += (hundreds === 1 ? "cent" : units[hundreds] + " cent") + (n % 100 === 0 && hundreds > 1 && !isRecursiveCall ? "s" : "") + " ";
      n %= 100;
    }
    if (n >= 10) {
      if (n < 20) {
        words += teens[n - 10] + " ";
        n = 0;
      } else {
        const ten = Math.floor(n / 10);
        words += tens[ten];
        if (n % 10 !== 0) {
          if (ten === 7 || ten === 9) { 
            words += (n % 10 === 1 && ten !== 7 && ten !==9) ? " et " : "-"; 
            words += teens[(n % 10) -1 ];
          } else {
             words += (n % 10 === 1) ? " et " : (n % 10 !== 0 ? "-" : "");
             words += units[n % 10];
          }
        } else if (ten === 8 && !isRecursiveCall) { 
            words += "s";
        }
        words += " ";
        n = 0;
      }
    }
    if (n > 0) {
      words += units[n] + " ";
    }
    return words.trim();
  };

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = numToWords(integerPart);
  words = words.charAt(0).toUpperCase() + words.slice(1); 
  words += " " + (integerPart !== 1 ? currentCurrency.plural : currentCurrency.singular);

  if (decimalPart > 0) {
    words += " et " + numToWords(decimalPart);
    words += " " + (decimalPart !== 1 ? currentCurrency.centimePlural : currentCurrency.singular);
  }
  return words.replace(/\s+/g, ' ').trim();
}

const dateLocales: Record<Locale, typeof fr | typeof en> = { en, fr };


export default function InvoiceDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, locale, isLoadingLocale } = useLanguage(); 
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isProcessingPdf, setIsProcessingPdf] = useState(false);

  const isLoading = authLoading || isLoadingLocale || isLoadingData || isLoadingPreferences;
  
  useEffect(() => {
    async function fetchInvoiceAndPreferences() {
      if (!user || !invoiceId) {
        setIsLoadingData(false);
        setIsLoadingPreferences(false);
        return;
      }
      setIsLoadingData(true);
      setIsLoadingPreferences(true);
      setError(null);
      try {
        const invoiceRef = doc(db, "invoices", invoiceId);
        const docSnap = await getDoc(invoiceRef);

        if (docSnap.exists()) {
          const fetchedInvoice = { id: docSnap.id, ...docSnap.data() } as Invoice;
          if (fetchedInvoice.userId === user.uid) {
            setInvoice(fetchedInvoice);

            const userPrefDocRef = doc(db, "userPreferences", user.uid);
            const userPrefDocSnap = await getDoc(userPrefDocRef);
            if (userPrefDocSnap.exists()) {
              setUserPreferences(userPrefDocSnap.data() as UserPreferences);
            } else {
              setUserPreferences({ currency: "MAD", language: "fr", defaultTaxRate: 0 }); 
            }

          } else {
            setError(t('invoiceDetailPage.errorLoadingInvoice')); 
          }
        } else {
          setError(t('invoiceDetailPage.invoiceNotFound'));
        }
      } catch (err) {
        console.error("Error fetching invoice or preferences:", err);
        setError(t('invoiceDetailPage.errorLoadingInvoice'));
      } finally {
        setIsLoadingData(false);
        setIsLoadingPreferences(false);
      }
    }
    fetchInvoiceAndPreferences();
  }, [user, invoiceId, t]);
  
  const getDateFnsLocale = () => {
    return dateLocales[invoice?.language as Locale || locale] || en;
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "overdue": return "destructive";
      case "draft": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };
  
    const updateStockAndCreateTransactions = async (paidInvoice: Invoice) => {
        const batch = writeBatch(db);
        const sign = -1; // Remove stock when marking as paid

        for (const item of paidInvoice.items) {
            if (item.productId) {
                const productRef = doc(db, "products", item.productId);
                const productSnap = await getDoc(productRef);

                if (productSnap.exists()) {
                    const product = productSnap.data() as Product;
                    const newStock = (product.stock ?? 0) + (item.quantity * sign);

                    batch.update(productRef, { stock: newStock });

                    const transactionRef = doc(collection(db, "productTransactions"));
                    batch.set(transactionRef, {
                        userId: paidInvoice.userId,
                        productId: item.productId,
                        type: 'sale',
                        quantityChange: item.quantity * sign,
                        newStock: newStock,
                        invoiceId: paidInvoice.id,
                        notes: paidInvoice.invoiceNumber,
                        transactionPrice: item.unitPrice, // Log the sale price
                        transactionDate: serverTimestamp(),
                    });
                }
            }
        }
        await batch.commit();
    };
    
    const revertStockUpdate = async (invoiceToRevert: Invoice) => {
        const batch = writeBatch(db);
        // Find transactions related to this invoice
        const transQuery = query(collection(db, "productTransactions"), where("invoiceId", "==", invoiceToRevert.id));
        const transSnapshot = await getDocs(transQuery);
        
        if (!transSnapshot.empty) {
            for (const transDoc of transSnapshot.docs) {
                const transaction = transDoc.data() as ProductTransaction;
                
                const productRef = doc(db, "products", transaction.productId);
                
                const productSnap = await getDoc(productRef);
                if (productSnap.exists()) {
                    const productData = productSnap.data();
                    const reversedStock = (productData.stock ?? 0) - transaction.quantityChange;
                    batch.update(productRef, { stock: reversedStock });
                }
                
                batch.delete(transDoc.ref);
            }
        }
        
        await batch.commit();
    };

  const handleStatusChange = async (newStatus: Invoice['status']) => {
    if (!invoice || !user || !invoice.id) return;
    if (isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    const invoiceRef = doc(db, "invoices", invoice.id);
    
    const updateData: { status: Invoice['status']; updatedAt: FieldValue; sentDate?: string | null; paidDate?: string | null, stockUpdated?: boolean } = {
      status: newStatus,
      updatedAt: serverTimestamp() as FieldValue,
      stockUpdated: invoice.stockUpdated
    };

    try {
        if (newStatus === 'paid' && !invoice.stockUpdated) {
            await updateStockAndCreateTransactions(invoice);
            updateData.paidDate = new Date().toISOString();
            updateData.stockUpdated = true;
        } else if (invoice.status === 'paid' && newStatus !== 'paid' && invoice.stockUpdated) {
            await revertStockUpdate(invoice);
            updateData.paidDate = null;
            updateData.stockUpdated = false;
        }
        
        if (newStatus === 'sent' && invoice.status === 'draft') {
            updateData.sentDate = new Date().toISOString();
        }

        await updateDoc(invoiceRef, updateData as any); 

        setInvoice(prev => prev ? { ...prev, ...updateData, status: newStatus, stockUpdated: updateData.stockUpdated } : null);

        toast({
            title: t('invoiceDetailPage.statusUpdatedToastTitle'), 
            description: t('invoiceDetailPage.statusUpdatedToastDesc', {invoiceNumber: invoice.invoiceNumber, status: newStatus}), 
        });

    } catch (err) {
      console.error("Error updating invoice status or stock:", err);
      toast({
        title: t('invoiceDetailPage.errorToastTitle'), 
        description: t('invoiceDetailPage.statusUpdateErrorToastDesc'), 
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
    }
  };


  const handlePdfAction = async (action: 'download' | 'print') => {
    if (!invoice || !userPreferences) {
      toast({
        title: "Cannot generate PDF",
        description: "Invoice data is not fully loaded yet.",
        variant: "destructive",
      });
      return;
    }
    setIsProcessingPdf(true);
    try {
      await generateInvoicePdf(invoice, userPreferences, t, action);
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({
        title: "PDF Processing Failed",
        description: "An unexpected error occurred while creating the PDF.",
        variant: "destructive",
      });
    } finally {
      setIsProcessingPdf(false);
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">{error}</h2>
        <Button onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.backToInvoices')}
        </Button>
      </div>
    );
  }

  if (!invoice) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">{t('invoiceDetailPage.invoiceNotFound')}</h2>
        <p className="text-muted-foreground mb-6">{t('invoiceDetailPage.invoiceNotFoundMessage')}</p>
        <Button onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.backToInvoices')}
        </Button>
      </div>
    );
  }
  
  const canMarkAsSent = invoice.status === 'draft';
  const canMarkAsPaid = invoice.status === 'sent' || invoice.status === 'overdue';
  const canMarkAsOverdue = invoice.status === 'sent';
  const canCancel = invoice.status === 'sent' || invoice.status === 'overdue';
  const canRevertToSent = invoice.status === 'paid';
  const canReopenAsDraft = invoice.status === 'cancelled';

  const hasAvailableActions = canMarkAsSent || canMarkAsPaid || canMarkAsOverdue || canCancel || canRevertToSent || canReopenAsDraft;

  const displayLogoUrl = userPreferences?.logoDataUrl;
  const displayWatermarkLogoUrl = userPreferences?.watermarkLogoDataUrl;
  const displayCompanyInvoiceHeader = userPreferences?.invoiceHeader || "";
  const displayCompanyInvoiceFooter = userPreferences?.invoiceFooter || "";


  return (
    <div className="invoice-page-container">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 no-print">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
            <Link href="/invoices">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">{t('invoiceDetailPage.backToInvoices')}</span>
            </Link>
            </Button>
            <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
                {t('invoiceDetailPage.invoiceTitle')} {invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground mt-1">
                {t('invoiceDetailPage.invoiceStatus')} <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize ml-1">{t(`invoiceStatus.${invoice.status}`, { default: invoice.status})}</Badge>
            </p>
            </div>
        </div>
        <div className="flex gap-2 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isUpdatingStatus || !hasAvailableActions}>
                {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {t('invoiceDetailPage.changeStatus')} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canMarkAsSent && (
                <DropdownMenuItem onClick={() => handleStatusChange('sent')} disabled={isUpdatingStatus}>
                  <Send className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.markAsSent')}
                </DropdownMenuItem>
              )}
              {canMarkAsPaid && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isUpdatingStatus}>
                      <DollarSign className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.markAsPaid')}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('invoiceDetailPage.confirmPaidTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('invoiceDetailPage.confirmPaidDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('invoiceDetailPage.confirmPaidCancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('paid')} disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t('invoiceDetailPage.confirmPaidAction')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canMarkAsOverdue && (
                <DropdownMenuItem onClick={() => handleStatusChange('overdue')} disabled={isUpdatingStatus}>
                  <AlertCircleIcon className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.markAsOverdue')}
                </DropdownMenuItem>
              )}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive hover:!text-destructive focus:!text-destructive" disabled={isUpdatingStatus}>
                       <XCircle className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.cancelInvoice')}
                     </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('invoiceDetailPage.confirmCancelTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('invoiceDetailPage.confirmCancelDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('invoiceDetailPage.confirmCancelCancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('cancelled')} disabled={isUpdatingStatus} className="bg-destructive hover:bg-destructive/90">
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t('invoiceDetailPage.confirmCancelAction')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
               )}
              {(canRevertToSent || canReopenAsDraft) && <DropdownMenuSeparator />}
              {canRevertToSent && (
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isUpdatingStatus}>
                      <Undo className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.revertToSent')}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('invoiceDetailPage.confirmRevertToSentTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('invoiceDetailPage.confirmRevertToSentDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('invoiceDetailPage.confirmRevertToSentCancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('sent')} disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t('invoiceDetailPage.confirmRevertToSentAction')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canReopenAsDraft && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isUpdatingStatus}>
                     <FilePenLine className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.reopenAsDraft')}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('invoiceDetailPage.confirmReopenAsDraftTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('invoiceDetailPage.confirmReopenAsDraftDescription')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t('invoiceDetailPage.confirmReopenAsDraftCancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('draft')} disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {t('invoiceDetailPage.confirmReopenAsDraftAction')}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={() => handlePdfAction('download')} disabled={isProcessingPdf}>
            {isProcessingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            {t('invoiceDetailPage.downloadPdf')}
          </Button>

          <Button variant="outline" onClick={() => handlePdfAction('print')} disabled={isProcessingPdf}>
            {isProcessingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Printer className="mr-2 h-4 w-4" />}
            {t('invoiceDetailPage.printPdf', { default: 'Print' })}
          </Button>

          { (invoice.status === 'draft' || invoice.status === 'sent') && !isUpdatingStatus ? (
            <Button asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.edit')}
              </Link>
            </Button>
          ) : (
             <Button disabled> 
                <Edit className="mr-2 h-4 w-4" /> {t('invoiceDetailPage.edit')}
             </Button>
          )}
        </div>
      </div>

      <Card className="invoice-card-on-screen shadow-lg relative">
        {displayWatermarkLogoUrl && (
          <div 
            className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
          >
            <img 
              src={displayWatermarkLogoUrl} 
              alt="Watermark" 
              className="w-2/3 h-2/3 object-contain opacity-5"
            />
          </div>
        )}
        <div className="relative z-10">
            <CardHeader className="border-b pb-4">
            <div className="flex flex-col items-center text-center">
                {displayLogoUrl && (
                <img
                    src={displayLogoUrl}
                    alt="Company Logo"
                    className="h-20 max-w-[200px] object-contain" 
                    data-ai-hint="company logo"
                />
                )}
                {displayCompanyInvoiceHeader && (
                <h2 className="text-2xl font-bold text-primary mt-3">
                    {displayCompanyInvoiceHeader}
                </h2>
                )}
            </div>
            <div className="border-t w-full my-4"></div>
            <div className="flex justify-end text-right">
                <div>
                <h3 className="text-3xl font-bold text-primary uppercase tracking-tight leading-tight">
                    {t('invoiceDetailPage.invoiceTitle')}
                </h3>
                <p className="text-muted-foreground text-sm">
                    # {invoice.invoiceNumber}
                </p>
                {invoice.currency && (
                    <p className="text-sm text-muted-foreground mt-0.5">
                    {t('invoiceDetailPage.currency')} {invoice.currency}
                    </p>
                )}
                </div>
            </div>
            </CardHeader>
            
            <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                <h4 className="font-semibold text-primary mb-1.5">{t('invoiceDetailPage.billTo')}</h4>
                <div className="space-y-0.5 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{invoice.clientName}</p>
                    {invoice.clientCompany && <p>{invoice.clientCompany}</p>}
                    {invoice.clientAddress && <p>{invoice.clientAddress.split('\\n').map((line, i) => (<span key={i}>{line}<br/></span>))}</p>}
                    {invoice.clientEmail && <p>{invoice.clientEmail}</p>}
                    {invoice.clientICE && <p>ICE: {invoice.clientICE}</p>}
                </div>
                </div>
                <div className="text-left md:text-right space-y-2">
                <div>
                    <h4 className="font-semibold text-primary mb-0.5">{t('invoiceDetailPage.issueDate')}</h4>
                    <span className="text-muted-foreground">{format(new Date(invoice.issueDate), "PPP", { locale: getDateFnsLocale() })}</span>
                </div>
                <div>
                    <h4 className="font-semibold text-primary mb-0.5">{t('invoiceDetailPage.dueDate')}</h4>
                    <span className="text-muted-foreground">{format(new Date(invoice.dueDate), "PPP", { locale: getDateFnsLocale() })}</span>
                </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                    <TableRow className="bg-muted/30">
                    <TableHead className="w-[45%]">{t('invoiceDetailPage.itemDescription')}</TableHead>
                    <TableHead>{t('invoiceForm.addItemDialog.selectProductTab.reference')}</TableHead>
                    <TableHead className="text-center">{t('invoiceDetailPage.itemQuantity')}</TableHead>
                    <TableHead className="text-right">{t('invoiceDetailPage.itemUnitPrice')}</TableHead>
                    <TableHead className="text-right">{t('invoiceDetailPage.itemTotal')}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {invoice.items.map((item, index) => (
                    <TableRow key={index}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{item.reference || 'N/A'}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{item.unitPrice.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{item.total.toFixed(2)}</TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                <div className="md:col-span-2 space-y-3">
                {invoice.notes && (
                    <div>
                    <h4 className="font-semibold text-primary mb-1.5">{t('invoiceDetailPage.notes')}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                )}
                {invoice.appliedDefaultPaymentTerms && (
                    <div>
                        <h4 className="font-semibold text-primary mb-1.5">{t('invoiceDetailPage.paymentTerms')}</h4>
                        <p className="text-sm text-muted-foreground">{invoice.appliedDefaultPaymentTerms}</p>
                    </div>
                )}
                </div>
                <div className="space-y-2 p-4 bg-secondary/20 rounded-lg shadow-sm">
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('invoiceDetailPage.subtotal')}</span>
                    <span className="font-medium">{invoice.currency} {invoice.subtotal.toFixed(2)}</span>
                </div>
                {invoice.taxAmount !== undefined && invoice.taxAmount !== 0 && (
                    <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t('invoiceDetailPage.tax')} ({invoice.taxRate || 0}%):</span>
                    <span className="font-medium">{invoice.currency} {invoice.taxAmount.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-xl font-bold text-primary border-t border-border pt-2 mt-2">
                    <span>{t('invoiceDetailPage.total')}</span>
                    <span>{invoice.currency} {invoice.totalAmount.toFixed(2)}</span>
                </div>
                </div>
            </div>
            
            {(invoice.language?.toLowerCase().startsWith("fr") || (!invoice.language && locale === 'fr')) && (
                <div className="pt-4 mt-4 border-t">
                <p className="text-sm text-muted-foreground">
                    {t('invoiceDetailPage.stoppedAtTheSumOf')} <strong className="text-foreground">{numberToFrenchWords(invoice.totalAmount, invoice.currency)}</strong>.
                </p>
                </div>
            )}

            </CardContent>

            {displayCompanyInvoiceFooter && (
            <CardFooter className={cn(
                "border-t pt-4 pb-4 mt-4",
                displayCompanyInvoiceFooter ? "has-content" : ""
            )}>
                <p className="text-xs text-muted-foreground text-center w-full">{displayCompanyInvoiceFooter}</p>
            </CardFooter>
            )}
        </div>
      </Card>
      
    </div>
  );
}
