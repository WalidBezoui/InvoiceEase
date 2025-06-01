"use client";

import InvoiceForm from "@/components/invoices/invoice-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewInvoicePage() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Invoices</span>
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Create New Invoice</h1>
          <p className="text-muted-foreground mt-1">Fill in the details below to generate a new invoice.</p>
        </div>
      </div>
      
      <InvoiceForm />
    </div>
  );
}
