
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription as UiCardDescription } from "@/components/ui/card"; // Renamed CardDescription
import { Form, FormControl, FormDescription as UiFormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, PlusCircle, Trash2, Save, Loader2, UserPlus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, getDoc, query, where, getDocs, orderBy, updateDoc, type FieldValue } from "firebase/firestore";
import type { Invoice, InvoiceItem, UserPreferences, Client } from "@/lib/types";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/hooks/use-language"; // Import useLanguage

const invoiceItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, "Description is required"), // This message will be overridden by Zod if not translated
  quantity: z.coerce.number().min(0.01, "Quantity must be at least 0.01"),
  unitPrice: z.coerce.number().min(0.01, "Unit price must be positive"),
});

// Form schema function to allow dynamic error messages from translations
const getInvoiceFormSchema = (t: Function) => z.object({
  clientId: z.string().optional(),
  clientName: z.string().min(1, t('invoiceForm.toast.clientNameRequired', { default: "Client name is required (select or fill)"})), // Example of default, ideally key exists
  clientEmail: z.string().email(t('invoiceForm.toast.invalidEmail', { default: "Invalid email address"})).or(z.literal("")).optional(),
  clientAddress: z.string().optional(),
  clientCompany: z.string().optional(),
  clientICE: z.string().optional(),
  invoiceNumber: z.string().min(1, t('invoiceForm.toast.invoiceNumberRequired', { default: "Invoice number is required"})),
  issueDate: z.date({ required_error: t('invoiceForm.toast.issueDateRequired', { default: "Issue date is required"}) }),
  dueDate: z.date({ required_error: t('invoiceForm.toast.dueDateRequired', { default: "Due date is required"}) }),
  items: z.array(
    z.object({
      id: z.string().optional(),
      description: z.string().min(1, t('invoiceForm.toast.itemDescRequired', { default: "Description is required"})),
      quantity: z.coerce.number().min(0.01, t('invoiceForm.toast.itemQtyMin', { default: "Quantity must be at least 0.01"})),
      unitPrice: z.coerce.number().min(0.01, t('invoiceForm.toast.itemPriceMin', { default: "Unit price must be positive"})),
    })
  ).min(1, t('invoiceForm.toast.oneItemRequired', { default: "At least one item is required"})),
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
  const { t, isLoadingLocale: isLoadingLang } = useLanguage(); // Use language hook
  const [isSaving, setIsSaving] = useState(false);
  const [isPrefsLoading, setIsPrefsLoading] = useState(true);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [isClientsLoading, setIsClientsLoading] = useState(true);

  const currentInvoiceFormSchema = getInvoiceFormSchema(t);


  useEffect(() => {
    async function fetchData() {
      if (user) {
        setIsPrefsLoading(true);
        setIsClientsLoading(true);
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
          const fetchedClients: Client[] = [];
          clientsSnapshot.forEach(doc => fetchedClients.push({ id: doc.id, ...doc.data() } as Client));
          setClients(fetchedClients);

        } catch (error) {
          console.error("Error fetching initial data:", error);
          toast({ title: t('invoiceForm.toast.errorTitle'), description: t('invoiceForm.toast.errorFetchingPrefs'), variant: "destructive" });
          setUserPrefs({ currency: "MAD", language: "fr", defaultTaxRate: 0 });
        } finally {
          setIsPrefsLoading(false);
          setIsClientsLoading(false);
        }
      } else {
        setIsPrefsLoading(false);
        setIsClientsLoading(false);
      }
    }
    fetchData();
  }, [user, toast, t]);

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(currentInvoiceFormSchema),
    defaultValues: {
      clientId: initialData?.clientId || "",
      clientName: initialData?.clientName || "",
      clientEmail: initialData?.clientEmail || "",
      clientAddress: initialData?.clientAddress || "",
      clientCompany: initialData?.clientCompany || "",
      clientICE: initialData?.clientICE || "",
      invoiceNumber: initialData?.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`,
      issueDate: initialData?.issueDate ? new Date(initialData.issueDate) : new Date(),
      dueDate: initialData?.dueDate ? new Date(initialData.dueDate) : new Date(new Date().setDate(new Date().getDate() + 30)),
      items: initialData?.items?.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice
      })) || [{ description: "", quantity: 1, unitPrice: 0 }],
      notes: initialData?.notes || userPrefs?.defaultNotes || "",
      taxRate: initialData?.taxRate ?? userPrefs?.defaultTaxRate ?? 0,
    },
  });
  
  // Re-validate with the correct language schema when language changes
  useEffect(() => {
    form.trigger();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, form.trigger]);


  useEffect(() => {
    if (userPrefs && !initialData) {
        form.reset({
            ...form.getValues(),
            notes: form.getValues().notes || userPrefs.defaultNotes || "",
            taxRate: userPrefs.defaultTaxRate ?? 0, 
            invoiceNumber: form.getValues().invoiceNumber.startsWith('INV-') && form.getValues().invoiceNumber.length > 10
                           ? form.getValues().invoiceNumber
                           : `INV-${Date.now().toString().slice(-4)}-${user?.uid.slice(0,3) || 'XXX'}`,
        });
    }
  }, [userPrefs, initialData, form, user?.uid]);

  useEffect(() => {
    if (!isPrefsLoading) {
        if (initialData) {
            form.reset({
                clientId: initialData.clientId || MANUAL_ENTRY_CLIENT_ID,
                clientName: initialData.clientName,
                clientEmail: initialData.clientEmail || "",
                clientAddress: initialData.clientAddress || "",
                clientCompany: initialData.clientCompany || "",
                clientICE: initialData.clientICE || "",
                invoiceNumber: initialData.invoiceNumber,
                issueDate: new Date(initialData.issueDate),
                dueDate: new Date(initialData.dueDate),
                items: initialData.items.map(item => ({
                  description: item.description,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                })),
                notes: initialData.notes || "",
                taxRate: initialData.taxRate ?? userPrefs?.defaultTaxRate ?? 0,
            });
        } else if (userPrefs) {
            form.reset({
              ...form.getValues(), 
              notes: userPrefs.defaultNotes || "", // Explicitly set from userPrefs for new invoice
              taxRate: userPrefs.defaultTaxRate ?? 0, // Explicitly set for new invoice
            });
        }
    }
  }, [initialData, form, isPrefsLoading, userPrefs]);


  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
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
    } else if (watchClientId === MANUAL_ENTRY_CLIENT_ID && !initialData) { 
        form.setValue("clientName", "");
        form.setValue("clientEmail", "");
        form.setValue("clientAddress", "");
        form.setValue("clientCompany", "");
        form.setValue("clientICE", "");
    }
  }, [watchClientId, clients, form, initialData]);


  const calculateSubtotal = () => watchItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice || 0), 0);
  const calculateTaxAmount = (subtotalValue: number) => subtotalValue * ((watchTaxRate || 0) / 100);
  const subtotal = calculateSubtotal();
  const taxAmount = calculateTaxAmount(subtotal);
  const totalAmount = subtotal + taxAmount;

  async function onSubmit(values: InvoiceFormValues) {
    if (!user) {
      toast({ title: t('invoiceForm.toast.authErrorTitle'), description: t('invoiceForm.toast.authErrorDesc'), variant: "destructive" });
      return;
    }
    if (isPrefsLoading || isClientsLoading || isLoadingLang) {
      toast({ title: t('invoiceForm.toast.pleaseWait'), description: t('invoiceForm.toast.dataLoading'), variant: "default" });
      return;
    }
    setIsSaving(true);

    const invoiceItemsToSave: InvoiceItem[] = values.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.quantity * item.unitPrice,
    }));

    const finalClientId = values.clientId === MANUAL_ENTRY_CLIENT_ID ? null : (values.clientId || null);

    const commonInvoiceData: Partial<Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'status' | 'currency' | 'language' | 'logoDataUrl' | 'watermarkLogoDataUrl' | 'companyInvoiceHeader' | 'companyInvoiceFooter' | 'appliedDefaultNotes' | 'appliedDefaultPaymentTerms'>> = {
      invoiceNumber: values.invoiceNumber,
      clientId: finalClientId,
      clientName: values.clientName,
      clientEmail: values.clientEmail || "",
      clientAddress: values.clientAddress || "",
      clientCompany: values.clientCompany || "",
      clientICE: values.clientICE || "",
      issueDate: format(values.issueDate, "yyyy-MM-dd"),
      dueDate: format(values.dueDate, "yyyy-MM-dd"),
      items: invoiceItemsToSave,
      subtotal,
      taxRate: values.taxRate,
      taxAmount,
      totalAmount,
      notes: values.notes || "",
    };

    try {
      if (initialData?.id) {
        const invoiceRef = doc(db, "invoices", initialData.id);
        await updateDoc(invoiceRef, {
          ...commonInvoiceData, 
          updatedAt: serverTimestamp() as FieldValue,
        });
        toast({ title: t('invoiceForm.toast.invoiceUpdatedTitle'), description: t('invoiceForm.toast.invoiceUpdatedDesc', {invoiceNumber: values.invoiceNumber}) });
        router.push(`/invoices/${initialData.id}`);
      } else {
        const invoiceDataToCreate: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> = {
          userId: user.uid,
          status: 'draft',
          currency: userPrefs?.currency || "MAD",
          language: userPrefs?.language || "fr",
          logoDataUrl: userPrefs?.logoDataUrl || null,
          watermarkLogoDataUrl: userPrefs?.watermarkLogoDataUrl || null,
          companyInvoiceHeader: userPrefs?.invoiceHeader || "",
          companyInvoiceFooter: userPrefs?.invoiceFooter || "",
          appliedDefaultNotes: values.notes === (userPrefs?.defaultNotes || "") ? userPrefs?.defaultNotes : "",
          appliedDefaultPaymentTerms: userPrefs?.defaultPaymentTerms || "",
          ...(commonInvoiceData as any), // Cast to avoid type conflicts before all fields are there
        };
        const docRef = await addDoc(collection(db, "invoices"), {
          ...invoiceDataToCreate,
          createdAt: serverTimestamp() as FieldValue,
          updatedAt: serverTimestamp() as FieldValue,
        });
        toast({ title: t('invoiceForm.toast.invoiceSavedTitle'), description: t('invoiceForm.toast.invoiceSavedDesc', {invoiceNumber: values.invoiceNumber}) });
        router.push(`/invoices/${docRef.id}`);
      }
    } catch (error) {
      console.error("Error saving invoice:", error);
      toast({ title: t('invoiceForm.toast.errorSavingTitle'), description: t('invoiceForm.toast.errorSavingDesc'), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  const isClientSelectedReadOnly = !!(watchClientId && watchClientId !== MANUAL_ENTRY_CLIENT_ID);
  
  if (isLoadingLang || isPrefsLoading || isClientsLoading && !initialData) { // Show loader if language or critical data is loading for a new form
      return <div className="flex justify-center items-center min-h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }


  return (
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
                <FormControl><Input placeholder={t('invoiceForm.placeholders.clientName')} {...field} readOnly={isClientSelectedReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
             <FormField control={form.control} name="clientCompany" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.labels.clientCompany')}</FormLabel>
                <FormControl><Input placeholder={t('invoiceForm.placeholders.clientCompany')} {...field} readOnly={isClientSelectedReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientEmail" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.labels.clientEmail')}</FormLabel>
                <FormControl><Input type="email" placeholder={t('invoiceForm.placeholders.clientEmail')} {...field} readOnly={isClientSelectedReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientICE" render={({ field }) => (
              <FormItem>
                <FormLabel>{t('invoiceForm.labels.clientICE')}</FormLabel>
                <FormControl><Input placeholder={t('invoiceForm.placeholders.clientICE')} {...field} readOnly={isClientSelectedReadOnly} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientAddress" render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>{t('invoiceForm.labels.clientAddress')}</FormLabel>
                <FormControl><Textarea placeholder={t('invoiceForm.placeholders.clientAddress')} {...field} readOnly={isClientSelectedReadOnly} /></FormControl>
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
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
              <div key={item.id || `item-${index}`} className="flex flex-col md:flex-row gap-4 items-start p-4 border rounded-md bg-secondary/30">
                <FormField control={form.control} name={`items.${index}.description`} render={({ field: itemField }) => (
                  <FormItem className="flex-grow">
                    <FormLabel>{t('invoiceForm.formFields.itemDescription')}</FormLabel>
                    <FormControl><Input placeholder={t('invoiceForm.placeholders.itemDescription')} {...itemField} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`items.${index}.quantity`} render={({ field: itemField }) => (
                  <FormItem className="w-full md:w-24">
                    <FormLabel>{t('invoiceForm.formFields.itemQuantity')}</FormLabel>
                    <FormControl><Input type="number" placeholder={t('invoiceForm.placeholders.itemQuantity')} {...itemField} step="any" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field: itemField }) => (
                  <FormItem className="w-full md:w-32">
                    <FormLabel>{t('invoiceForm.formFields.itemUnitPrice')}</FormLabel>
                    <FormControl><Input type="number" placeholder={t('invoiceForm.placeholders.itemUnitPrice')} step="0.01" {...itemField} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                 <div className="w-full md:w-32">
                    <FormLabel>{t('invoiceForm.formFields.itemTotal')}</FormLabel>
                    <Input
                      readOnly
                      value={(watchItems[index]?.quantity * watchItems[index]?.unitPrice || 0).toFixed(2)}
                      className="bg-muted cursor-default"
                    />
                  </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="mt-auto text-destructive hover:bg-destructive/10 self-end md:self-center">
                  <Trash2 className="h-5 w-5" />
                  <span className="sr-only">{t('invoiceForm.buttons.removeItem')}</span>
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}>
              <PlusCircle className="mr-2 h-4 w-4" /> {t('invoiceForm.buttons.addItem')}
            </Button>
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
                  <FormControl><Textarea placeholder={t('invoiceForm.placeholders.notes')} {...field} rows={4} /></FormControl>
                  <UiFormDescription>{t('invoiceForm.formFields.notesDescription')}</UiFormDescription>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <div className="space-y-4 p-4 bg-secondary/30 rounded-md">
              <FormField control={form.control} name="taxRate" render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invoiceForm.formFields.taxRate')}</FormLabel>
                  <FormControl><Input type="number" placeholder={t('invoiceForm.placeholders.taxRate')} {...field} min="0" max="100" step="0.01" /></FormControl>
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
  );
}

      