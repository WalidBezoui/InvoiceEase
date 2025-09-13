
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from "firebase/firestore";
import type { Product } from "@/lib/types";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

const productFormSchema = z.object({
  name: z.string().min(2, "Product/Service name must be at least 2 characters."),
  reference: z.string().optional(),
  description: z.string().optional(),
  sellingPrice: z.coerce.number().min(0, "Selling price must be a non-negative number."),
  purchasePrice: z.coerce.number().min(0, "Purchase price must be a non-negative number.").optional(),
  stock: z.coerce.number().int("Stock must be a whole number.").optional(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;


interface ProductFormProps {
  initialData?: Product;
  onSave?: (productId: string) => void; 
}

export default function ProductForm({ initialData, onSave }: ProductFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: initialData ? {
        ...initialData,
        purchasePrice: initialData.purchasePrice ?? 0,
        stock: initialData.stock ?? 0,
    } : {
      name: "",
      reference: "",
      description: "",
      sellingPrice: 0,
      purchasePrice: 0,
      stock: 0,
    },
  });

  async function onSubmit(values: ProductFormValues) {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const productData = {
      userId: user.uid,
      name: values.name,
      reference: values.reference || "",
      description: values.description || "",
      sellingPrice: values.sellingPrice,
      purchasePrice: values.purchasePrice,
      stock: values.stock,
      updatedAt: serverTimestamp(),
    };

    try {
      if (initialData?.id) {
        const productRef = doc(db, "products", initialData.id);
        await updateDoc(productRef, productData);
        toast({ title: t('productForm.toast.productUpdated') });
        if (onSave) onSave(initialData.id); else router.push(`/products/${initialData.id}`);
      } else {
        const batch = writeBatch(db);
        const productRef = doc(collection(db, "products"));
        
        batch.set(productRef, {
          ...productData,
          createdAt: serverTimestamp(),
        });
        
        if (values.stock !== undefined && values.stock > 0) {
            const transactionRef = doc(collection(db, "productTransactions"));
            batch.set(transactionRef, {
                userId: user.uid,
                productId: productRef.id,
                type: 'initial',
                quantityChange: values.stock,
                newStock: values.stock,
                notes: 'Initial stock',
                transactionDate: serverTimestamp(),
            });
        }

        await batch.commit();
        
        toast({ title: t('productForm.toast.productAdded') });
        if (onSave) onSave(productRef.id);
        else router.push("/products");
      }
    } catch (error) {
      console.error("Error saving product:", error);
      toast({ title: "Error", description: t('productForm.toast.errorSaving'), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">
              {initialData ? t('productForm.editTitle') : t('productForm.addTitle')}
            </CardTitle>
            <CardDescription>
              {initialData ? t('productForm.editDescription') : t('productForm.addDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('productForm.labels.name')}</FormLabel>
                  <FormControl><Input placeholder={t('productForm.placeholders.name')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('productForm.labels.reference')}</FormLabel>
                  <FormControl><Input placeholder={t('productForm.placeholders.reference')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('productForm.labels.description')}</FormLabel>
                <FormControl><Textarea placeholder={t('productForm.placeholders.description')} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="sellingPrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('productForm.labels.sellingPrice')}</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder={t('productForm.placeholders.sellingPrice')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="purchasePrice" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('productForm.labels.purchasePrice')}</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder={t('productForm.placeholders.purchasePrice')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="stock" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('productForm.labels.stock')}</FormLabel>
                  <FormControl><Input type="number" step="1" placeholder={t('productForm.placeholders.stock')} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>{t('productForm.buttons.cancel')}</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {initialData ? t('productForm.buttons.saveChanges') : t('productForm.buttons.addProduct')}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
