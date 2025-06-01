
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription as ShadcnCardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { UserPreferences } from "@/lib/types";
import { Loader2, Save } from "lucide-react";

const preferencesSchema = z.object({
  invoiceHeader: z.string().optional(),
  invoiceFooter: z.string().optional(),
  invoiceWatermark: z.string().optional(),
  currency: z.string().min(3, "Currency code must be 3 letters").optional().default("USD"),
  language: z.string().min(2, "Language code must be 2 letters").optional().default("en"),
  defaultNotes: z.string().optional(),
  defaultPaymentTerms: z.string().optional(),
});

type PreferencesFormValues = z.infer<typeof preferencesSchema>;

const currencies = [
  { code: "USD", name: "US Dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "AUD", name: "Australian Dollar" },
];

const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Español (Spanish)" },
  { code: "fr", name: "Français (French)" },
  { code: "de", name: "Deutsch (German)" },
];

export default function PreferencesForm() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const form = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      invoiceHeader: "",
      invoiceFooter: "",
      invoiceWatermark: "",
      currency: "USD",
      language: "en",
      defaultNotes: "",
      defaultPaymentTerms: "",
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
            currency: data.currency || "USD",
            language: data.language || "en",
            // Assuming defaultNotes and defaultPaymentTerms are also part of UserPreferences
            defaultNotes: (data as any).defaultNotes || "", 
            defaultPaymentTerms: (data as any).defaultPaymentTerms || "",
          });
        }
        setIsFetching(false);
      }
    }
    fetchPreferences();
  }, [user, form]);

  async function onSubmit(values: PreferencesFormValues) {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const prefDocRef = doc(db, "userPreferences", user.uid);
      // Use setDoc with merge:true to avoid overwriting logoUrl managed by LogoUploader
      await setDoc(prefDocRef, values, { merge: true }); 
      toast({
        title: "Preferences Saved",
        description: "Your invoice preferences have been updated.",
      });
    } catch (error) {
      console.error("Error saving preferences:", error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }
  
  if (isFetching) {
     return (
        <Card className="shadow-lg mt-6">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Loading Preferences...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, i) => ( <div key={i} className="h-10 bg-muted rounded animate-pulse"/> ))}
          </CardContent>
        </Card>
     );
  }

  return (
    <Card className="shadow-lg mt-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Invoice Content Customization</CardTitle>
            <ShadcnCardDescription>Personalize the default text and elements on your invoices.</ShadcnCardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <FormField control={form.control} name="invoiceHeader" render={({ field }) => (
              <FormItem>
                <FormLabel>Default Invoice Header</FormLabel>
                <FormControl><Textarea placeholder="e.g., Your Company Name & Address" {...field} /></FormControl>
                <FormDescription>This will appear at the top of your invoices.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="invoiceFooter" render={({ field }) => (
              <FormItem>
                <FormLabel>Default Invoice Footer</FormLabel>
                <FormControl><Textarea placeholder="e.g., Thank you for your business! Payment due in 30 days." {...field} /></FormControl>
                 <FormDescription>This will appear at the bottom of your invoices.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="invoiceWatermark" render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Watermark Text (Optional)</FormLabel>
                <FormControl><Input placeholder="e.g., DRAFT, PAID" {...field} /></FormControl>
                <FormDescription>Text to display as a watermark (e.g., for draft or paid invoices).</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <FormField control={form.control} name="currency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Currency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="language" render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Language</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select language" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {languages.map(l => <SelectItem key={l.code} value={l.code}>{l.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

             <FormField control={form.control} name="defaultNotes" render={({ field }) => (
              <FormItem>
                <FormLabel>Default Notes for New Invoices</FormLabel>
                <FormControl><Textarea placeholder="e.g., Standard terms and conditions" {...field} /></FormControl>
                 <FormDescription>These notes will be pre-filled on new invoices.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />
             <FormField control={form.control} name="defaultPaymentTerms" render={({ field }) => (
              <FormItem>
                <FormLabel>Default Payment Terms</FormLabel>
                <FormControl><Input placeholder="e.g., Net 30 Days" {...field} /></FormControl>
                <FormDescription>Default payment terms for new invoices.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

          </CardContent>
          <CardFooter className="border-t pt-6">
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" /> Save Preferences
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
