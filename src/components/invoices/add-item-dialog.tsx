
"use client";

import { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, PlusCircle, Search, PackagePlus } from "lucide-react";
import type { Product, InvoiceItem } from '@/lib/types';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import Link from 'next/link';

interface AddItemDialogProps {
  products: Product[];
  isLoading: boolean;
  onAddItem: (item: Pick<InvoiceItem, 'productId' | 'description' | 'quantity' | 'unitPrice'>) => void;
  currency: string;
  t: (key: string, params?: Record<string, any>) => string;
}

const customItemSchema = z.object({
    description: z.string().min(1, "Description is required"),
    quantity: z.coerce.number().min(0.01, "Quantity must be > 0"),
    unitPrice: z.coerce.number().min(0, "Price cannot be negative")
});

type CustomItemFormValues = z.infer<typeof customItemSchema>;

export default function AddItemDialog({ products, isLoading, onAddItem, currency, t }: AddItemDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const form = useForm<CustomItemFormValues>({
    resolver: zodResolver(customItemSchema),
    defaultValues: {
        description: "",
        quantity: 1,
        unitPrice: 0,
    }
  });

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lowerSearch = searchTerm.toLowerCase();
    return products.filter(p => 
        p.name.toLowerCase().includes(lowerSearch) ||
        (p.reference && p.reference.toLowerCase().includes(lowerSearch))
    );
  }, [products, searchTerm]);

  const handleSelectProduct = (product: Product) => {
    onAddItem({
      productId: product.id,
      description: product.name,
      quantity: 1,
      unitPrice: product.sellingPrice,
    });
    setOpen(false);
  };
  
  const onCustomSubmit: SubmitHandler<CustomItemFormValues> = (data) => {
    onAddItem(data);
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" /> {t('invoiceForm.buttons.addItem', {default: "Add Item"})}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[800px]">
        <DialogHeader>
          <DialogTitle>{t('invoiceForm.addItemDialog.title')}</DialogTitle>
          <DialogDescription>{t('invoiceForm.addItemDialog.description')}</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="select-product" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select-product">{t('invoiceForm.addItemDialog.tabs.selectProduct')}</TabsTrigger>
            <TabsTrigger value="custom-item">{t('invoiceForm.addItemDialog.tabs.customItem')}</TabsTrigger>
          </TabsList>
          <TabsContent value="select-product">
            <div className="p-4 space-y-4">
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder={t('invoiceForm.addItemDialog.selectProductTab.searchPlaceholder')}
                        className="pl-8 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : filteredProducts.length === 0 ? (
                    <div className="text-center py-10">
                        <p className="text-muted-foreground">{t('invoiceForm.addItemDialog.selectProductTab.noProducts')}</p>
                        <Button variant="link" asChild className="mt-2">
                            <Link href="/products/new" target="_blank">
                                <PackagePlus className="mr-2 h-4 w-4" />
                                {t('invoiceForm.addItemDialog.selectProductTab.addProductCTA')}
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                <TableHead>{t('invoiceForm.addItemDialog.selectProductTab.name')}</TableHead>
                                <TableHead>{t('invoiceForm.addItemDialog.selectProductTab.reference', { default: 'Ref.'})}</TableHead>
                                <TableHead className="text-right">{t('invoiceForm.addItemDialog.selectProductTab.price')}</TableHead>
                                <TableHead className="text-right">{t('invoiceForm.addItemDialog.selectProductTab.stock', { default: 'Stock' })}</TableHead>
                                <TableHead className="w-[100px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredProducts.map(product => (
                                <TableRow key={product.id}>
                                    <TableCell className="font-medium">{product.name}</TableCell>
                                    <TableCell>{product.reference}</TableCell>
                                    <TableCell className="text-right">{currency} {product.sellingPrice.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">{product.stock !== undefined ? product.stock : 'N/A'}</TableCell>
                                    <TableCell>
                                        <Button size="sm" onClick={() => handleSelectProduct(product)}>
                                            {t('invoiceForm.addItemDialog.selectProductTab.select')}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
          </TabsContent>
          <TabsContent value="custom-item">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onCustomSubmit)} className="p-4 space-y-4">
                    <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                            <FormLabel>{t('invoiceForm.addItemDialog.customItemTab.descriptionLabel')}</FormLabel>
                            <FormControl>
                                <Input placeholder={t('invoiceForm.addItemDialog.customItemTab.descriptionPlaceholder')} {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="quantity" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('invoiceForm.addItemDialog.customItemTab.quantityLabel')}</FormLabel>
                                <FormControl>
                                    <Input type="number" step="any" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="unitPrice" render={({ field }) => (
                            <FormItem>
                                <FormLabel>{t('invoiceForm.addItemDialog.customItemTab.unitPriceLabel')}</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                    <div className="flex justify-end pt-4">
                         <DialogClose asChild>
                            <Button type="button" variant="ghost">{t('productForm.buttons.cancel')}</Button>
                         </DialogClose>
                        <Button type="submit">{t('invoiceForm.addItemDialog.customItemTab.addButton')}</Button>
                    </div>
                </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
