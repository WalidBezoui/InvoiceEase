
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription as UiCardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription as UiFormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2, Save, Loader2, UserPlus, PackagePlus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, orderBy, updateDoc, type FieldValue } from "firebase/firestore";
import type { Invoice, InvoiceItem, UserPreferences, Client, Product } from "@/lib/types";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/hooks/use-language";
import AddItemDialog from "./add-item-dialog";
import QuickAddDialog from "./quick-add-dialog"; 
import { Tooltip, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


// New schema for an item within the form, using priceWithTax
const invoiceItemSchema = z.object({
  id: z.string().optional(),
  productId: z.string().optional(),
  reference: z.string().optional(),
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().min(0.01, "Quantity must be at least 0.01"),
  unitPrice: z.coerce.number(), // This will now store the PRE-TAX price
  priceWithTax: z.coerce.number().min(0, "Price must be non-negative"), // User-facing price
});


const getInvoiceFormSchema = (t: Function) => z.object({
  clientId: z.string().optional(),
  clientName: z.string().min(1, t('invoiceForm.toast.clientNameRequired', { default: "Client name is required (select or fill)"})),
  clientEmail: z.string().email(t('invoiceForm.toast.invalidEmail', { default: "Invalid email address"})).or(z.literal("")).optional(),
  clientAddress: z.string().optional(),
  clientCompany: z.string().optional(),
  clientICE: z.string().optional(),
  invoiceNumber: z.string().min(1, t('invoiceForm.toast.invoiceNumberRequired', { default: "Invoice number is required"})),
  issueDate: z.date({ required_error: t('invoiceForm.toast.issueDateRequired', { default: "Issue date is required"}) }),
  dueDate: z.date({ required_error: t('invoiceForm.toast.dueDateRequired', { default: "Due date is required"}) }),
  items: z.array(invoiceItemSchema).min(1, t('invoiceForm.toast.oneItemRequired', { default: "At least one item is required"})),
  notes: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(100).optional().default(0),
});

type InvoiceFormValues = z.infer<ReturnType<typeof getInvoiceFormSchema>>;

interface InvoiceFormProps {
  initialData?: Invoice;
}

const MANUAL_ENTRY_CLIENT_ID = "_manual_entry_";


export default function InvoiceForm({ initialData }: InvoiceFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const { t, isLoadingLocale: isLoadingLang } = useLanguage();
  const [isSaving, setIsSaving] = useState(false);
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isClientsLoading, setIsClientsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState(true);

  const currentInvoiceFormSchema = getInvoiceFormSchema(t);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(currentInvoiceFormSchema),
    defaultValues: {
      clientId: "",
      clientName: "",
      clientEmail: "",
      clientAddress: "",
      clientCompany: "",
      clientICE: "",
      invoiceNumber: `INV-${Date.now().toString().slice(-6)}`,
      issueDate: new Date(),
      dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
      items: [{ id: doc(collection(db, 'invoices')).id, description: "", quantity: 1, unitPrice: 0, priceWithTax: 0, reference: "" }],
      notes: "",
      taxRate: 0,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "items" });

  useEffect(() => {
    async function fetchData() {
      if (user) {
        setIsPrefsLoading(true);
        setIsClientsLoading(true);
        setIsProductsLoading(true);
        try {
          const prefDocRef = doc(db, "userPreferences", user.uid);
          const prefDocSnap = await getDoc(prefDocRef);
          if (prefDocSnap.exists()) {
            setUserPrefs(prefDocSnap.data() as UserPreferences);
          } else {
            setUserPrefs({ currency: "MAD", language: "fr", defaultTaxRate: 0 });
          }

          const clientsQuery = query(collection(db, "clients"), where("userId", "==", user.uid), orderBy("name"));
          const clientsSnapshot = await getDocs(clientsQuery);
          setClients(clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));

          const productsQuery = query(collection(db, "products"), where("userId", "==", user.uid), orderBy("name"));
          const productsSnapshot = await getDocs(productsQuery);
          setProducts(productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));

        } catch (error) {
          console.error("Error fetching initial data:", error);
          toast({ title: t('invoiceForm.toast.errorTitle'), description: t('invoiceForm.toast.errorFetchingPrefs'), variant: "destructive" });
        } finally {
          setIsPrefsLoading(false);
          setIsClientsLoading(false);
          setIsProductsLoading(false);
        }
      } else {
        setIsPrefsLoading(false);
        setIsClientsLoading(false);
        setIsProductsLoading(false);
      }
    }
    fetchData();
  }, [user, toast, t]);

 useEffect(() => {
    if (!isLoadingLang) {
        form.trigger();
    }
  }, [t, form, isLoadingLang]);

 useEffect(() => {
    if (!isPrefsLoading && !isClientsLoading && (initialData || userPrefs)) {
        const taxRate = initialData?.taxRate ?? userPrefs?.defaultTaxRate ?? 0;
        const taxMultiplier = 1 + (taxRate / 100);

        if (initialData) {
            const hasExistingClient = initialData.clientId && clients.some(c => c.id === initialData.clientId);
            
            form.reset({
                clientId: hasExistingClient ? initialData.clientId : MANUAL_ENTRY_CLIENT_ID,
                clientName: initialData.clientName,
                clientEmail: initialData.clientEmail || "",
                clientAddress: initialData.clientAddress || "",
                clientCompany: initialData.clientCompany || "",
                clientICE: initialData.clientICE || "",
                invoiceNumber: initialData.invoiceNumber,
                issueDate: new Date(initialData.issueDate),
                dueDate: new Date(initialData.dueDate),
                items: initialData.items.map(item => ({
                    id: item.id || doc(collection(db, 'invoices')).id,
                    productId: item.productId,
                    reference: item.reference || '',
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    priceWithTax: item.unitPrice * taxMultiplier, // Calculate priceWithTax from stored unitPrice
                })),
                notes: initialData.notes || "",
                taxRate: taxRate,
            });

        } else if (userPrefs) {
            form.reset({
                ...form.getValues(),
                notes: userPrefs.defaultNotes || "",
                taxRate: taxRate,
                invoiceNumber: `INV-${Date.now().toString().slice(-4)}-${user?.uid.slice(0,3) || 'XXX'}`,
            });
        }
    }
}, [initialData, form, isPrefsLoading, userPrefs, user?.uid, clients, isClientsLoading]);


  const watchItems = form.watch("items");
  const watchTaxRate = form.watch("taxRate");
  const watchClientId = form.watch("clientId");

  useEffect(() => {
    if (watchClientId && watchClientId !== MANUAL_ENTRY_CLIENT_ID) {
      const selectedClient = clients.find(c => c.id === watchClientId);
      if (selectedClient) {
        form.setValue("clientName", selectedClient.name);
        form.setValue("clientEmail", selectedClient.email || "");
        form.setValue("clientAddress", selectedClient.address || "");
        form.setValue("clientCompany", selectedClient.clientCompany || "");
        form.setValue("clientICE", selectedClient.ice || "");
      }
    } else if (watchClientId === MANUAL_ENTRY_CLIENT_ID) {
        if (!initialData || initialData.clientId) {
            form.setValue("clientName", "");
            form.setValue("clientEmail", "");
            form.setValue("clientAddress", "");
            form.setValue("clientCompany", "");
            form.setValue("clientICE", "");
        }
    }
  }, [watchClientId, clients, form, initialData]);

  const subtotal = watchItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);
  const taxAmount = watchItems.reduce((sum, item) => {
    const totalItemPrice = item.quantity * item.unitPrice;
    const itemTax = totalItemPrice * ((watchTaxRate || 0) / 100);
    return sum + itemTax;
  }, 0);
  const totalAmount = subtotal + taxAmount;

  async function onSubmit(values: InvoiceFormValues) {
    if (!user) {
        toast({ title: t('invoiceForm.toast.errorTitle'), description: t('invoiceForm.toast.authErrorDesc'), variant: "destructive" });
        return;
    }
    setIsSaving(true);
    
    // Final recalculation before saving to ensure data integrity
    const finalTaxRate = values.taxRate ?? 0;
    const finalSubtotal = values.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const finalTaxAmount = finalSubtotal * (finalTaxRate / 100);
    const finalTotalAmount = finalSubtotal + finalTaxAmount;

    const itemsToSave = values.items.map(item => ({
        id: item.id || doc(collection(db, 'invoices')).id,
        productId: item.productId || null,
        reference: item.reference || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice, // Already pre-tax
        total: item.quantity * item.unitPrice,
    }));

    const dataToSave = {
        ...initialData,
        userId: user.uid,
        invoiceNumber: values.invoiceNumber,
        issueDate: format(values.issueDate, "yyyy-MM-dd"),
        dueDate: format(values.dueDate, "yyyy-MM-dd"),
        items: itemsToSave,
        subtotal: finalSubtotal,
        taxRate: finalTaxRate,
        taxAmount: finalTaxAmount,
        totalAmount: finalTotalAmount,
        clientId: values.clientId === MANUAL_ENTRY_CLIENT_ID ? null : (values.clientId || null),
        clientName: values.clientName,
        clientEmail: (values.clientEmail || null),
        clientAddress: (values.clientAddress || null),
        clientCompany: (values.clientCompany || null),
        clientICE: (values.clientICE || null),
        notes: (values.notes || null),
        status: initialData?.status || 'draft',
        currency: initialData?.currency || userPrefs?.currency || 'MAD',
        language: initialData?.language || userPrefs?.language || 'fr',
        sentDate: initialData?.sentDate || null,
        paidDate: initialData?.paidDate || null,
        stockUpdated: initialData?.stockUpdated ?? false,
        appliedDefaultNotes: initialData?.appliedDefaultNotes || null,
        appliedDefaultPaymentTerms: initialData?.appliedDefaultPaymentTerms || null,
        createdAt: initialData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
    };

    try {
        if (initialData?.id) {
            const invoiceRef = doc(db, "invoices", initialData.id);
            await updateDoc(invoiceRef, dataToSave);
            toast({ title: t('invoiceForm.toast.invoiceUpdatedTitle'), description: t('invoiceForm.toast.invoiceUpdatedDesc', { invoiceNumber: values.invoiceNumber }) });
            router.push(`/invoices/${initialData.id}`);
        } else {
            const docRef = await addDoc(collection(db, "invoices"), dataToSave);
            toast({ title: t('invoiceForm.toast.invoiceSavedTitle'), description: t('invoiceForm.toast.invoiceSavedDesc', { invoiceNumber: values.invoiceNumber }) });
            router.push(`/invoices/${docRef.id}`);
        }
    } catch (error) {
        console.error("Error saving invoice:", error);
        toast({ title: t('invoiceForm.toast.errorSavingTitle'), description: `An unexpected error occurred: ${(error as Error).message}`, variant: "destructive" });
    } finally {
        setIsSaving(false);
    }
}


  const handleAddItem = (item: Pick<InvoiceItem, 'productId' | 'reference' | 'description' | 'quantity' | 'unitPrice'>) => {
    if (fields.length === 1 && fields[0].description === "" && fields[0].priceWithTax === 0) {
      remove(0);
    }
    const taxRate = form.getValues('taxRate') || 0;
    const taxMultiplier = 1 + (taxRate / 100);
    const priceWithTax = item.unitPrice * taxMultiplier;

    append({ 
        ...item, 
        id: doc(collection(db, 'invoices')).id, 
        reference: item.reference || '',
        priceWithTax: priceWithTax,
        unitPrice: item.unitPrice // unitPrice from product is pre-tax
    });
  };
  
  const handleAddMultipleItems = (itemsToAdd: Array<Pick<InvoiceItem, 'productId' | 'reference' | 'description' | 'quantity' | 'unitPrice'>>) => {
      if (fields.length === 1 && fields[0].description === "" && fields[0].priceWithTax === 0) {
        remove(0);
      }
      const taxRate = form.getValues('taxRate') || 0;
      const taxMultiplier = 1 + (taxRate / 100);
      const newItems = itemsToAdd.map(item => ({
          ...item,
          id: doc(collection(db, 'invoices')).id,
          reference: item.reference || '',
          priceWithTax: item.unitPrice * taxMultiplier,
          unitPrice: item.unitPrice // unitPrice from product is pre-tax
      }));
      append(newItems);
  };
  
  const handlePriceWithTaxChange = (index: number, priceWithTax: number) => {
    const taxRate = form.getValues('taxRate') || 0;
    const taxDivisor = 1 + (taxRate / 100);
    const unitPrice = taxDivisor > 0 ? priceWithTax / taxDivisor : 0;
    form.setValue(`items.${index}.unitPrice`, unitPrice, { shouldValidate: true });
    form.setValue(`items.${index}.priceWithTax`, priceWithTax, { shouldValidate: true });
  };

  const isClientReadOnly = !!(watchClientId && watchClientId !== MANUAL_ENTRY_CLIENT_ID);
  
  if ((isLoadingLang || isPrefsLoading || isClientsLoading) && !initialData) {
      return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <TooltipProvider>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="font-headline text-xl text-primary">{t('invoiceForm.clientInfoCard.title')}</CardTitle>
                <UiCardDescription>{t('invoiceForm.clientInfoCard.description')}</UiCardDescription>
              </div>
              <Button type="button" variant="outline" size="sm" asChild>
                <Link href={`/clients/new?redirect=${encodeURIComponent(router.asPath)}`}>
                  <UserPlus className="mr-2 h-4 w-4" /> {t('invoiceForm.clientInfoCard.addNewClient')}
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>{t('invoiceForm.labels.selectClient')}</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || MANUAL_ENTRY_CLIENT_ID} 
                    disabled={isClientsLoading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isClientsLoading ? t('invoiceForm.placeholders.selectClientLoading') : t('invoiceForm.placeholders.selectClientDefault')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={MANUAL_ENTRY_CLIENT_ID}>{t('invoiceForm.placeholders.selectClientManualEntry')}</SelectItem>
                      {clients.map(client => (
                        <SelectItem key={client.id} value={client.id!}>
                          {client.name} ({client.clientCompany || client.ice || client.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="clientName" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.labels.clientName')}</FormLabel>
                <FormControl><Input placeholder={t('invoiceForm.placeholders.clientName')} {...field} readOnly={isClientReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
             <FormField control={form.control} name="clientCompany" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.labels.clientCompany')}</FormLabel>
                <FormControl><Input placeholder={t('invoiceForm.placeholders.clientCompany')} {...field} readOnly={isClientReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientEmail" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.labels.clientEmail')}</FormLabel>
                <FormControl><Input type="email" placeholder={t('invoiceForm.placeholders.clientEmail')} {...field} value={field.value ?? ""} readOnly={isClientReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientICE" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.labels.clientICE')}</FormLabel>
                <FormControl><Input placeholder={t('invoiceForm.placeholders.clientICE')} {...field} value={field.value ?? ""} readOnly={isClientReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientAddress" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>{t('invoiceForm.labels.clientAddress')}</FormLabel>
                <FormControl><Textarea placeholder={t('invoiceForm.placeholders.clientAddress')} {...field} value={field.value ?? ""} readOnly={isClientReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('invoiceForm.invoiceDetailsCard.title')}</CardTitle>
             <UiCardDescription>{t('invoiceForm.invoiceDetailsCard.description')}</UiCardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.formFields.invoiceNumber')}</FormLabel>
                <FormControl><Input placeholder={t('invoiceForm.placeholders.invoiceNumber')} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="issueDate" render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>{t('invoiceForm.formFields.issueDate')}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>{t('invoiceForm.placeholders.pickDate')}</span>}
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
                <FormLabel>{t('invoiceForm.formFields.dueDate')}</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                        {field.value ? format(field.value, "PPP") : <span>{t('invoiceForm.placeholders.pickDate')}</span>}
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
            <CardTitle className="font-headline text-xl text-primary">{t('invoiceForm.invoiceItemsCard.title')}</CardTitle>
            <UiCardDescription>{t('invoiceForm.invoiceItemsCard.description')}</UiCardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((item, index) => (
              <div key={item.id} className="flex flex-col md:flex-row gap-4 items-start p-4 border rounded-md bg-secondary/30">
                <div className="flex-grow grid gap-4 grid-cols-1 sm:grid-cols-5">
                    <FormField control={form.control} name={`items.${index}.description`} render={({ field: itemField }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>{t('invoiceForm.formFields.itemDescription')}</FormLabel>
                        <FormControl><Input placeholder={t('invoiceForm.placeholders.itemDescription')} {...itemField} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                     <FormField control={form.control} name={`items.${index}.reference`} render={({ field: itemField }) => (
                        <FormItem>
                            <FormLabel>{t('invoiceForm.addItemDialog.selectProductTab.reference')}</FormLabel>
                            <FormControl><Input placeholder="SKU-123" {...itemField} value={itemField.value || ''} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name={`items.${index}.quantity`} render={({ field: itemField }) => (
                      <FormItem>
                        <FormLabel>{t('invoiceForm.formFields.itemQuantity')}</FormLabel>
                        <FormControl><Input type="number" placeholder="1" {...itemField} step="any" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name={`items.${index}.priceWithTax`} render={({ field: itemField }) => (
                        <FormItem>
                            <FormLabel>{t('invoiceForm.formFields.itemUnitPriceTaxIncl', { default: 'Unit Price (Tax Incl.)'})}</FormLabel>
                            <FormControl><Input type="number" placeholder="120.00" step="0.01" {...itemField} onChange={e => { itemField.onChange(e); handlePriceWithTaxChange(index, parseFloat(e.target.value) || 0); }} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                </div>
                 <div className="w-full md:w-32 self-end">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <FormLabel>{t('invoiceForm.formFields.itemTotal')}</FormLabel>
                                <Input
                                readOnly
                                value={((watchItems[index]?.quantity || 0) * (watchItems[index]?.priceWithTax || 0)).toFixed(2)}
                                className="bg-muted cursor-default font-semibold"
                                />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                           <p>{t('invoiceForm.preTaxPrice', { default: 'Pre-tax: '})} {(watchItems[index]?.unitPrice || 0).toFixed(2)}</p>
                        </TooltipContent>
                    </Tooltip>
                  </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="mt-auto text-destructive hover:bg-destructive/10 self-end md:self-center">
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">{t('invoiceForm.buttons.removeItem')}</span>
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
                 <AddItemDialog 
                    products={products}
                    isLoading={isProductsLoading}
                    onAddItem={handleAddItem} 
                    currency={userPrefs?.currency || 'MAD'}
                    t={t}
                />
                <QuickAddDialog
                    products={products}
                    isLoading={isProductsLoading}
                    onAddItems={handleAddMultipleItems}
                    currency={userPrefs?.currency || 'MAD'}
                    t={t}
                />
            </div>
             <FormMessage>{form.formState.errors.items?.root?.message || form.formState.errors.items?.message}</FormMessage>
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('invoiceForm.summaryNotesCard.title')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-4">
               <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invoiceForm.formFields.notes')}</FormLabel>
                  <FormControl><Textarea placeholder={t('invoiceForm.placeholders.notes')} {...field} value={field.value ?? ""} rows={4} /></FormControl>
                  <UiFormDescription>{t('invoiceForm.formFields.notesDescription')}</UiFormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-4 p-4 bg-secondary/30 rounded-md">
              <FormField control={form.control} name="taxRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invoiceForm.formFields.taxRate')}</FormLabel>
                  <FormControl><Input type="number" placeholder={t('invoiceForm.placeholders.taxRate')} {...field} min="0" max="100" step="0.01" onChange={e => {
                        field.onChange(e);
                        // Recalculate all item pre-tax prices when tax rate changes
                        watchItems.forEach((item, index) => {
                            handlePriceWithTaxChange(index, item.priceWithTax);
                        });
                  }} /></FormControl>
                  <UiFormDescription>{t('invoiceForm.formFields.taxRateDescription')}</UiFormDescription>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="text-sm space-y-1">
                <div className="flex justify-between"><span>{t('invoiceForm.summary.subtotal')}</span> <span className="font-medium">{(userPrefs?.currency || initialData?.currency || "MAD")} {subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>{t('invoiceForm.summary.tax', {taxRate: watchTaxRate || 0})}</span> <span className="font-medium">{(userPrefs?.currency || initialData?.currency || "MAD")} {taxAmount.toFixed(2)}</span></div>
                <div className="flex justify-between text-lg font-bold text-primary pt-2 border-t"><span>{t('invoiceForm.summary.total')}</span> <span>{(userPrefs?.currency || initialData?.currency || "MAD")} {totalAmount.toFixed(2)}</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <CardFooter className="flex justify-end gap-4 pt-6">
            <Button type="button" variant="outline" onClick={() => router.back()}>{t('invoiceForm.buttons.cancel')}</Button>
            <Button type="submit" disabled={isSaving || isPrefsLoading || isClientsLoading || isLoadingLang}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isPrefsLoading || isClientsLoading || isLoadingLang ? t('invoiceForm.buttons.loadingData') : (initialData ? t('invoiceForm.buttons.saveChanges') : t('invoiceForm.buttons.saveInvoice'))}
            </Button>
        </CardFooter>
      </form>
    </Form>
    </TooltipProvider>
  );
}

