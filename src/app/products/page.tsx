
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Package, Search, Loader2, Edit, Trash2, Eye, Lightbulb, AlertTriangle, Info, ChevronDown, FilterX } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Product, ProductTipOutput } from "@/lib/types";
import { collection, query, where, getDocs, orderBy, doc, deleteDoc } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/hooks/use-language";
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
import { useToast } from "@/hooks/use-toast";
import { getProductTip } from "@/ai/flows/product-analysis-flow";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";


const ALL_TIP_TYPES: ProductTipOutput['type'][] = ['warning', 'suggestion', 'info'];

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, locale, isLoadingLocale } = useLanguage();
  const { toast } = useToast();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [tips, setTips] = useState<Record<string, ProductTipOutput>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTipTypes, setSelectedTipTypes] = useState<Set<ProductTipOutput['type']>>(new Set());

  const isLoading = authLoading || isLoadingLocale || isLoadingData;

  useEffect(() => {
    async function fetchProductsAndTips() {
      if (!user) {
        setIsLoadingData(false);
        setAllProducts([]);
        return;
      }
      setIsLoadingData(true);
      setError(null);
      try {
        const productsRef = collection(db, "products");
        const q = query(productsRef, where("userId", "==", user.uid), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedProducts: Product[] = [];
        const tipPromises: Promise<{id: string, tip: ProductTipOutput}>[] = [];

        querySnapshot.forEach((doc) => {
          const product = { id: doc.id, ...doc.data() } as Product;
          fetchedProducts.push(product);

          // Get the last 15 transactions for trend analysis
          const transactionsQuery = query(
            collection(db, "productTransactions"),
            where("productId", "==", product.id),
            orderBy("transactionDate", "desc"),
            where("userId", "==", user.uid)
          );

          const promise = getDocs(transactionsQuery).then(transSnap => {
             const transactionSummary = transSnap.docs.map(d => {
                const data = d.data();
                return {
                    type: data.type,
                    quantityChange: data.quantityChange,
                    transactionDate: data.transactionDate.toDate().toISOString(),
                }
            }).slice(0, 50); // Limit to recent transactions

            return getProductTip({
              stockLevel: product.stock ?? 0,
              transactions: transactionSummary,
              language: locale
            }).then(tip => ({ id: product.id!, tip }));
          }).catch(err => {
              console.warn(`Could not fetch tip for product ${product.id}:`, err);
              return {id: product.id!, tip: {tip: 'N/A', type: 'info'}};
          });

          tipPromises.push(promise);
        });

        setAllProducts(fetchedProducts);

        const resolvedTips = await Promise.all(tipPromises);
        const tipsMap: Record<string, ProductTipOutput> = {};
        resolvedTips.forEach(result => {
          tipsMap[result.id] = result.tip;
        });
        setTips(tipsMap);

      } catch (err) {
        console.error("Error fetching products:", err);
        setError(t('productsPage.error'));
      } finally {
        setIsLoadingData(false);
      }
    }

    if (user && !isLoadingLocale) {
      fetchProductsAndTips();
    } else if (!authLoading && !user) {
      setIsLoadingData(false);
      setAllProducts([]);
      setError(null);
    }
  }, [user, authLoading, t, locale, isLoadingLocale]);

  const handleTipTypeToggle = (tipType: ProductTipOutput['type']) => {
    setSelectedTipTypes(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(tipType)) {
        newSelected.delete(tipType);
      } else {
        newSelected.add(tipType);
      }
      return newSelected;
    });
  };
  
  const handleClearTipFilters = () => {
    setSelectedTipTypes(new Set());
  };

  const filteredProducts = useMemo(() => {
    let productsToDisplay = [...allProducts];
    
    if (searchTerm) {
        const lowerSearchTerm = searchTerm.toLowerCase();
        productsToDisplay = productsToDisplay.filter(product =>
            product.name.toLowerCase().includes(lowerSearchTerm) ||
            (product.reference && product.reference.toLowerCase().includes(lowerSearchTerm)) ||
            product.description.toLowerCase().includes(lowerSearchTerm)
        );
    }

    if (selectedTipTypes.size > 0) {
        productsToDisplay = productsToDisplay.filter(product => {
            const productTip = tips[product.id!];
            return productTip && selectedTipTypes.has(productTip.type);
        });
    }
    
    return productsToDisplay;
  }, [allProducts, searchTerm, selectedTipTypes, tips]);

  const handleDelete = async (productId: string) => {
    if (!user) {
      toast({ title: t('productForm.toast.authError'), variant: 'destructive' });
      return;
    }
    const productToDelete = allProducts.find(p => p.id === productId);
    if (!productToDelete) return;

    try {
      await deleteDoc(doc(db, "products", productId));
      setAllProducts(prev => prev.filter(p => p.id !== productId));
      toast({
        title: t('productsPage.toast.deleteSuccessTitle'),
        description: t('productsPage.toast.deleteSuccessDesc', { productName: productToDelete.name }),
      });
    } catch (error) {
      console.error("Error deleting product:", error);
      toast({
        title: t('productsPage.toast.deleteErrorTitle'),
        description: t('productsPage.toast.deleteErrorDesc'),
        variant: 'destructive'
      });
    }
  };

  const getTipIcon = (type: ProductTipOutput['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'suggestion': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'info': return <Info className="h-4 w-4 text-gray-500" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{t('productsPage.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('productsPage.description')}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/products/new">
            <Package className="mr-2 h-5 w-5" /> {t('productsPage.addNewProduct')}
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-xl text-primary">{t('productsPage.yourProductsCard.title')}</CardTitle>
              <CardDescription>{t('productsPage.yourProductsCard.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
              <div className="relative flex-grow">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder={t('productsPage.yourProductsCard.searchPlaceholder')} 
                  className="pl-8 w-full min-w-[200px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex-shrink-0">
                     {t('productsPage.yourProductsCard.filterByTip')} {selectedTipTypes.size > 0 ? `(${selectedTipTypes.size})` : ''} <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('productsPage.yourProductsCard.filterByTip')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_TIP_TYPES.map((tipType) => (
                    <DropdownMenuCheckboxItem
                      key={tipType}
                      checked={selectedTipTypes.has(tipType)}
                      onCheckedChange={() => handleTipTypeToggle(tipType)}
                      onSelect={(e) => e.preventDefault()} 
                      className="capitalize"
                    >
                      {t(`productTipType.${tipType}`, { default: tipType })}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {selectedTipTypes.size > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleClearTipFilters} className="text-sm">
                        <FilterX className="mr-2 h-4 w-4" /> {t('invoicesPage.yourInvoicesCard.clearAllFilters')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">{t('productsPage.loading')}</p>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive"><p>{error}</p></div>
          ) : filteredProducts.length > 0 ? (
             <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('productsPage.table.name')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('productsPage.table.reference')}</TableHead>
                    <TableHead>
                        <div className="flex items-center gap-1">
                            {t('productsPage.table.healthTip')}
                            <Tooltip>
                                <TooltipTrigger><Info className="h-3 w-3 text-muted-foreground"/></TooltipTrigger>
                                <TooltipContent><p>{t('productsPage.table.aiGeneratedTip')}</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </TableHead>
                    <TableHead className="text-right hidden sm:table-cell">{t('productsPage.table.sellingPrice')}</TableHead>
                    <TableHead className="text-right">{t('productsPage.table.stock')}</TableHead>
                    <TableHead className="text-right">{t('productsPage.table.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{product.reference || 'N/A'}</TableCell>
                      <TableCell>
                        {tips[product.id!] ? (
                            <div className="flex items-center gap-1.5">
                                {getTipIcon(tips[product.id!].type)}
                                <span className="text-muted-foreground text-xs italic hidden sm:inline">{tips[product.id!].tip}</span>
                            </div>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">{t('productsPage.loading')}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{product.sellingPrice.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">{product.stock !== undefined ? product.stock : 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/products/${product.id}`}>
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">{t('productsPage.actions.view')}</span>
                            </Link> 
                          </Button>
                          </TooltipTrigger><TooltipContent><p>{t('productsPage.actions.view')}</p></TooltipContent></Tooltip>
                          
                          <Tooltip><TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/products/${product.id}/edit`}>
                              <Edit className="h-4 w-4" />
                               <span className="sr-only">{t('productsPage.actions.edit')}</span>
                            </Link> 
                          </Button>
                          </TooltipTrigger><TooltipContent><p>{t('productsPage.actions.edit')}</p></TooltipContent></Tooltip>

                          <AlertDialog>
                             <Tooltip><TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">{t('productsPage.actions.delete')}</span>
                                </Button>
                             </TooltipTrigger><TooltipContent><p>{t('productsPage.actions.delete')}</p></TooltipContent></Tooltip>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>{t('productsPage.dialog.deleteTitle')}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {t('productsPage.dialog.deleteDesc', { productName: product.name })}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>{t('productsPage.dialog.cancel')}</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(product.id!)} className="bg-destructive hover:bg-destructive/90">
                                  {t('productsPage.dialog.confirmDelete')}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          ) : (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-primary">
                {allProducts.length > 0 && (searchTerm || selectedTipTypes.size > 0)
                  ? t('productsPage.noProductsMatchFilter')
                  : t('productsPage.noProductsYet')
                }
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {allProducts.length > 0 && (searchTerm || selectedTipTypes.size > 0)
                  ? t('productsPage.noProductsMatchFilterDesc')
                  : t('productsPage.noProductsYetDesc')
                }
              </p>
              {!(allProducts.length > 0 && searchTerm) && (
                 <Button className="mt-6" asChild>
                  <Link href="/products/new">{t('productsPage.addProduct')}</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    