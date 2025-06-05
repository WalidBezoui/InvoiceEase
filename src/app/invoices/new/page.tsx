
"use client";

import InvoiceForm from "@/components/invoices/invoice-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewInvoicePage() {
  const { t, isLoadingLocale } = useLanguage();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/invoices">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t('newInvoicePage.backToInvoices', { default: "Back to Invoices"})}</span>
          </Link>
        </Button>
        <div>
          {isLoadingLocale ? (
            <>
              <Skeleton className="h-10 w-72 mb-2" />
              <Skeleton className="h-5 w-96" />
            </>
          ) : (
            <>
              <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
                {t('newInvoicePage.title', { default: "Create New Invoice"})}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('newInvoicePage.description', { default: "Fill in the details below to generate a new invoice."})}
              </p>
            </>
          )}
        </div>
      </div>
      
      {/* InvoiceForm is now the main content block below the header, without an extra Card wrapper */}
      <InvoiceForm />
    </div>
  );
}
