
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2, Save, Loader2 } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc } from "firebase/firestore";
import type { Invoice, InvoiceItem, UserPreferences } from "@/lib/types";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be at least 0.01"), // Allow fractional quantities
  unitPrice: z.coerce.number().min(0.01, "Unit price must be positive"),
});

const formSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address").or(z.literal("")), // Allow empty string
  clientAddress: z.string().optional(),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  issueDate: z.date({ required_error: "Issue date is required" }),
  dueDate: z.date({ required_error: "Due date is required" }),
  items: z.array(invoiceItemSchema).min(1, "At least one item is required"),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0), // Percentage
});

type InvoiceFormValues = z.infer<typeof formSchema>;

export default function InvoiceForm({ initialData }: { initialData?: Partial<Invoice> }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    async function fetchPrefs() {
      if (user) {
        setIsPrefsLoading(true);
        try {
          const prefDocRef = doc(db, "userPreferences", user.uid);
          const prefDocSnap = await getDoc(prefDocRef);
          if (prefDocSnap.exists()) {
            setUserPrefs(prefDocSnap.data() as UserPreferences);
          } else {
            setUserPrefs({ currency: "MAD", language: "fr" }); // Default if no prefs found
          }
        } catch (error) {
          console.error("Error fetching user preferences:", error);
          toast({ title: "Error", description: "Could not load user preferences.", variant: "destructive" });
          setUserPrefs({ currency: "MAD", language: "fr" }); // Fallback
        } finally {
          setIsPrefsLoading(false);
        }
      } else {
        setIsPrefsLoading(false);
      }
    }
    fetchPrefs();
  }, [user, toast]);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: initialData?.clientName || "",
      clientEmail: initialData?.clientEmail || "",
      clientAddress: initialData?.clientAddress || "",
      invoiceNumber: initialData?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      issueDate: initialData?.issueDate ? new Date(initialData.issueDate) : new Date(),
      dueDate: initialData?.dueDate ? new Date(initialData.dueDate) : new Date(new Date().setDate(new Date().getDate() + 30)),
      items: initialData?.items?.map(item => ({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice })) || [{ description: "", quantity: 1, unitPrice: 0 }],
      notes: initialData?.notes || userPrefs?.defaultNotes || "",
      taxRate: initialData?.taxRate || 0,
    },
  });
  
  useEffect(() => {
    if (userPrefs && !initialData) { // Only apply pref notes if it's a new invoice and prefs are loaded
        form.reset({
            ...form.getValues(), // Keep existing form values if any
            notes: form.getValues().notes || userPrefs.defaultNotes || "", // Prioritize existing notes if user typed something before prefs loaded
        });
    }
  }, [userPrefs, initialData, form]);


  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const watchTaxRate = form.watch("taxRate");

  const calculateSubtotal = () => {
    return watchItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);
  };

  const calculateTaxAmount = (subtotalValue: number) => {
    const taxRateValue = watchTaxRate || 0;
    return subtotalValue * (taxRateValue / 100);
  };

  const subtotal = calculateSubtotal();
  const taxAmount = calculateTaxAmount(subtotal);
  const totalAmount = subtotal + taxAmount;

  async function onSubmit(values: InvoiceFormValues) {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in to create an invoice.", variant: "destructive" });
      return;
    }
    if (isPrefsLoading) {
      toast({ title: "Please wait", description: "User preferences are still loading.", variant: "default" });
      return;
    }

    setIsSaving(true);

    const invoiceItemsToSave: InvoiceItem[] = values.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const invoiceDataToSave: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.uid,
      invoiceNumber: values.invoiceNumber,
      clientName: values.clientName,
      clientEmail: values.clientEmail || "",
      clientAddress: values.clientAddress || "",
      issueDate: format(values.issueDate, "yyyy-MM-dd"),
      dueDate: format(values.dueDate, "yyyy-MM-dd"),
      items: invoiceItemsToSave,
      subtotal,
      taxRate: values.taxRate,
      taxAmount,
      totalAmount,
      status: 'draft',
      notes: values.notes || "",
      currency: userPrefs?.currency || "MAD",
      language: userPrefs?.language || "fr",
      logoDataUrl: userPrefs?.logoDataUrl || null,
      companyInvoiceHeader: userPrefs?.invoiceHeader || "",
      companyInvoiceFooter: userPrefs?.invoiceFooter || "",
      appliedDefaultNotes: userPrefs?.defaultNotes || "",
      appliedDefaultPaymentTerms: userPrefs?.defaultPaymentTerms || "",
    };

    try {
      const docRef = await addDoc(collection(db, "invoices"), {
        ...invoiceDataToSave,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast({
        title: "Invoice Saved",
        description: `Invoice ${values.invoiceNumber} has been saved.`,
      });
      router.push(`/invoices/${docRef.id}`); 
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error Saving Invoice",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Client Information</CardTitle>
            <CardDescription>Details of the person or company you are invoicing.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField control={form.control} name="clientName" render={({ field }) => (
              <FormItem>
                <FormLabel>Client Name</FormLabel>
                <FormControl><Input placeholder="Acme Corp" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientEmail" render={({ field }) => (
              <FormItem>
                <FormLabel>Client Email (Optional)</FormLabel>
                <FormControl><Input placeholder="contact@acme.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientAddress" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Client Address (Optional)</FormLabel>
                <FormControl><Textarea placeholder="123 Main St, Anytown, USA" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Invoice Details</CardTitle>
             <CardDescription>Core details for this invoice.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>Invoice Number</FormLabel>
                <FormControl><Input placeholder="INV-2023-001" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="issueDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Issue Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Due Date</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Invoice Items</CardTitle>
            <CardDescription>Add products or services provided.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((item, index) => (
              <div key={item.id} className="flex flex-col md:flex-row gap-4 items-start p-4 border rounded-md bg-secondary/30">
                <FormField control={form.control} name={`items.${index}.description`} render={({ field: itemField }) => (
                  <FormItem className="flex-grow">
                    <FormLabel>Description</FormLabel>
                    <FormControl><Input placeholder="Service or Product Name" {...itemField} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`items.${index}.quantity`} render={({ field: itemField }) => (
                  <FormItem className="w-full md:w-24">
                    <FormLabel>Qty</FormLabel>
                    <FormControl><Input type="number" placeholder="1" {...itemField} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field: itemField }) => (
                  <FormItem className="w-full md:w-32">
                    <FormLabel>Unit Price</FormLabel>
                    <FormControl><Input type="number" placeholder="100.00" step="0.01" {...itemField} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <div className="w-full md:w-32">
                    <FormLabel>Total</FormLabel>
                    <Input 
                      readOnly 
                      value={(watchItems[index]?.quantity * watchItems[index]?.unitPrice || 0).toFixed(2)} 
                      className="bg-muted cursor-default"
                    />
                  </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="mt-auto text-destructive hover:bg-destructive/10 self-end md:self-center">
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">Remove item</span>
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Item
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Summary & Notes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
               <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Notes (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Payment terms, thank you note, specific instructions for this invoice..." {...field} rows={4} /></FormControl>
                  <FormDescription>These notes are specific to this invoice. Default notes from preferences will be applied if this is empty.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-4 p-4 bg-secondary/30 rounded-md">
              <FormField control={form.control} name="taxRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Rate (%)</FormLabel>
                  <FormControl><Input type="number" placeholder="0" {...field} min="0" max="100" step="0.01" /></FormControl>
                  <FormDescription>Enter 0 if no tax.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal:</span> <span className="font-medium">{(userPrefs?.currency || "MAD")} {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax ({watchTaxRate || 0}%):</span> <span className="font-medium">{(userPrefs?.currency || "MAD")} {taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t"><span>Total:</span> <span>{(userPrefs?.currency || "MAD")} {totalAmount.toFixed(2)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <CardFooter className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="outline" onClick={() => form.reset({
                 clientName: "", clientEmail: "", clientAddress: "",
                 invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
                 issueDate: new Date(), dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                 items: [{ description: "", quantity: 1, unitPrice: 0 }],
                 notes: userPrefs?.defaultNotes || "", taxRate: 0,
            })}>Cancel</Button>
            <Button type="submit" disabled={isSaving || isPrefsLoading}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isPrefsLoading ? "Loading Prefs..." : "Save Invoice"}
            </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
