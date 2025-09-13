
"use client";

import ProductForm from "@/components/products/product-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/use-language";

export default function NewProductPage() {
  const { t } = useLanguage();
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t('productForm.buttons.cancel')}</span>
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{t('productForm.addTitle')}</h1>
          <p className="text-muted-foreground mt-1">{t('productForm.addDescription')}</p>
        </div>
      </div>
      
      <ProductForm />
    </div>
  );
}
