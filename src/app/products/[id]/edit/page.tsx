
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import ProductForm from "@/components/products/product-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/use-language";

export default function EditProductPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { t } = useLanguage();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      if (!user || !productId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const productRef = doc(db, "products", productId);
        const docSnap = await getDoc(productRef);

        if (docSnap.exists()) {
          const fetchedProduct = { id: docSnap.id, ...docSnap.data() } as Product;
          if (fetchedProduct.userId === user.uid) {
            setProduct(fetchedProduct);
          } else {
            setError(t('productForm.toast.authError'));
          }
        } else {
          setError(t('productsPage.toast.deleteErrorDesc'));
        }
      } catch (err) {
        console.error("Error fetching product for editing:", err);
        setError(t('productForm.toast.errorSaving'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchProduct();
  }, [user, productId, t]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10 rounded-md" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-10 w-1/3 ml-auto" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">{t('productForm.toast.errorSaving')}</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('siteNav.products')}
        </Button>
      </div>
    );
  }

  if (!product) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">{t('productsPage.noProductsMatchSearch')}</h2>
        <p className="text-muted-foreground mb-6">{t('productsPage.noProductsMatchSearchDesc')}</p>
        <Button onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('siteNav.products')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/products">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">{t('siteNav.products')}</span>
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{t('productForm.editTitle')}: {product.name}</h1>
          <p className="text-muted-foreground mt-1">{t('productForm.editDescription')}</p>
        </div>
      </div>
      
      <ProductForm initialData={product} />
    </div>
  );
}
