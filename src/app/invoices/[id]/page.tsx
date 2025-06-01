
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download, Edit, Loader2, AlertTriangle, Printer } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

export default function InvoiceDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "overdue": return "destructive";
      case "draft": return "outline";
      case "cancelled": return "destructive"
      default: return "outline";
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
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Invoice</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
        </Button>
      </div>
    );
  }

  if (!invoice) {
    return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">Invoice Not Found</h2>
        <p className="text-muted-foreground mb-6">The invoice you are looking for does not exist or could not be loaded.</p>
        <Button onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Invoices
        </Button>
      </div>
    );
  }
  
  const printInvoice = () => window.print();


  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" asChild>
            <Link href="/invoices">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back to Invoices</span>
            </Link>
            </Button>
            <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
                Invoice {invoice.invoiceNumber}
            </h1>
            <p className="text-muted-foreground mt-1">
                Details for invoice <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize ml-1">{invoice.status}</Badge>
            </p>
            </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printInvoice}>
            <Printer className="mr-2 h-4 w-4" /> Print / PDF
          </Button>
          <Button variant="outline" disabled>
            <Download className="mr-2 h-4 w-4" /> Download PDF (Soon)
          </Button>
          <Button asChild disabled> {/* TODO: Enable and link to edit page */}
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Printable Invoice Section */}
      <Card className="shadow-lg print:shadow-none print:border-none">
        <CardHeader className="border-b print:border-b-0">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4">
            <div>
              {invoice.logoDataUrl && (
                <img src={invoice.logoDataUrl} alt="Company Logo" className="h-16 object-contain mb-4" data-ai-hint="company logo"/>
              )}
              <h2 className="text-2xl font-bold text-primary">{invoice.companyInvoiceHeader || "Your Company Name"}</h2>
              {/* Add more company details if available from preferences */}
            </div>
            <div className="text-left md:text-right">
              <h3 className="text-3xl font-bold text-primary uppercase">Invoice</h3>
              <p className="text-muted-foreground"># {invoice.invoiceNumber}</p>
              <p className="text-sm text-muted-foreground mt-1">Currency: {invoice.currency}</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold text-primary mb-1">Bill To:</h4>
              <p className="font-medium">{invoice.clientName}</p>
              {invoice.clientCompany && <p className="text-sm text-muted-foreground">{invoice.clientCompany}</p>}
              {invoice.clientAddress && <p className="text-sm text-muted-foreground">{invoice.clientAddress.split('\n').map((line, i) => (<span key={i}>{line}<br/></span>))}</p>}
              {invoice.clientEmail && <p className="text-sm text-muted-foreground">{invoice.clientEmail}</p>}
              {invoice.clientICE && <p className="text-sm text-muted-foreground">ICE: {invoice.clientICE}</p>}
            </div>
            <div className="text-left md:text-right">
              <div className="mb-2">
                <span className="font-semibold text-primary">Issue Date: </span>
                <span>{format(new Date(invoice.issueDate), "MMMM dd, yyyy")}</span>
              </div>
              <div>
                <span className="font-semibold text-primary">Due Date: </span>
                <span>{format(new Date(invoice.dueDate), "MMMM dd, yyyy")}</span>
              </div>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Description</TableHead>
                <TableHead className="text-center">Quantity</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right">{item.unitPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right">{item.total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              {invoice.notes && (
                <>
                  <h4 className="font-semibold text-primary mb-1">Notes:</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </>
              )}
              {invoice.appliedDefaultPaymentTerms && (
                 <div className="mt-4">
                    <h4 className="font-semibold text-primary mb-1">Payment Terms:</h4>
                    <p className="text-sm text-muted-foreground">{invoice.appliedDefaultPaymentTerms}</p>
                 </div>
              )}
            </div>
            <div className="space-y-2 text-right">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="font-medium">{invoice.subtotal.toFixed(2)} {invoice.currency}</span>
              </div>
              {invoice.taxAmount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({invoice.taxRate || 0}%):</span>
                  <span className="font-medium">{invoice.taxAmount.toFixed(2)} {invoice.currency}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold text-primary border-t pt-2 mt-2">
                <span>Total:</span>
                <span>{invoice.totalAmount.toFixed(2)} {invoice.currency}</span>
              </div>
            </div>
          </div>
        </CardContent>

        {invoice.companyInvoiceFooter && (
          <CardFooter className="border-t mt-6 pt-4 print:border-t-0">
            <p className="text-xs text-muted-foreground text-center w-full">{invoice.companyInvoiceFooter}</p>
          </CardFooter>
        )}
      </Card>

      {/* Actions for different statuses can be added here, e.g., Mark as Paid, Send Invoice */}
      <div className="flex justify-end gap-2 print:hidden">
        {invoice.status === 'draft' && <Button variant="outline">Mark as Sent (Soon)</Button>}
        {(invoice.status === 'sent' || invoice.status === 'overdue') && <Button>Mark as Paid (Soon)</Button>}
      </div>

       <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print\\:hidden { display: none !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-none { border: none !important; }
          .print\\:border-b-0 { border-bottom: 0 !important; }
          .print\\:pt-0 { padding-top: 0 !important; }
          .print\\:space-y-4 > :not([hidden]) ~ :not([hidden]) {
             --tw-space-y-reverse: 0;
             margin-top: calc(1rem * calc(1 - var(--tw-space-y-reverse)));
             margin-bottom: calc(1rem * var(--tw-space-y-reverse));
           }
           .print\\:text-sm { font-size: 0.875rem; line-height: 1.25rem; }
           .print\\:w-full { width: 100% !important; }
           /* Add any other print-specific styles here */
        }
      `}</style>
    </div>
  );
}
