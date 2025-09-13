
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
import { collection, addDoc, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import type { Product, ProductFormData } from "@/lib/types";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

const productFormSchema = z.object({
  name: z.string().min(2, "Product/Service name must be at least 2 characters."),
  description: z.string().min(2, "Description must be at least 2 characters."),
  unitPrice: z.coerce.number().min(0, "Unit price must be a non-negative number."),
});

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

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      description: initialData?.description || "",
      unitPrice: initialData?.unitPrice || 0,
    },
  });

  async function onSubmit(values: ProductFormData) {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.uid,
      name: values.name,
      description: values.description,
      unitPrice: values.unitPrice,
    };

    try {
      if (initialData?.id) {
        const productRef = doc(db, "products", initialData.id);
        await updateDoc(productRef, { ...productData, updatedAt: serverTimestamp() });
        toast({ title: t('productForm.toast.productUpdated') });
        if (onSave) onSave(initialData.id); else router.push("/products");
      } else {
        const docRef = await addDoc(collection(db, "products"), {
          ...productData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: t('productForm.toast.productAdded') });
        if (onSave) onSave(docRef.id);
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
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('productForm.labels.name')}</FormLabel>
                <FormControl><Input placeholder={t('productForm.placeholders.name')} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('productForm.labels.description')}</FormLabel>
                <FormControl><Textarea placeholder={t('productForm.placeholders.description')} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="unitPrice" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('productForm.labels.unitPrice')}</FormLabel>
                <FormControl><Input type="number" step="0.01" placeholder={t('productForm.placeholders.unitPrice')} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
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
