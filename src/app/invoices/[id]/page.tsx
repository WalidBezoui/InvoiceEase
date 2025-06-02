
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { doc, getDoc, updateDoc, serverTimestamp, type FieldValue } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Edit, Loader2, AlertTriangle, Printer, ChevronDown, Send, DollarSign, AlertCircle as AlertCircleIcon, XCircle, Undo, FilePenLine } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { fr } from "date-fns/locale"; 
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
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";


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
    words += " " + (decimalPart !== 1 ? currentCurrency.centimePlural : currentCurrency.centimeSingular);
  }
  return words.replace(/\s+/g, ' ').trim();
}


const getInvoiceStrings = (languageCode?: string) => {
  const lang = languageCode?.toLowerCase().startsWith("fr") ? "fr" : "en"; 

  const strings = {
    en: {
      invoiceTitle: "Invoice",
      billTo: "Bill To:",
      issueDate: "Issue Date:",
      dueDate: "Due Date:",
      itemDescription: "Description",
      itemQuantity: "Quantity",
      itemUnitPrice: "Unit Price",
      itemTotal: "Total",
      notes: "Notes:",
      paymentTerms: "Payment Terms:",
      subtotal: "Subtotal:",
      tax: "Tax",
      total: "Total:",
      currency: "Currency:",
      invoiceStatus: "Invoice Status",
      backToInvoices: "Back to Invoices",
      printPdf: "Print / PDF",
      downloadPdf: "Download PDF",
      edit: "Edit",
      errorLoadingInvoice: "Error Loading Invoice",
      invoiceNotFound: "Invoice Not Found",
      invoiceNotFoundMessage: "The invoice you are looking for does not exist or could not be loaded.",
      stoppedAtTheSumOf: "This invoice is closed at the sum of:",
      thatIs: "i.e.",
      changeStatus: "Change Status",
      markAsSent: "Mark as Sent",
      markAsPaid: "Mark as Paid",
      markAsOverdue: "Mark as Overdue",
      cancelInvoice: "Cancel Invoice",
      revertToSent: "Revert to Sent",
      reopenAsDraft: "Re-open as Draft",
      confirmPaidTitle: "Confirm Payment",
      confirmPaidDescription: "Are you sure you want to mark this invoice as paid? This action cannot be easily undone.",
      confirmPaidAction: "Confirm Paid",
      confirmPaidCancel: "Cancel",
      confirmCancelTitle: "Confirm Cancellation",
      confirmCancelDescription: "Are you sure you want to cancel this invoice? This action marks the invoice as void.",
      confirmCancelAction: "Confirm Cancel",
      confirmCancelCancel: "Keep Invoice",
      confirmRevertToSentTitle: "Confirm Revert to Sent",
      confirmRevertToSentDescription: "Are you sure you want to mark this invoice as 'Sent' (not paid)? This will clear the payment date.",
      confirmRevertToSentAction: "Confirm Revert",
      confirmRevertToSentCancel: "Keep as Paid",
      confirmReopenAsDraftTitle: "Confirm Re-open",
      confirmReopenAsDraftDescription: "Are you sure you want to re-open this cancelled invoice? It will be moved to 'Draft' status.",
      confirmReopenAsDraftAction: "Confirm Re-open",
      confirmReopenAsDraftCancel: "Keep Cancelled",
    },
    fr: {
      invoiceTitle: "Facture",
      billTo: "Facturé à :",
      issueDate: "Date d'émission :",
      dueDate: "Date d'échéance :",
      itemDescription: "Description",
      itemQuantity: "Quantité",
      itemUnitPrice: "Prix Unitaire",
      itemTotal: "Total",
      notes : "Notes :",
      paymentTerms: "Conditions de paiement :",
      subtotal: "Sous-total :",
      tax: "Taxe",
      total: "Total :",
      currency: "Devise :",
      invoiceStatus: "Statut de la facture",
      backToInvoices: "Retour aux factures",
      printPdf: "Imprimer / PDF",
      downloadPdf: "Télécharger PDF",
      edit: "Modifier",
      errorLoadingInvoice: "Erreur de chargement de la facture",
      invoiceNotFound: "Facture non trouvée",
      invoiceNotFoundMessage: "La facture que vous recherchez n'existe pas ou n'a pas pu être chargée.",
      stoppedAtTheSumOf: "Arrêtée la présente facture à la somme de :",
      thatIs: "soit",
      changeStatus: "Changer Statut",
      markAsSent: "Marquer comme Envoyée",
      markAsPaid: "Marquer comme Payée",
      markAsOverdue: "Marquer comme En Retard",
      cancelInvoice: "Annuler la Facture",
      revertToSent: "Revenir à Envoyée",
      reopenAsDraft: "Réouvrir comme Brouillon",
      confirmPaidTitle: "Confirmer le Paiement",
      confirmPaidDescription: "Êtes-vous sûr de vouloir marquer cette facture comme payée ? Cette action ne peut pas être facilement annulée.",
      confirmPaidAction: "Confirmer Payée",
      confirmPaidCancel: "Annuler",
      confirmCancelTitle: "Confirmer l'Annulation",
      confirmCancelDescription: "Êtes-vous sûr de vouloir annuler cette facture ? Cette action rendra la facture nulle.",
      confirmCancelAction: "Confirmer Annulation",
      confirmCancelCancel: "Conserver Facture",
      confirmRevertToSentTitle: "Confirmer Retour à Envoyée",
      confirmRevertToSentDescription: "Êtes-vous sûr de vouloir marquer cette facture comme 'Envoyée' (non payée) ? La date de paiement sera effacée.",
      confirmRevertToSentAction: "Confirmer Retour",
      confirmRevertToSentCancel: "Garder Payée",
      confirmReopenAsDraftTitle: "Confirmer Réouverture",
      confirmReopenAsDraftDescription: "Êtes-vous sûr de vouloir réouvrir cette facture annulée ? Elle passera au statut 'Brouillon'.",
      confirmReopenAsDraftAction: "Confirmer Réouverture",
      confirmReopenAsDraftCancel: "Garder Annulée",
    },
  };
  return strings[lang];
};


export default function InvoiceDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const [s, setS] = useState(getInvoiceStrings("en")); 

  useEffect(() => {
    async function fetchInvoice() {
      if (!user || !invoiceId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const invoiceRef = doc(db, "invoices", invoiceId);
        const docSnap = await getDoc(invoiceRef);

        if (docSnap.exists()) {
          const fetchedInvoice = { id: docSnap.id, ...docSnap.data() } as Invoice;
          if (fetchedInvoice.userId === user.uid) {
            setInvoice(fetchedInvoice);
            setS(getInvoiceStrings(fetchedInvoice.language)); 
          } else {
            setError("You do not have permission to view this invoice.");
          }
        } else {
          setError("Invoice not found.");
        }
      } catch (err) {
        console.error("Error fetching invoice:", err);
        setError("Failed to load invoice details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchInvoice();
  }, [user, invoiceId]);
  
  const getDateLocale = (languageCode?: string) => {
    return languageCode?.toLowerCase().startsWith("fr") ? fr : undefined;
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

  const handleStatusChange = async (newStatus: Invoice['status']) => {
    if (!invoice || !user || !invoice.id) return;
    if (isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    const invoiceRef = doc(db, "invoices", invoice.id);
    
    const updateData: { status: Invoice['status']; updatedAt: FieldValue; sentDate?: string | null; paidDate?: string | null } = {
      status: newStatus,
      updatedAt: serverTimestamp(),
    };

    if (newStatus === 'sent') {
      if (invoice.status === 'draft') { 
        updateData.sentDate = new Date().toISOString();
      } else if (invoice.status === 'paid') { 
        updateData.paidDate = null; 
      }
    } else if (newStatus === 'paid' && (invoice.status === 'sent' || invoice.status === 'overdue')) { 
      updateData.paidDate = new Date().toISOString();
    }
    
    try {
      await updateDoc(invoiceRef, updateData as any); 
      setInvoice(prev => {
        if (!prev) return null;
        const updatedInvoice = { 
          ...prev, 
          status: newStatus, 
          updatedAt: new Date() 
        };
        if (updateData.hasOwnProperty('sentDate')) updatedInvoice.sentDate = updateData.sentDate;
        if (updateData.hasOwnProperty('paidDate')) updatedInvoice.paidDate = updateData.paidDate;
        return updatedInvoice;
      });
      toast({
        title: "Status Updated",
        description: `Invoice ${invoice.invoiceNumber} status changed to ${newStatus}.`,
      });
    } catch (err) {
      console.error("Error updating invoice status:", err);
      toast({
        title: "Error",
        description: "Failed to update invoice status.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(false);
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
        <h2 className="text-xl font-semibold text-destructive mb-2">{s.errorLoadingInvoice}</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {s.backToInvoices}
        </Button>
      </div>
    );
  }

  if (!invoice) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">{s.invoiceNotFound}</h2>
        <p className="text-muted-foreground mb-6">{s.invoiceNotFoundMessage}</p>
        <Button onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {s.backToInvoices}
        </Button>
      </div>
    );
  }
  
  const printInvoice = () => window.print();

  const canMarkAsSent = invoice.status === 'draft';
  const canMarkAsPaid = invoice.status === 'sent' || invoice.status === 'overdue';
  const canMarkAsOverdue = invoice.status === 'sent';
  const canCancel = invoice.status === 'sent' || invoice.status === 'overdue';
  const canRevertToSent = invoice.status === 'paid';
  const canReopenAsDraft = invoice.status === 'cancelled';

  const hasAvailableActions = canMarkAsSent || canMarkAsPaid || canMarkAsOverdue || canCancel || canRevertToSent || canReopenAsDraft;

  return (
    <div className="invoice-page-wrapper">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden mb-8">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
            <Link href="/invoices">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">{s.backToInvoices}</span>
            </Link>
            </Button>
            <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
                {s.invoiceTitle} {invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground mt-1">
                {s.invoiceStatus} <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize ml-1">{invoice.status}</Badge>
            </p>
            </div>
        </div>
        <div className="flex gap-2 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isUpdatingStatus || !hasAvailableActions}>
                {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {s.changeStatus} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canMarkAsSent && (
                <DropdownMenuItem onClick={() => handleStatusChange('sent')} disabled={isUpdatingStatus}>
                  <Send className="mr-2 h-4 w-4" /> {s.markAsSent}
                </DropdownMenuItem>
              )}
              {canMarkAsPaid && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isUpdatingStatus}>
                      <DollarSign className="mr-2 h-4 w-4" /> {s.markAsPaid}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{s.confirmPaidTitle}</AlertDialogTitle>
                      <AlertDialogDescription>{s.confirmPaidDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{s.confirmPaidCancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('paid')} disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {s.confirmPaidAction}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canMarkAsOverdue && (
                <DropdownMenuItem onClick={() => handleStatusChange('overdue')} disabled={isUpdatingStatus}>
                  <AlertCircleIcon className="mr-2 h-4 w-4" /> {s.markAsOverdue}
                </DropdownMenuItem>
              )}
              {canCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive hover:!text-destructive focus:!text-destructive" disabled={isUpdatingStatus}>
                       <XCircle className="mr-2 h-4 w-4" /> {s.cancelInvoice}
                     </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{s.confirmCancelTitle}</AlertDialogTitle>
                      <AlertDialogDescription>{s.confirmCancelDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{s.confirmCancelCancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('cancelled')} disabled={isUpdatingStatus} className="bg-destructive hover:bg-destructive/90">
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {s.confirmCancelAction}
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
                      <Undo className="mr-2 h-4 w-4" /> {s.revertToSent}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{s.confirmRevertToSentTitle}</AlertDialogTitle>
                      <AlertDialogDescription>{s.confirmRevertToSentDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{s.confirmRevertToSentCancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('sent')} disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {s.confirmRevertToSentAction}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {canReopenAsDraft && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} disabled={isUpdatingStatus}>
                     <FilePenLine className="mr-2 h-4 w-4" /> {s.reopenAsDraft}
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{s.confirmReopenAsDraftTitle}</AlertDialogTitle>
                      <AlertDialogDescription>{s.confirmReopenAsDraftDescription}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{s.confirmReopenAsDraftCancel}</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleStatusChange('draft')} disabled={isUpdatingStatus}>
                        {isUpdatingStatus ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {s.confirmReopenAsDraftAction}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" onClick={printInvoice}>
            <Printer className="mr-2 h-4 w-4" /> {s.printPdf}
          </Button>
          <Button variant="outline" onClick={printInvoice}>
            <Download className="mr-2 h-4 w-4" /> {s.downloadPdf}
          </Button>
          { invoice.status === 'draft' || invoice.status === 'sent' ? (
            <Button asChild>
              <Link href={`/invoices/${invoice.id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> {s.edit}
              </Link>
            </Button>
          ) : (
             <Button disabled> 
                <Edit className="mr-2 h-4 w-4" /> {s.edit}
             </Button>
          )}
        </div>
      </div>


      <Card className="invoice-card-for-print shadow-lg print:shadow-none print:border-none relative">
        {invoice.watermarkLogoDataUrl && (
          <div 
            className="print-only-watermark-container"
            style={{
              backgroundImage: `url(${invoice.watermarkLogoDataUrl})`,
            }}
          ></div>
        )}
        <CardHeader className="print-card-header border-b print:pb-2 print:border-b-slate-200">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="flex-shrink-0">
              {invoice.logoDataUrl && (
                <img src={invoice.logoDataUrl} alt="Company Logo" className="h-16 max-w-[200px] object-contain mb-2 print:h-12" data-ai-hint="company logo"/>
              )}
              <h2 className="text-lg font-semibold text-primary print:text-base">{invoice.companyInvoiceHeader || "Your Company Name"}</h2>
            </div>
            <div className="text-left md:text-right flex-grow">
              <h3 className="text-3xl font-bold text-primary uppercase tracking-tight print:text-2xl">{s.invoiceTitle}</h3>
              <p className="text-muted-foreground text-sm print:text-xs"># {invoice.invoiceNumber}</p>
              {invoice.currency && <p className="text-sm text-muted-foreground mt-1 print:text-xs">{s.currency} {invoice.currency}</p>}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className={cn(
          "print-card-content pt-6 space-y-6 print:pt-4 print:space-y-4",
           invoice.companyInvoiceFooter ? "print-content-has-footer" : "print-content-no-footer"
        )}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <h4 className="font-semibold text-primary mb-1.5 print:text-sm">{s.billTo}</h4>
              <div className="space-y-0.5 text-sm text-muted-foreground print:text-xs">
                <p className="font-medium text-foreground">{invoice.clientName}</p>
                {invoice.clientCompany && <p>{invoice.clientCompany}</p>}
                {invoice.clientAddress && <p>{invoice.clientAddress.split('\\n').map((line, i) => (<span key={i}>{line}<br/></span>))}</p>}
                {invoice.clientEmail && <p>{invoice.clientEmail}</p>}
                {invoice.clientICE && <p>ICE: {invoice.clientICE}</p>}
              </div>
            </div>
            <div className="text-left md:text-right space-y-2 print:text-xs">
              <div>
                <h4 className="font-semibold text-primary mb-0.5 print:text-sm">{s.issueDate}</h4>
                <span className="text-muted-foreground">{format(new Date(invoice.issueDate), "PPP", { locale: getDateLocale(invoice.language) })}</span>
              </div>
              <div>
                <h4 className="font-semibold text-primary mb-0.5 print:text-sm">{s.dueDate}</h4>
                <span className="text-muted-foreground">{format(new Date(invoice.dueDate), "PPP", { locale: getDateLocale(invoice.language) })}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table className="print:text-xs">
              <TableHeader>
                <TableRow className="bg-muted/30 print:bg-slate-100">
                  <TableHead className="w-[50%] print:py-2">{s.itemDescription}</TableHead>
                  <TableHead className="text-center print:py-2">{s.itemQuantity}</TableHead>
                  <TableHead className="text-right print:py-2">{s.itemUnitPrice}</TableHead>
                  <TableHead className="text-right print:py-2">{s.itemTotal}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.items.map((item, index) => (
                  <TableRow key={index} className="print:border-b-slate-200">
                    <TableCell className="font-medium print:py-1.5">{item.description}</TableCell>
                    <TableCell className="text-center print:py-1.5">{item.quantity}</TableCell>
                    <TableCell className="text-right print:py-1.5">{item.unitPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right print:py-1.5">{item.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 print:pt-2">
            <div className="md:col-span-2 space-y-3 print:space-y-2">
              {invoice.notes && (
                <div>
                  <h4 className="font-semibold text-primary mb-1.5 print:text-sm">{s.notes}</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap print:text-xs">{invoice.notes}</p>
                </div>
              )}
              {invoice.appliedDefaultPaymentTerms && (
                 <div>
                    <h4 className="font-semibold text-primary mb-1.5 print:text-sm">{s.paymentTerms}</h4>
                    <p className="text-sm text-muted-foreground print:text-xs">{invoice.appliedDefaultPaymentTerms}</p>
                 </div>
              )}
            </div>
            <div className="space-y-2 p-4 bg-secondary/20 rounded-lg shadow-sm print:bg-transparent print:shadow-none print:p-3 print:border print:border-slate-200 print:rounded-md">
              <div className="flex justify-between text-sm print:text-xs">
                <span className="text-muted-foreground">{s.subtotal}</span>
                <span className="font-medium">{invoice.currency} {invoice.subtotal.toFixed(2)}</span>
              </div>
              {invoice.taxAmount !== undefined && invoice.taxAmount !== 0 && (
                <div className="flex justify-between text-sm print:text-xs">
                  <span className="text-muted-foreground">{s.tax} ({invoice.taxRate || 0}%):</span>
                  <span className="font-medium">{invoice.currency} {invoice.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-primary border-t border-border pt-2 mt-2 print:text-lg print:pt-1 print:mt-1 print:border-slate-300">
                <span>{s.total}</span>
                <span>{invoice.currency} {invoice.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          
          {invoice.language?.toLowerCase().startsWith("fr") && (
            <div className="pt-4 mt-4 border-t print:pt-2 print:mt-2 print:border-slate-200">
              <p className="text-sm text-muted-foreground print:text-xs">
                {s.stoppedAtTheSumOf} <strong className="text-foreground">{numberToFrenchWords(invoice.totalAmount, invoice.currency)}</strong>.
              </p>
              <p className="text-sm text-muted-foreground mt-1 print:text-xs">
                ({s.thatIs} {invoice.currency} {invoice.totalAmount.toFixed(2)})
              </p>
            </div>
          )}

        </CardContent>

        {invoice.companyInvoiceFooter && (
          <CardFooter className={cn(
            "print-card-footer border-t print:mt-2 print:pt-2 print:pb-2",
            invoice.companyInvoiceFooter ? "has-content" : ""
          )}>
            <p className="text-xs text-muted-foreground text-center w-full print:text-[0.65rem]">{invoice.companyInvoiceFooter}</p>
          </CardFooter>
        )}
      </Card>

       <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            background-color: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            font-size: 9pt !important; 
          }
          html {
            background-color: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          header, 
          footer { 
            display: none !important;
          }

          main.container { 
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            flex-grow: 0 !important; 
            overflow: visible !important;
            display: block !important; 
          }
          
          .invoice-page-wrapper {
              margin: 0 !important;
              padding: 0 !important; 
              width: 100% !important;
              min-height: 0 !important; 
          }

          .invoice-card-for-print {
            padding: 0 !important; 
            margin: 0 !important; 
            box-shadow: none !important; 
            border: none !important; 
            width: 100% !important; 
            min-height: 282mm; 
            box-sizing: border-box !important;
            page-break-inside: avoid !important;
            background-color: #fff !important; 
            position: relative; 
            display: flex;
            flex-direction: column;
          }
          
          .invoice-card-for-print > .print-card-header,
          .invoice-card-for-print > .print-card-content,
          .invoice-card-for-print > .print-card-footer.has-content {
            padding-left: 0.75cm !important;
            padding-right: 0.75cm !important;
            box-sizing: border-box !important;
          }

          .invoice-card-for-print > .print-card-header {
            padding-top: 0.75cm !important;
            padding-bottom: 0.5cm !important; 
            border-bottom-width: 1px !important;
            border-color: #e2e8f0 !important; 
          }
           
          .invoice-card-for-print > .print-card-content {
            padding-top: 0.5cm !important;
            flex-grow: 1; 
          }
          .invoice-card-for-print > .print-card-content.print-content-has-footer {
            padding-bottom: 2.5cm !important;
          }
          .invoice-card-for-print > .print-card-content.print-content-no-footer {
            padding-bottom: 0.75cm !important;
          }

          .invoice-card-for-print > .print-card-footer.has-content {
            position: absolute !important;
            bottom: 0 !important;
            left: 0 !important;
            width: 100% !important;
            padding-top: 0.35cm !important;
            padding-bottom: 0.35cm !important; 
            border-top-width: 1px !important;
            border-color: #e2e8f0 !important; 
            margin-top: 0 !important; 
            text-align: center !important;
            background-color: #fff !important; 
            page-break-inside: avoid !important;
          }
           .invoice-card-for-print > .print-card-footer:not(.has-content) {
             display: none !important;
           }
          
          .print-only-watermark-container {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0; 
            background-repeat: no-repeat;
            background-position: center center;
            background-size: 60% auto; 
            opacity: 0.07; 
            pointer-events: none;
            display: block !important; 
          }
          .screen-only-watermark-text { display: none !important; }


          .invoice-card-for-print .text-3xl { font-size: 1.75rem !important; }
          .invoice-card-for-print .print\\:text-2xl { font-size: 1.5rem !important; }
          .invoice-card-for-print .text-lg { font-size: 1.125rem !important; }
          .invoice-card-for-print .print\\:text-base { font-size: 1rem !important; }
          .invoice-card-for-print .print\\:text-sm { font-size: 0.8rem !important; }
          .invoice-card-for-print .print\\:text-xs { font-size: 0.7rem !important; }
          .invoice-card-for-print .print\\:text-\\[0\\.65rem\\] { font-size: 0.65rem !important; }

          .invoice-card-for-print .bg-secondary\\/30 { background-color: transparent !important; } 
          .invoice-card-for-print .print\\:bg-slate-50 { background-color: #f8fafc !important; }
          
          .invoice-card-for-print table th, .invoice-card-for-print table td { padding: 0.35rem 0.5rem !important; }
          .invoice-card-for-print .print\\:py-2 { padding-top: 0.35rem !important; padding-bottom: 0.35rem !important; }
          .invoice-card-for-print .print\\:py-1\\.5 { padding-top: 0.25rem !important; padding-bottom: 0.25rem !important; }

          .invoice-card-for-print .print\\:border-slate-200 { border-color: #e2e8f0 !important; }
          .invoice-card-for-print .print\\:border-slate-300 { border-color: #cbd5e1 !important; }
          .invoice-card-for-print .print\\:bg-slate-100 { background-color: #f1f5f9 !important; }


          @page {
            size: A4 portrait; 
            margin: 0; 
          }

          .print\\:hidden { display: none !important; }
        }
        @media screen {
           .print-only-watermark-container { display: none !important; }
        }
      `}</style>
    </div>
  );
}
