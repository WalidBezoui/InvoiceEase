
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Package, Search, Loader2, Edit, Trash2, Eye } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Product } from "@/lib/types";
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

export default function ProductsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, isLoadingLocale } = useLanguage();
  const { toast } = useToast();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isLoading = authLoading || isLoadingLocale || isLoadingData;

  useEffect(() => {
    async function fetchProducts() {
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
        querySnapshot.forEach((doc) => {
          fetchedProducts.push({ id: doc.id, ...doc.data() } as Product);
        });
        setAllProducts(fetchedProducts);
      } catch (err) {
        console.error("Error fetching products:", err);
        setError(t('productsPage.error'));
      } finally {
        setIsLoadingData(false);
      }
    }

    if (user) {
      fetchProducts();
    } else if (!authLoading && !user) {
      setIsLoadingData(false);
      setAllProducts([]);
      setError(null);
    }
  }, [user, authLoading, t]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return allProducts;
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allProducts.filter(product =>
      product.name.toLowerCase().includes(lowerSearchTerm) ||
      (product.reference && product.reference.toLowerCase().includes(lowerSearchTerm)) ||
      product.description.toLowerCase().includes(lowerSearchTerm)
    );
  }, [allProducts, searchTerm]);

  const handleDelete = async (productId: string) => {
    if (!user) {
      toast({ title: t('productForm.toast.authError'), variant: 'destructive' });
      return;
    }
    const productToDelete = allProducts.find(p => p.id === productId);
    if (!productToDelete) return;

    try {
      await deleteDoc(doc(db, "products", productId));
      // You might want to delete related transactions as well, or handle them as orphaned.
      // For now, we just delete the product.
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
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder={t('productsPage.yourProductsCard.searchPlaceholder')} 
                className="pl-8 sm:w-[250px] md:w-[300px]" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
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
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('productsPage.table.name')}</TableHead>
                  <TableHead>{t('productsPage.table.reference', { default: "Reference" })}</TableHead>
                  <TableHead className="text-right">{t('productsPage.table.sellingPrice', { default: "Selling Price" })}</TableHead>
                  <TableHead className="text-right">{t('productsPage.table.stock', { default: "Stock" })}</TableHead>
                  <TableHead className="text-right">{t('productsPage.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">{product.name}</TableCell>
                    <TableCell>{product.reference || 'N/A'}</TableCell>
                    <TableCell className="text-right">{product.sellingPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{product.stock !== undefined ? product.stock : 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/products/${product.id}`}>
                            <Eye className="mr-1 h-4 w-4" /> {t('productsPage.actions.view', { default: 'View' })}
                          </Link> 
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/products/${product.id}/edit`}>
                            <Edit className="mr-1 h-4 w-4" /> {t('productsPage.actions.edit')}
                          </Link> 
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                              <Trash2 className="mr-1 h-4 w-4" /> {t('productsPage.actions.delete')}
                            </Button>
                          </AlertDialogTrigger>
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
          ) : (
            <div className="text-center py-12">
              <Package className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-primary">
                {allProducts.length > 0 && searchTerm ? t('productsPage.noProductsMatchSearch') : t('productsPage.noProductsYet')}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {allProducts.length > 0 && searchTerm 
                  ? t('productsPage.noProductsMatchSearchDesc') 
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
