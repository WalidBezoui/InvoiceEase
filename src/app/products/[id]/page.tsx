
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Product, ProductTransaction, UserPreferences, ProductTipOutput } from "@/lib/types";
import { doc, getDoc, collection, query, where, orderBy, getDocs, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Edit, AlertTriangle, Package, DollarSign, History, PlusCircle, MinusCircle, Wrench, ShoppingCart, Trash2, Lightbulb, BarChart, Info, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/hooks/use-language";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProductAnalysis from "@/components/products/product-analysis";
import { getProductTip } from "@/ai/flows/product-analysis-flow";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";


export default function ProductDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, locale, isLoadingLocale } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [tip, setTip] = useState<ProductTipOutput | null>(null);
  const [isTipLoading, setIsTipLoading] = useState(false);
  const [transactions, setTransactions] = useState<ProductTransaction[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState<{ quantity: number, notes: string, price: number }>({ quantity: 0, notes: '', price: 0 });

  const isLoading = authLoading || isLoadingLocale || isLoadingData;
  
  const handleQuantityChange = (newQuantity: number) => {
    if (!product) return;
    const price = newQuantity > 0 
      ? product.purchasePrice || 0 
      : product.sellingPrice;
    setAdjustment({ ...adjustment, quantity: newQuantity, price });
  };

  const updateProductTip = async (currentProduct: Product, currentTransactions: ProductTransaction[]) => {
    if (!user) return;
    setIsTipLoading(true);
    try {
        const transactionSummary = currentTransactions.map(tx => ({
            type: tx.type,
            quantityChange: tx.quantityChange,
            transactionDate: tx.transactionDate.toDate().toISOString(),
            transactionPrice: tx.transactionPrice,
        })).slice(0, 50);

        const tipResult = await getProductTip({
            stockLevel: currentProduct.stock ?? 0,
            transactions: transactionSummary,
            language: locale
        });
        setTip(tipResult);
    } catch(err) {
        console.warn("Could not refresh product tip", err);
        setTip({ tip: t('productsPage.error'), type: 'warning' });
    } finally {
        setIsTipLoading(false);
    }
  }


  useEffect(() => {
    async function fetchProductData() {
      if (!user || !productId) {
        setIsLoadingData(false);
        return;
      }

      setIsLoadingData(true);
      setError(null);
      try {
        // Fetch product details
        const productRef = doc(db, "products", productId);
        const productSnap = await getDoc(productRef);
        let fetchedProduct: Product;

        if (productSnap.exists() && productSnap.data().userId === user.uid) {
          fetchedProduct = { id: productSnap.id, ...productSnap.data() } as Product;
          setProduct(fetchedProduct);
          setAdjustment(prev => ({ ...prev, price: fetchedProduct.sellingPrice }));
        } else {
          setError(t('productsPage.noProductsMatchSearch'));
          setIsLoadingData(false);
          return;
        }

        // Fetch user preferences
        const prefDocRef = doc(db, "userPreferences", user.uid);
        const prefDocSnap = await getDoc(prefDocRef);
        if (prefDocSnap.exists()) {
          setUserPrefs(prefDocSnap.data() as UserPreferences);
        }

        // Fetch product transactions
        const transRef = collection(db, "productTransactions");
        const q = query(
          transRef,
          where("userId", "==", user.uid),
          where("productId", "==", productId),
          orderBy("transactionDate", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedTransactions: ProductTransaction[] = [];
        querySnapshot.forEach((doc) => {
          fetchedTransactions.push({ id: doc.id, ...doc.data() } as ProductTransaction);
        });
        setTransactions(fetchedTransactions);

        // Fetch initial AI tip
        updateProductTip(fetchedProduct, fetchedTransactions);


      } catch (err) {
        console.error("Error fetching product data:", err);
        setError(t('productsPage.error'));
      } finally {
        setIsLoadingData(false);
      }
    }

    if (user && productId && !isLoadingLocale) {
        fetchProductData();
    } else if (!authLoading && !user) {
        setIsLoadingData(false);
    }
  }, [user, productId, authLoading, t, locale, isLoadingLocale]);

  const handleStockAdjustment = async () => {
    if (!product || !user || adjustment.quantity === 0) {
      toast({ title: t('productForm.toast.errorSaving'), description: "Please enter a valid quantity.", variant: "destructive"});
      return;
    }

    const batch = writeBatch(db);
    const productRef = doc(db, "products", product.id!);
    const transactionRef = doc(collection(db, "productTransactions"));

    const newStock = (product.stock || 0) + adjustment.quantity;
    const isPurchase = adjustment.quantity > 0;
    const type = isPurchase ? 'purchase' : 'sale';
    
    const newTransactionData: Partial<ProductTransaction> = {
        userId: user.uid,
        productId: product.id!,
        type: type,
        quantityChange: adjustment.quantity,
        newStock: newStock,
        notes: adjustment.notes || (isPurchase ? t('productDetailPage.stockAdjustment.purchaseNote') : t('productDetailPage.stockAdjustment.saleNote')),
        transactionPrice: adjustment.price,
    };
    
    batch.update(productRef, { stock: newStock });
    batch.set(transactionRef, { ...newTransactionData, transactionDate: serverTimestamp() });

    try {
      await batch.commit();
      
      const updatedProduct = { ...product, stock: newStock };
      const newTransaction = {
          id: transactionRef.id,
          ...newTransactionData,
          transactionDate: { toDate: () => new Date() } as any,
      } as ProductTransaction;
      const updatedTransactions = [newTransaction, ...transactions];

      setProduct(updatedProduct);
      setTransactions(updatedTransactions);
      updateProductTip(updatedProduct, updatedTransactions); // Refresh tip

      setAdjustment({ quantity: 0, notes: '', price: product.sellingPrice });
      toast({ title: t('productDetailPage.stockAdjusted'), description: t('productDetailPage.stockAdjustedDesc', {productName: product.name, newStock: newStock})});
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast({ title: "Error", description: t('productDetailPage.stockAdjustedError'), variant: "destructive" });
    }
  };
  
    const handleDeleteTransaction = async (transaction: ProductTransaction) => {
        if (!product || !user) return;

        const batch = writeBatch(db);
        const transactionRef = doc(db, "productTransactions", transaction.id!);
        const productRef = doc(db, "products", product.id!);

        const newStock = (product.stock ?? 0) - transaction.quantityChange;

        batch.update(productRef, { stock: newStock });
        batch.delete(transactionRef);

        try {
            await batch.commit();
            const updatedProduct = { ...product, stock: newStock };
            const updatedTransactions = transactions.filter(tx => tx.id !== transaction.id);
            setProduct(updatedProduct);
            setTransactions(updatedTransactions);
            updateProductTip(updatedProduct, updatedTransactions); // Refresh tip

            toast({ title: t('productDetailPage.transactionDeleted'), description: t('productDetailPage.transactionDeletedDesc')});
        } catch (error) {
            console.error("Error deleting transaction:", error);
            toast({ title: "Error", description: t('productDetailPage.transactionDeletedError'), variant: "destructive" });
        }
    };

  const getTransactionTypeIcon = (type: ProductTransaction['type']) => {
    switch (type) {
        case 'sale': return <ShoppingCart className="h-4 w-4 text-red-500" />;
        case 'purchase': return <PlusCircle className="h-4 w-4 text-green-500" />;
        case 'initial': return <Package className="h-4 w-4 text-blue-500" />;
        case 'adjustment': return <Wrench className="h-4 w-4 text-yellow-500" />;
        default: return <History className="h-4 w-4 text-muted-foreground" />;
    }
  }

  const getTipStyling = (type: ProductTipOutput['type']) => {
    switch (type) {
      case 'warning': return { icon: <AlertTriangle className="h-6 w-6 text-orange-600" />, cardClass: 'bg-orange-50 border-orange-200', textClass: 'text-orange-800' };
      case 'suggestion': return { icon: <Lightbulb className="h-6 w-6 text-blue-600" />, cardClass: 'bg-blue-50 border-blue-200', textClass: 'text-blue-800' };
      case 'info':
      default:
        return { icon: <Info className="h-6 w-6 text-gray-600" />, cardClass: 'bg-gray-50 border-gray-200', textClass: 'text-gray-800' };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">{t('productForm.toast.errorSaving')}</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('siteNav.products')}
        </Button>
      </div>
    );
  }

  if (!product) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">{t('productsPage.noProductsMatchSearch')}</h2>
        <p className="text-muted-foreground mb-6">{t('productsPage.noProductsMatchSearchDesc')}</p>
        <Button onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('siteNav.products')}
        </Button>
      </div>
    );
  }
  
  const tipStyling = tip ? getTipStyling(tip.type) : getTipStyling('info');

  return (
    <TooltipProvider>
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/products">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">{t('siteNav.products')}</span>
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{product.name}</h1>
            <p className="text-muted-foreground">{t('productsPage.table.reference')}: {product.reference || 'N/A'}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/products/${product.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> {t('productForm.editTitle')}
          </Link>
        </Button>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('productDetailPage.currentStock')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{product.stock ?? 'N/A'}</div>
            <p className="text-xs text-muted-foreground">{t('productDetailPage.unitsAvailable')}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('productForm.labels.sellingPrice')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{product.sellingPrice.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{userPrefs?.currency || 'MAD'}</p>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('productForm.labels.purchasePrice')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">{product.purchasePrice?.toFixed(2) || 'N/A'}</div>
             <p className="text-xs text-muted-foreground">{userPrefs?.currency || 'MAD'}</p>
          </CardContent>
        </Card>
        <Card className={cn("shadow-md border-2", tipStyling.cardClass)}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className={cn("text-sm font-medium", tipStyling.textClass)}>{t('productsPage.table.healthTip')}</CardTitle>
                {isTipLoading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : tipStyling.icon}
            </CardHeader>
            <CardContent>
                {isTipLoading ? (
                    <Skeleton className="h-5 w-3/4" />
                ) : (
                    <div className={cn("text-lg font-bold", tipStyling.textClass)}>{tip?.tip || t('productsPage.loading')}</div>
                )}
                 <p className="text-xs text-muted-foreground">{t('productsPage.table.aiGeneratedTip')}</p>
            </CardContent>
        </Card>
      </div>

       {product.description &&
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-xl text-primary">{t('productDetailPage.productDetails')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{product.description}</p>
            </CardContent>
        </Card>
       }
      
       <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-2">
            <Card className="shadow-lg h-full">
                <CardHeader>
                    <CardTitle className="font-headline text-xl text-primary flex items-center"><Wrench className="mr-2 h-5 w-5"/> {t('productDetailPage.stockAdjustment.title')}</CardTitle>
                    <CardDescription>{t('productDetailPage.stockAdjustment.description')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="quantity-adjustment">{t('productDetailPage.stockAdjustment.quantityLabel')}</Label>
                            <Input id="quantity-adjustment" type="number" placeholder={t('productDetailPage.stockAdjustment.quantityPlaceholder')} value={adjustment.quantity || ''} onChange={e => handleQuantityChange(parseInt(e.target.value) || 0)} />
                            <p className="text-xs text-muted-foreground mt-1">{t('productDetailPage.stockAdjustment.quantityDesc')}</p>
                        </div>
                        {adjustment.quantity !== 0 && (
                            <div>
                                <Label htmlFor="adjustment-price">
                                {adjustment.quantity > 0 ? t('productForm.labels.purchasePrice') : t('productForm.labels.sellingPrice')}
                                </Label>
                                <Input id="adjustment-price" type="number" step="0.01" value={adjustment.price} onChange={e => setAdjustment(prev => ({...prev, price: parseFloat(e.target.value) || 0}))} />
                                <p className="text-xs text-muted-foreground mt-1">{t('productDetailPage.stockAdjustment.priceDesc')}</p>
                            </div>
                        )}
                        <div>
                            <Label htmlFor="adjustment-notes">{t('productDetailPage.stockAdjustment.notesLabel')}</Label>
                            <Input id="adjustment-notes" type="text" placeholder={adjustment.quantity > 0 ? t('productDetailPage.stockAdjustment.notesPlaceholderPurchase') : t('productDetailPage.stockAdjustment.notesPlaceholderSale')} value={adjustment.notes} onChange={e => setAdjustment(prev => ({ ...prev, notes: e.target.value }))} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <Button onClick={handleStockAdjustment} disabled={adjustment.quantity === 0}>
                        {adjustment.quantity > 0 ? <PlusCircle className="mr-2"/> : <MinusCircle className="mr-2"/>}
                        {t('productDetailPage.stockAdjustment.confirmButton')}
                    </Button>
                </CardFooter>
            </Card>
        </div>

        <div className="lg:col-span-3">
             <Tabs defaultValue="history" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="history">
                        <History className="mr-2 h-4 w-4" /> {t('productDetailPage.transactionHistory.title')}
                    </TabsTrigger>
                    <TabsTrigger value="analysis">
                        <Lightbulb className="mr-2 h-4 w-4" /> {t('productDetailPage.analysis.title')}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="history">
                    <Card className="shadow-lg h-full">
                        <CardHeader>
                            <CardTitle className="font-headline text-xl text-primary flex items-center"><History className="mr-2 h-5 w-5"/> {t('productDetailPage.transactionHistory.title')}</CardTitle>
                            <CardDescription>{t('productDetailPage.transactionHistory.description')}</CardDescription>
                        </CardHeader>
                        <CardContent className="max-h-[400px] overflow-y-auto">
                            {transactions.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="hidden md:table-cell">{t('productDetailPage.transactionHistory.date')}</TableHead>
                                            <TableHead>{t('productDetailPage.transactionHistory.type')}</TableHead>
                                            <TableHead>{t('productDetailPage.transactionHistory.change')}</TableHead>
                                            <TableHead>{t('productDetailPage.transactionHistory.newStock')}</TableHead>
                                            <TableHead>{t('productDetailPage.transactionHistory.notes')}</TableHead>
                                            <TableHead className="text-right">{t('productsPage.table.actions')}</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell className="hidden md:table-cell text-xs">{format(tx.transactionDate.toDate(), "dd/MM/yy HH:mm")}</TableCell>
                                                <TableCell><Tooltip><TooltipTrigger><div className="flex items-center gap-2 capitalize">{getTransactionTypeIcon(tx.type)} <span className="hidden md:inline">{t(`productTransactionType.${tx.type}`)}</span></div></TooltipTrigger><TooltipContent>{t(`productTransactionType.${tx.type}`)}</TooltipContent></Tooltip></TableCell>
                                                <TableCell className={`font-bold ${tx.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>{tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}</TableCell>
                                                <TableCell className="font-medium">{tx.newStock}</TableCell>
                                                <TableCell className="text-xs max-w-[150px] truncate">
                                                    <Tooltip><TooltipTrigger>
                                                    {tx.invoiceId ? <Link href={`/invoices/${tx.invoiceId}`} className="text-primary hover:underline">{t('productDetailPage.transactionHistory.invoiceLink')} #{tx.notes}</Link> : tx.notes}
                                                    </TooltipTrigger><TooltipContent>{tx.notes}</TooltipContent></Tooltip>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                                                <span className="sr-only">Delete Transaction</span>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>{t('productDetailPage.dialog.deleteTitle')}</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    {t('productDetailPage.dialog.deleteDesc')}
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>{t('productsPage.dialog.cancel')}</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => handleDeleteTransaction(tx)} className="bg-destructive hover:bg-destructive/90">
                                                                    {t('productsPage.dialog.confirmDelete')}
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <p className="text-muted-foreground text-center py-8">{t('productDetailPage.transactionHistory.noHistory')}</p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="analysis">
                    <ProductAnalysis product={product} transactions={transactions} userPrefs={userPrefs} t={t} locale={locale}/>
                </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}
