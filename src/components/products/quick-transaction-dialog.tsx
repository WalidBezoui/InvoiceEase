
"use client";

import { useState, type ReactNode } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, PlusCircle, MinusCircle, Wrench } from "lucide-react";
import type { Product } from '@/lib/types';
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from '@/hooks/use-language';
import { handleStockAdjustment } from '@/lib/stock-management';


interface QuickTransactionDialogProps {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTransactionSuccess?: () => void;
}

export default function QuickTransactionDialog({ product, open, onOpenChange, onTransactionSuccess }: QuickTransactionDialogProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [adjustment, setAdjustment] = useState<{ quantity: number, notes: string, price: number }>({ quantity: 0, notes: '', price: product.sellingPrice });

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      // Reset state when closing
      setAdjustment({ quantity: 0, notes: '', price: product.sellingPrice });
    }
    onOpenChange(isOpen);
  };

  const handleQuantityChange = (newQuantity: number) => {
    if (!product) return;
    const price = newQuantity > 0 
      ? product.purchasePrice || 0 
      : product.sellingPrice;
    setAdjustment({ ...adjustment, quantity: newQuantity, price });
  };

  const submitTransaction = async () => {
    if (!user || adjustment.quantity === 0) {
      toast({ title: t('productForm.toast.errorSaving', { default: 'Error'}), description: t('productDetailPage.stockAdjustment.quantityDesc', { default: 'Please enter a valid quantity.'}), variant: "destructive"});
      return;
    }
    setIsLoading(true);

    try {
        await handleStockAdjustment(
            product.id!,
            adjustment.quantity,
            adjustment.notes,
            user.uid,
            adjustment.price
        );
        toast({ title: t('productDetailPage.stockAdjusted'), description: t('productDetailPage.stockAdjustedDesc', {productName: product.name, newStock: (product.stock || 0) + adjustment.quantity})});
        onTransactionSuccess?.();
        handleOpenChange(false);
    } catch (error) {
        console.error("Error adjusting stock:", error);
        toast({ title: "Error", description: t('productDetailPage.stockAdjustedError'), variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Wrench className="mr-2 h-5 w-5"/> {t('productDetailPage.stockAdjustment.title')}</DialogTitle>
          <DialogDescription>
            {t('productDetailPage.stockAdjustment.quickTransactionFor', { default: 'Quick transaction for' })} <strong>{product.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            <div className="space-y-2">
                <Label htmlFor="quantity-adjustment">{t('productDetailPage.stockAdjustment.quantityLabel')}</Label>
                <Input id="quantity-adjustment" type="number" placeholder={t('productDetailPage.stockAdjustment.quantityPlaceholder')} value={adjustment.quantity || ''} onChange={e => handleQuantityChange(parseInt(e.target.value) || 0)} />
                <p className="text-xs text-muted-foreground">{t('productDetailPage.stockAdjustment.quantityDesc')}</p>
            </div>
            {adjustment.quantity !== 0 && (
                <div className="space-y-2">
                    <Label htmlFor="adjustment-price">
                    {adjustment.quantity > 0 ? t('productForm.labels.purchasePrice') : t('productForm.labels.sellingPrice')}
                    </Label>
                    <Input id="adjustment-price" type="number" step="0.01" value={adjustment.price} onChange={e => setAdjustment(prev => ({...prev, price: parseFloat(e.target.value) || 0}))} />
                </div>
            )}
            <div className="space-y-2">
                <Label htmlFor="adjustment-notes">{t('productDetailPage.stockAdjustment.notesLabel')}</Label>
                <Input id="adjustment-notes" type="text" placeholder={adjustment.quantity > 0 ? t('productDetailPage.stockAdjustment.notesPlaceholderPurchase') : t('productDetailPage.stockAdjustment.notesPlaceholderSale')} value={adjustment.notes} onChange={e => setAdjustment(prev => ({ ...prev, notes: e.target.value }))} />
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{t('productForm.buttons.cancel')}</Button>
          </DialogClose>
          <Button onClick={submitTransaction} disabled={isLoading || adjustment.quantity === 0}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : (adjustment.quantity > 0 ? <PlusCircle className="mr-2"/> : <MinusCircle className="mr-2"/>)}
            {t('productDetailPage.stockAdjustment.confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
