
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription as UiCardDescription } from "@/components/ui/card"; // Renamed CardDescription
import { Form, FormControl, FormDescription as UiFormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { UserPreferences } from "@/lib/types";
import { Loader2, Save } from "lucide-react";
import { useLanguage } from "@/hooks/use-language"; // Import useLanguage

const preferencesSchema = z.object({
  invoiceHeader: z.string().optional(),
  invoiceFooter: z.string().optional(),
  invoiceWatermark: z.string().optional(),
  currency: z.string().min(2, "Currency code must be at least 2 letters").optional().default("MAD"),
  language: z.string().min(2, "Language code must be 2 letters").optional().default("fr"),
  defaultNotes: z.string().optional(),
  defaultPaymentTerms: z.string().optional(),
  defaultTaxRate: z.coerce.number().min(0).max(100).optional().default(0),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

const currencies = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "MAD", name: "Moroccan Dirham" },
];

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español (Spanish)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
  { code: "ar", name: "العربية (Arabic)" },
];

export default function PreferencesForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { t, isLoadingLocale } = useLanguage(); // Use language hook
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      invoiceHeader: "",
      invoiceFooter: "",
      invoiceWatermark: "",
      currency: "MAD",
      language: "fr",
      defaultNotes: "",
      defaultPaymentTerms: "",
      defaultTaxRate: 0,
    },
  });

  useEffect(() => {
    async function fetchPreferences() {
      if (user) {
        setIsFetching(true);
        const prefDocRef = doc(db, "userPreferences", user.uid);
        const prefDocSnap = await getDoc(prefDocRef);
        if (prefDocSnap.exists()) {
          const data = prefDocSnap.data() as UserPreferences;
          form.reset({
            invoiceHeader: data.invoiceHeader || "",
            invoiceFooter: data.invoiceFooter || "",
            invoiceWatermark: data.invoiceWatermark || "",
            currency: data.currency || "MAD",
            language: data.language || "fr",
            defaultNotes: data.defaultNotes || "", 
            defaultPaymentTerms: data.defaultPaymentTerms || "",
            defaultTaxRate: data.defaultTaxRate || 0,
          });
        } else {
          form.reset({
            invoiceHeader: "",
            invoiceFooter: "",
            invoiceWatermark: "",
            currency: "MAD",
            language: "fr",
            defaultNotes: "",
            defaultPaymentTerms: "",
            defaultTaxRate: 0,
          });
        }
        setIsFetching(false);
      } else {
        setIsFetching(false);
      }
    }
    fetchPreferences();
  }, [user, form]);

  async function onSubmit(values: PreferencesFormValues) {
    if (!user) {
      toast({ title: t('preferencesPage.generalForm.toast.errorTitle'), description: t('preferencesPage.generalForm.toast.authError'), variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const prefDocRef = doc(db, "userPreferences", user.uid);
      await setDoc(prefDocRef, values, { merge: true }); 
      toast({
        title: t('preferencesPage.generalForm.toast.successTitle'),
        description: t('preferencesPage.generalForm.toast.successDesc'),
      });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: t('preferencesPage.generalForm.toast.errorTitle'),
        description: t('preferencesPage.generalForm.toast.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (isFetching || isLoadingLocale) {
     return (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('preferencesPage.generalForm.loadingMessage')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(5)].map((_, i) => ( <div key={i} className="h-10 bg-muted rounded animate-pulse"/> ))}
          </CardContent>
        </Card>
     );
  }

  return (
    <Card className="shadow-lg mt-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('preferencesPage.generalForm.cardTitle')}</CardTitle>
            <UiCardDescription>{t('preferencesPage.generalForm.cardDescription')}</UiCardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField control={form.control} name="invoiceHeader" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('preferencesPage.generalForm.labels.invoiceHeader')}</FormLabel>
                <FormControl><Textarea placeholder={t('preferencesPage.generalForm.placeholders.invoiceHeader')} {...field} /></FormControl>
                <UiFormDescription>{t('preferencesPage.generalForm.descriptions.invoiceHeader')}</UiFormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="invoiceFooter" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('preferencesPage.generalForm.labels.invoiceFooter')}</FormLabel>
                <FormControl><Textarea placeholder={t('preferencesPage.generalForm.placeholders.invoiceFooter')} {...field} /></FormControl>
                 <UiFormDescription>{t('preferencesPage.generalForm.descriptions.invoiceFooter')}</UiFormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="invoiceWatermark" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('preferencesPage.generalForm.labels.invoiceWatermarkText')}</FormLabel>
                <FormControl><Input placeholder={t('preferencesPage.generalForm.placeholders.invoiceWatermarkText')} {...field} /></FormControl>
                <UiFormDescription>{t('preferencesPage.generalForm.descriptions.invoiceWatermarkText')}</UiFormDescription>
                <FormMessage />
              </FormItem>
            )} />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('preferencesPage.generalForm.labels.currency')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('preferencesPage.generalForm.placeholders.selectCurrency')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="language" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('preferencesPage.generalForm.labels.language')}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder={t('preferencesPage.generalForm.placeholders.selectLanguage')} /></SelectTrigger></FormControl>
                    <SelectContent>
                      {languages.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
               <FormField control={form.control} name="defaultTaxRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('preferencesPage.generalForm.labels.defaultTaxRate')}</FormLabel>
                  <FormControl><Input type="number" placeholder={t('preferencesPage.generalForm.placeholders.defaultTaxRate')} {...field} min="0" max="100" step="0.01" /></FormControl>
                  <UiFormDescription>{t('preferencesPage.generalForm.descriptions.defaultTaxRate')}</UiFormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

             <FormField control={form.control} name="defaultNotes" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('preferencesPage.generalForm.labels.defaultNotes')}</FormLabel>
                <FormControl><Textarea placeholder={t('preferencesPage.generalForm.placeholders.defaultNotes')} {...field} /></FormControl>
                 <UiFormDescription>{t('preferencesPage.generalForm.descriptions.defaultNotes')}</UiFormDescription>
                <FormMessage />
              </FormItem>
            )} />
             <FormField control={form.control} name="defaultPaymentTerms" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('preferencesPage.generalForm.labels.defaultPaymentTerms')}</FormLabel>
                <FormControl><Input placeholder={t('preferencesPage.generalForm.placeholders.defaultPaymentTerms')} {...field} /></FormControl>
                <UiFormDescription>{t('preferencesPage.generalForm.descriptions.defaultPaymentTerms')}</UiFormDescription>
                <FormMessage />
              </FormItem>
            )} />

          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button type="submit" disabled={isLoading || isFetching}>
              {(isLoading || isFetching) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" /> {t('preferencesPage.generalForm.buttonSave')}
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

      