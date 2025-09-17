
"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save } from "lucide-react";
import type { Invoice, Product } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { collection, writeBatch, serverTimestamp, getDocs, query, where, doc } from 'firebase/firestore';

interface QuickSaveDialogProps {
  invoice: Invoice;
  onSaveSuccess?: () => void;
}

interface SavableItem {
  id: string; // Use invoice item ID as a key
  description: string;
  reference: string;
  sellingPrice: number;
}

export default function QuickSaveDialog({ invoice, onSaveSuccess }: QuickSaveDialogProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [itemsToSave, setItemsToSave] = useState<SavableItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Record<string, SavableItem>>({});

  useEffect(() => {
    async function findUnsavedItems() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);

      try {
        // 1. Get all existing product references for the user
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        const existingReferences = new Set<string>();
        querySnapshot.forEach(doc => {
            const product = doc.data() as Product;
            if (product.reference) {
                existingReferences.add(product.reference.toLowerCase());
            }
        });

        // 2. Filter invoice items that don't have a productId and their reference is not in existing products
        const unsavedItems = invoice.items.filter(item => {
            const hasId = !!item.productId;
            const refExists = item.reference && existingReferences.has(item.reference.toLowerCase());
            return !hasId && !refExists;
        });

        const savable = unsavedItems.map(item => ({
            id: item.id || `${item.description}-${item.unitPrice}`, // fallback id
            description: item.description,
            reference: item.reference || '',
            sellingPrice: item.unitPrice,
        }));
        
        setItemsToSave(savable);

        // 3. Pre-select all found items
        const initialSelection: Record<string, SavableItem> = {};
        savable.forEach(item => {
            initialSelection[item.id] = item;
        });
        setSelectedItems(initialSelection);

      } catch (error) {
          console.error("Error finding unsaved items:", error);
          toast({
              title: t('invoicesPage.quickSaveDialog.toast.errorLoadingTitle'),
              description: t('invoicesPage.quickSaveDialog.toast.errorLoadingDesc'),
              variant: 'destructive',
          });
      } finally {
        setIsLoading(false);
      }
    }

    findUnsavedItems();
  }, [invoice, user, t, toast]);

  const handleToggleItem = (item: SavableItem, checked: boolean) => {
    setSelectedItems(prev => {
        const newSelected = { ...prev };
        if (checked) {
            newSelected[item.id] = item;
        } else {
            delete newSelected[item.id];
        }
        return newSelected;
    });
  };

  const handleFieldChange = (itemId: string, field: keyof SavableItem, value: string | number) => {
    // Update both the main list and the selection list to keep them in sync
    const updateState = (prev: SavableItem[]) =>
        prev.map(i => i.id === itemId ? { ...i, [field]: value } : i);
    
    setItemsToSave(updateState);
    
    setSelectedItems(prev => {
        if(prev[itemId]) {
            return {...prev, [itemId]: {...prev[itemId], [field]:value}};
        }
        return prev;
    });
  };

  const handleSaveSelected = async () => {
    if (!user) {
        toast({ title: t('toast.authErrorTitle'), description: t('toast.authErrorDesc'), variant: 'destructive'});
        return;
    }
    const itemsToProcess = Object.values(selectedItems);

    if (itemsToProcess.length === 0) {
        toast({ title: t('invoicesPage.quickSaveDialog.toast.noItemsSelectedTitle'), variant: 'destructive' });
        return;
    }

    setIsSaving(true);
    const batch = writeBatch(db);

    itemsToProcess.forEach(item => {
        const newProductRef = doc(collection(db, "products"));
        const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'lastTransactionDate'> = {
            userId: user.uid,
            name: item.description,
            reference: item.reference || `SKU-${newProductRef.id.substring(0,6).toUpperCase()}`,
            sellingPrice: item.sellingPrice,
            description: "",
            purchasePrice: 0,
            stock: 0,
        };
        batch.set(newProductRef, {
            ...productData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    });

    try {
        await batch.commit();
        toast({
            title: t('invoicesPage.quickSaveDialog.toast.saveSuccessTitle'),
            description: t('invoicesPage.quickSaveDialog.toast.saveSuccessDesc', { count: itemsToProcess.length }),
        });
        onSaveSuccess?.();
    } catch (error) {
        console.error("Error saving new parts:", error);
        toast({
            title: t('invoicesPage.quickSaveDialog.toast.saveErrorTitle'),
            description: t('invoicesPage.quickSaveDialog.toast.saveErrorDesc'),
            variant: 'destructive',
        });
    } finally {
        setIsSaving(false);
    }
  };

  const isAllSelected = Object.keys(selectedItems).length > 0 && Object.keys(selectedItems).length === itemsToSave.length;
  const isPartiallySelected = Object.keys(selectedItems).length > 0 && !isAllSelected;

  return (
    <DialogContent className="sm:max-w-4xl">
      <DialogHeader>
        <DialogTitle>{t('invoicesPage.quickSaveDialog.title')}</DialogTitle>
        <DialogDescription>
          {t('invoicesPage.quickSaveDialog.description', { invoiceNumber: invoice.invoiceNumber })}
        </DialogDescription>
      </DialogHeader>

      {isLoading ? (
        <div className="flex justify-center items-center h-60">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : itemsToSave.length === 0 ? (
        <div className="text-center py-16">
            <p className="text-lg font-semibold text-primary">{t('invoicesPage.quickSaveDialog.noItemsFoundTitle')}</p>
            <p className="text-muted-foreground mt-2">{t('invoicesPage.quickSaveDialog.noItemsFoundDesc')}</p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto border rounded-md">
          <Table>
            <TableHeader className="sticky top-0 bg-secondary z-10">
              <TableRow>
                <TableHead className="w-12">
                  <Checkbox 
                    onCheckedChange={(checked) => {
                      if (checked) {
                        const allSelected: Record<string, SavableItem> = {};
                        itemsToSave.forEach(item => allSelected[item.id] = item);
                        setSelectedItems(allSelected);
                      } else {
                        setSelectedItems({});
                      }
                    }}
                    checked={isAllSelected}
                    indeterminate={isPartiallySelected}
                  />
                </TableHead>
                <TableHead>{t('invoicesPage.quickSaveDialog.table.partName')}</TableHead>
                <TableHead>{t('invoicesPage.quickSaveDialog.table.partNumber')}</TableHead>
                <TableHead className="text-right">{t('invoicesPage.quickSaveDialog.table.price')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsToSave.map(item => (
                <TableRow key={item.id} className={selectedItems[item.id] ? 'bg-primary/5' : ''}>
                  <TableCell>
                    <Checkbox 
                      checked={!!selectedItems[item.id]}
                      onCheckedChange={(checked) => handleToggleItem(item, !!checked)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.description}
                      onChange={e => handleFieldChange(item.id, 'description', e.target.value)}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.reference}
                      onChange={e => handleFieldChange(item.id, 'reference', e.target.value)}
                      placeholder={t('invoicesPage.quickSaveDialog.table.partNumberPlaceholder')}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={item.sellingPrice}
                      onChange={e => handleFieldChange(item.id, 'sellingPrice', parseFloat(e.target.value) || 0)}
                      className="h-8 w-28 text-right ml-auto"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">{t('productForm.buttons.cancel')}</Button>
        </DialogClose>
        <Button type="button" onClick={handleSaveSelected} disabled={isLoading || isSaving || Object.keys(selectedItems).length === 0}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
          {t('invoicesPage.quickSaveDialog.saveButton', { count: Object.keys(selectedItems).length })}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
