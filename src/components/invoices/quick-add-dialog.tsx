
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
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, PackagePlus } from "lucide-react";
import type { Product, InvoiceItem } from '@/lib/types';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

interface QuickAddDialogProps {
  products: Product[];
  isLoading: boolean;
  onAddItems: (items: Array<Pick<InvoiceItem, 'productId' | 'reference' | 'description' | 'quantity' | 'unitPrice'>>) => void;
  currency: string;
  t: (key: string, params?: Record<string, any>) => string;
}

interface SelectedProduct {
    product: Product;
    quantity: number;
}

export default function QuickAddDialog({ products, isLoading, onAddItems, currency, t }: QuickAddDialogProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Record<string, SelectedProduct>>({});
  const { toast } = useToast();

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lowerSearch = searchTerm.toLowerCase();
    return products.filter(p => 
        p.name.toLowerCase().includes(lowerSearch) ||
        (p.reference && p.reference.toLowerCase().includes(lowerSearch))
    );
  }, [products, searchTerm]);

  const handleToggleProduct = (product: Product, checked: boolean) => {
    setSelectedProducts(prev => {
        const newSelected = { ...prev };
        if (checked) {
            newSelected[product.id!] = { product, quantity: 1 };
        } else {
            delete newSelected[product.id!];
        }
        return newSelected;
    });
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity >= 0) {
      setSelectedProducts(prev => ({
        ...prev,
        [productId]: { ...prev[productId], quantity }
      }));
    }
  };

  const handleAddSelected = () => {
    const itemsToAdd = Object.values(selectedProducts)
      .filter(item => item.quantity > 0)
      .map(({ product, quantity }) => ({
        productId: product.id,
        reference: product.reference,
        description: product.name,
        quantity: quantity,
        unitPrice: product.sellingPrice,
      }));
      
    if (itemsToAdd.length === 0) {
      toast({
        title: t('invoiceForm.quickAddDialog.toast.noItemsTitle'),
        description: t('invoiceForm.quickAddDialog.toast.noItemsDesc'),
        variant: 'destructive',
      });
      return;
    }
    
    onAddItems(itemsToAdd);
    setOpen(false);
    setSelectedProducts({}); // Reset for next time
  };
  
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
        setSelectedProducts({});
    }
    setOpen(isOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary">
          <PackagePlus className="mr-2 h-4 w-4" /> {t('invoiceForm.buttons.quickAdd', {default: "Quick Add Parts"})}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t('invoiceForm.quickAddDialog.title')}</DialogTitle>
          <DialogDescription>{t('invoiceForm.quickAddDialog.description')}</DialogDescription>
        </DialogHeader>
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
                <div className="max-h-[50vh] overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary">
                            <TableRow>
                            <TableHead className="w-12"><Checkbox 
                                onCheckedChange={(checked) => {
                                    if (checked) {
                                        const newSelected: Record<string, SelectedProduct> = {};
                                        filteredProducts.forEach(p => newSelected[p.id!] = {product: p, quantity: 1});
                                        setSelectedProducts(newSelected);
                                    } else {
                                        setSelectedProducts({});
                                    }
                                }}
                                checked={Object.keys(selectedProducts).length > 0 && Object.keys(selectedProducts).length === filteredProducts.length}
                                indeterminate={Object.keys(selectedProducts).length > 0 && Object.keys(selectedProducts).length < filteredProducts.length}
                            /></TableHead>
                            <TableHead>{t('invoiceForm.addItemDialog.selectProductTab.name')}</TableHead>
                            <TableHead>{t('invoiceForm.addItemDialog.selectProductTab.reference')}</TableHead>
                            <TableHead className="text-right">{t('invoiceForm.addItemDialog.selectProductTab.price')}</TableHead>
                            <TableHead className="text-right">{t('invoiceForm.addItemDialog.selectProductTab.stock')}</TableHead>
                            <TableHead className="w-24 text-right">{t('invoiceForm.addItemDialog.customItemTab.quantityLabel')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.map(product => (
                            <TableRow key={product.id} className={selectedProducts[product.id!] ? 'bg-primary/5' : ''}>
                                <TableCell>
                                    <Checkbox 
                                        checked={!!selectedProducts[product.id!]}
                                        onCheckedChange={(checked) => handleToggleProduct(product, !!checked)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.reference || 'N/A'}</TableCell>
                                <TableCell className="text-right">{currency} {product.sellingPrice.toFixed(2)}</TableCell>
                                <TableCell className="text-right">{product.stock ?? 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                    <Input 
                                        type="number" 
                                        className="h-8 w-20 text-right"
                                        min={0}
                                        value={selectedProducts[product.id!]?.quantity || 0}
                                        onChange={(e) => handleQuantityChange(product.id!, parseInt(e.target.value) || 0)}
                                        disabled={!selectedProducts[product.id!]}
                                        onClick={(e) => e.target.select()}
                                    />
                                </TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{t('productForm.buttons.cancel')}</Button>
          </DialogClose>
          <Button type="button" onClick={handleAddSelected}>{t('invoiceForm.quickAddDialog.addButton', {count: Object.keys(selectedProducts).length})}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
