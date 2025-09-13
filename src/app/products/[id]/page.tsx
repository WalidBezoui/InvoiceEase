
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Product, ProductTransaction, UserPreferences } from "@/lib/types";
import { doc, getDoc, collection, query, where, orderBy, getDocs, writeBatch, serverTimestamp, deleteDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Edit, AlertTriangle, Package, DollarSign, History, PlusCircle, MinusCircle, Wrench, ShoppingCart, Trash2 } from "lucide-react";
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


export default function ProductDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, isLoadingLocale } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [transactions, setTransactions] = useState<ProductTransaction[]>([]);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adjustment, setAdjustment] = useState({ quantity: 0, notes: '', price: 0 });

  const isLoading = authLoading || isLoadingLocale || isLoadingData;

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

        if (productSnap.exists() && productSnap.data().userId === user.uid) {
          const fetchedProduct = { id: productSnap.id, ...productSnap.data() } as Product;
          setProduct(fetchedProduct);
          // Set initial price for adjustment
          setAdjustment(prev => ({ ...prev, price: fetchedProduct.sellingPrice }));
        } else {
          setError("Product not found or you don't have permission.");
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

      } catch (err) {
        console.error("Error fetching product data:", err);
        setError("Failed to load product data. Please try again.");
      } finally {
        setIsLoadingData(false);
      }
    }

    if (user && productId) {
        fetchProductData();
    } else if (!authLoading) {
        setIsLoadingData(false);
    }
  }, [user, productId, authLoading]);

  const handleStockAdjustment = async () => {
    if (!product || !user || adjustment.quantity === 0) {
      toast({ title: "Invalid adjustment", description: "Please enter a valid quantity.", variant: "destructive"});
      return;
    }

    const batch = writeBatch(db);
    const productRef = doc(db, "products", product.id!);
    const transactionRef = doc(collection(db, "productTransactions"));

    const newStock = (product.stock || 0) + adjustment.quantity;
    const isSale = adjustment.quantity < 0;
    const type = isSale ? 'adjustment' : 'purchase';
    
    const newTransactionData: Omit<ProductTransaction, 'id' | 'transactionDate'> = {
        userId: user.uid,
        productId: product.id!,
        type: type,
        quantityChange: adjustment.quantity,
        newStock: newStock,
        notes: adjustment.notes || (isSale ? 'Manual sale' : 'Stock purchase'),
    };

    if (isSale) {
        newTransactionData.transactionPrice = adjustment.price;
    }

    // Update product stock
    batch.update(productRef, { stock: newStock });

    // Create transaction record
    batch.set(transactionRef, {
        ...newTransactionData,
        transactionDate: serverTimestamp(),
    });

    try {
      await batch.commit();
      // Optimistically update UI
      setProduct(prev => prev ? { ...prev, stock: newStock } : null);
      setTransactions(prev => [{
          id: transactionRef.id,
          ...newTransactionData,
          transactionDate: { toDate: () => new Date() } as any,
      }, ...prev]);
      setAdjustment({ quantity: 0, notes: '', price: product.sellingPrice }); // Reset form
      toast({ title: "Stock Adjusted", description: `Stock for ${product.name} updated to ${newStock}.`});
    } catch (error) {
      console.error("Error adjusting stock:", error);
      toast({ title: "Error", description: "Failed to adjust stock. Please try again.", variant: "destructive" });
    }
  };
  
    const handleDeleteTransaction = async (transaction: ProductTransaction) => {
        if (!product || !user) return;

        const batch = writeBatch(db);
        const transactionRef = doc(db, "productTransactions", transaction.id!);
        const productRef = doc(db, "products", product.id!);

        const newStock = (product.stock ?? 0) - transaction.quantityChange;

        // Revert stock on product
        batch.update(productRef, { stock: newStock });
        
        // Delete the transaction
        batch.delete(transactionRef);

        try {
            await batch.commit();
            // Optimistically update UI
            setProduct(prev => prev ? { ...prev, stock: newStock } : null);
            setTransactions(prev => prev.filter(tx => tx.id !== transaction.id));
            toast({ title: "Transaction Deleted", description: "The transaction has been deleted and stock has been reversed."});
        } catch (error) {
            console.error("Error deleting transaction:", error);
            toast({ title: "Error", description: "Failed to delete transaction.", variant: "destructive" });
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


  if (isLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Product</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
      </div>
    );
  }

  if (!product) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">Product Not Found</h2>
        <p className="text-muted-foreground mb-6">The product you are trying to view does not exist or could not be loaded.</p>
        <Button onClick={() => router.push("/products")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Products
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/products">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to Products</span>
            </Link>
          </Button>
          <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{product.name}</h1>
            <p className="text-muted-foreground mt-1">Reference: {product.reference || 'N/A'}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/products/${product.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> Edit Product
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary flex items-center"><Package className="mr-2"/> Product Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1">
                <div className="text-muted-foreground">Description</div>
                <div className="font-medium text-base whitespace-pre-wrap">{product.description}</div>
            </div>
             <div className="space-y-1">
                <div className="text-muted-foreground">Current Stock</div>
                <div className="font-bold text-2xl text-primary">{product.stock !== undefined ? product.stock : 'N/A'}</div>
            </div>
            <div className="space-y-4">
                 <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Selling Price</span>
                    <span className="font-medium">{product.sellingPrice.toFixed(2)} {userPrefs?.currency}</span>
                </div>
                 <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Purchase Price</span>
                    <span className="font-medium">{product.purchasePrice?.toFixed(2) || 'N/A'} {userPrefs?.currency}</span>
                </div>
            </div>
        </CardContent>
      </Card>
      
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-xl text-primary flex items-center"><Wrench className="mr-2"/> Adjust Stock</CardTitle>
                <CardDescription>Manually add or remove stock (e.g., for new purchases, returns, or corrections).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1">
                        <Label htmlFor="quantity-adjustment">Quantity</Label>
                        <Input id="quantity-adjustment" type="number" placeholder="e.g., 50 or -5" value={adjustment.quantity || ''} onChange={e => setAdjustment(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))} />
                        <p className="text-xs text-muted-foreground mt-1">Use a negative number to remove stock.</p>
                    </div>
                     <div className="md:col-span-2">
                        <Label htmlFor="adjustment-notes">Notes (Optional)</Label>
                        <Input id="adjustment-notes" type="text" placeholder="e.g., New shipment, Direct sale" value={adjustment.notes} onChange={e => setAdjustment(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                    {adjustment.quantity < 0 && (
                        <div className="md:col-span-1">
                            <Label htmlFor="selling-price">Selling Price</Label>
                            <Input id="selling-price" type="number" step="0.01" value={adjustment.price} onChange={e => setAdjustment(prev => ({...prev, price: parseFloat(e.target.value) || 0}))} />
                            <p className="text-xs text-muted-foreground mt-1">Price per unit for this sale.</p>
                        </div>
                    )}
                </div>
                 <Button onClick={handleStockAdjustment} disabled={adjustment.quantity === 0}>
                    {adjustment.quantity > 0 ? <PlusCircle className="mr-2"/> : <MinusCircle className="mr-2"/>}
                    Adjust Stock
                </Button>
            </CardContent>
        </Card>

        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-xl text-primary flex items-center"><History className="mr-2"/> Transaction History</CardTitle>
                <CardDescription>A complete log of all stock movements for this product.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-96 overflow-y-auto">
                {transactions.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Change</TableHead>
                                <TableHead>New Stock</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(tx => (
                                <TableRow key={tx.id}>
                                    <TableCell>{format(tx.transactionDate.toDate(), "MMM dd, yyyy HH:mm")}</TableCell>
                                    <TableCell><div className="flex items-center gap-2 capitalize">{getTransactionTypeIcon(tx.type)} {tx.type}</div></TableCell>
                                    <TableCell className={`font-bold ${tx.quantityChange > 0 ? 'text-green-600' : 'text-red-600'}`}>{tx.quantityChange > 0 ? `+${tx.quantityChange}` : tx.quantityChange}</TableCell>
                                    <TableCell className="font-medium">{tx.newStock}</TableCell>
                                    <TableCell>
                                        {tx.transactionPrice !== undefined ? `${tx.transactionPrice.toFixed(2)}` : 'N/A'}
                                    </TableCell>
                                    <TableCell>{tx.invoiceId ? <Link href={`/invoices/${tx.invoiceId}`} className="text-primary hover:underline">Invoice #{tx.notes}</Link> : tx.notes}</TableCell>
                                    <TableCell className="text-right">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        This will permanently delete the transaction and reverse the stock change. This action cannot be undone.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteTransaction(tx)} className="bg-destructive hover:bg-destructive/90">
                                                        Confirm Delete
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
                    <p className="text-muted-foreground text-center py-8">No transaction history found for this product.</p>
                )}
            </CardContent>
        </Card>
      </div>

    </div>
  );
}


    

    