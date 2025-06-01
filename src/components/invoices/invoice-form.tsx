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
import { CalendarIcon, PlusCircle, Trash2, Save } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
// import { db, auth } from "@/lib/firebase";
// import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { useState } from "react";

const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
  unitPrice: z.coerce.number().min(0.01, "Unit price must be positive"),
});

const formSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email address"),
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
  const [isLoading, setIsLoading] = useState(false);
  // const { user } = useAuth(); // Assuming useAuth hook is available

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientName: initialData?.clientName || "",
      clientEmail: initialData?.clientEmail || "",
      clientAddress: initialData?.clientAddress || "",
      invoiceNumber: initialData?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      issueDate: initialData?.issueDate ? new Date(initialData.issueDate) : new Date(),
      dueDate: initialData?.dueDate ? new Date(initialData.dueDate) : new Date(new Date().setDate(new Date().getDate() + 30)),
      items: initialData?.items?.map(item => ({...item})) || [{ description: "", quantity: 1, unitPrice: 0 }],
      notes: initialData?.notes || "",
      taxRate: initialData?.taxRate || 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const watchTaxRate = form.watch("taxRate");

  const calculateSubtotal = () => {
    return watchItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);
  };

  const calculateTaxAmount = (subtotal: number) => {
    const taxRate = watchTaxRate || 0;
    return subtotal * (taxRate / 100);
  };

  const subtotal = calculateSubtotal();
  const taxAmount = calculateTaxAmount(subtotal);
  const totalAmount = subtotal + taxAmount;

  async function onSubmit(values: InvoiceFormValues) {
    setIsLoading(true);
    // TODO: Implement actual saving to Firebase
    console.log("Form submitted", values);
    // if (!user) {
    //   toast({ title: "Error", description: "You must be logged in to create an invoice.", variant: "destructive" });
    //   setIsLoading(false);
    //   return;
    // }
    // const invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
    //   ...values,
    //   userId: user.uid,
    //   issueDate: format(values.issueDate, "yyyy-MM-dd"),
    //   dueDate: format(values.dueDate, "yyyy-MM-dd"),
    //   items: values.items.map(item => ({...item, total: item.quantity * item.unitPrice})),
    //   subtotal,
    //   taxAmount,
    //   totalAmount,
    //   status: 'draft',
    //   // TODO: Add currency, language from user preferences
    // };

    try {
      // const docRef = await addDoc(collection(db, "invoices"), {
      //   ...invoiceData,
      //   createdAt: serverTimestamp(),
      //   updatedAt: serverTimestamp(),
      // });
      toast({
        title: "Invoice Saved",
        description: `Invoice ${values.invoiceNumber} has been saved as a draft.`,
      });
      // router.push(`/invoices/${docRef.id}`); // Or to invoices list
      form.reset(); // Reset form after successful submission
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({
        title: "Error",
        description: "Failed to save invoice. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
                <FormLabel>Client Email</FormLabel>
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
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col md:flex-row gap-4 items-start p-4 border rounded-md bg-secondary/30">
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
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl><Textarea placeholder="Payment terms, thank you note, etc." {...field} rows={4} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-4 p-4 bg-secondary/30 rounded-md">
              <FormField control={form.control} name="taxRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Rate (%)</FormLabel>
                  <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                  <FormDescription>Enter 0 if no tax.</FormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span>Subtotal:</span> <span className="font-medium">${subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Tax ({watchTaxRate || 0}%):</span> <span className="font-medium">${taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t"><span>Total:</span> <span>${totalAmount.toFixed(2)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <CardFooter className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="outline" onClick={() => form.reset()}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Save className="mr-2 h-4 w-4 animate-spin" />}
              Save Invoice
            </Button>
        </CardFooter>
      </form>
    </Form>
  );
}
