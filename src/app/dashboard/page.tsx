
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FilePlus, Eye, BarChart3, Settings, Loader2, Users, ListChecks, Package, AlertTriangle, Lightbulb, Info } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Invoice, Product, ProductTipOutput } from "@/lib/types";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";
import { getProductTip } from "@/ai/flows/product-analysis-flow";
import { cn } from "@/lib/utils";

interface DashboardStats {
  totalRevenue: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesAmount: number;
  draftInvoicesCount: number;
  totalClients: number;
  totalProducts: number;
  totalStockValue: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, locale, isLoadingLocale } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [productsToWatch, setProductsToWatch] = useState<Product[]>([]);
  const [tips, setTips] = useState<Record<string, ProductTipOutput>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);

  const isLoading = authLoading || isLoadingLocale || isLoadingData;

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) {
        setIsLoadingData(false);
        return;
      }
      setIsLoadingData(true);
      try {
        // Fetch invoices, clients, and products in parallel
        const [invoiceSnapshot, clientSnapshot, productSnapshot] = await Promise.all([
          getDocs(query(collection(db, "invoices"), where("userId", "==", user.uid))),
          getDocs(query(collection(db, "clients"), where("userId", "==", user.uid))),
          getDocs(query(collection(db, "products"), where("userId", "==", user.uid)))
        ]);

        // Process Invoices
        let totalRevenue = 0;
        let outstandingInvoicesCount = 0;
        let outstandingInvoicesAmount = 0;
        let draftInvoicesCount = 0;
        const allInvoices: Invoice[] = [];

        invoiceSnapshot.forEach((doc) => {
          const invoice = { id: doc.id, ...doc.data() } as Invoice;
          allInvoices.push(invoice);
          if (invoice.status === 'paid') totalRevenue += invoice.totalAmount;
          if (invoice.status === 'sent' || invoice.status === 'overdue') {
            outstandingInvoicesCount++;
            outstandingInvoicesAmount += invoice.totalAmount;
          }
          if (invoice.status === 'draft') draftInvoicesCount++;
        });
        
        allInvoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
        setRecentInvoices(allInvoices.slice(0, 5));

        // Process Clients
        const totalClients = clientSnapshot.size;

        // Process Products
        const allProducts: Product[] = [];
        let totalStockValue = 0;
        productSnapshot.forEach((doc) => {
          const product = { id: doc.id, ...doc.data() } as Product;
          allProducts.push(product);
          totalStockValue += (product.stock || 0) * (product.purchasePrice || 0);
        });
        const totalProducts = allProducts.length;
        
        // Fetch tips for products and identify which ones to watch
        const tipPromises = allProducts.map(async (product) => {
          const transactionsQuery = query(
            collection(db, "productTransactions"),
            where("productId", "==", product.id!),
            orderBy("transactionDate", "desc"),
            limit(50)
          );
          const transSnap = await getDocs(transactionsQuery);
          const transactionSummary = transSnap.docs.map(d => {
              const data = d.data();
              return {
                  type: data.type,
                  quantityChange: data.quantityChange,
                  transactionDate: data.transactionDate.toDate().toISOString(),
                  transactionPrice: data.transactionPrice
              }
          });
          const tip = await getProductTip({
            stockLevel: product.stock ?? 0,
            transactions: transactionSummary,
            language: locale
          }).catch(() => ({ tip: 'N/A', type: 'info' }));
          return { productId: product.id!, tip, product };
        });

        const tipResults = await Promise.all(tipPromises);
        const productsWithWarning = tipResults
          .filter(r => r.tip.type === 'warning')
          .map(r => r.product);
        
        const newTips: Record<string, ProductTipOutput> = {};
        tipResults.forEach(r => newTips[r.productId] = r.tip);
        
        setTips(newTips);
        setProductsToWatch(productsWithWarning.slice(0, 5));

        setStats({ totalRevenue, outstandingInvoicesCount, outstandingInvoicesAmount, draftInvoicesCount, totalClients, totalProducts, totalStockValue });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setStats({ totalRevenue: 0, outstandingInvoicesCount: 0, outstandingInvoicesAmount: 0, draftInvoicesCount: 0, totalClients: 0, totalProducts: 0, totalStockValue: 0 });
      } finally {
        setIsLoadingData(false);
      }
    }
    if (user && !isLoadingLocale) {
        fetchDashboardData();
    }
  }, [user, locale, isLoadingLocale]);

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "paid": return "default";
      case "sent": return "secondary";
      case "overdue": return "destructive";
      case "draft": return "outline";
      case "cancelled": return "destructive";
      default: return "outline";
    }
  };
  
  const getTipIcon = (type?: ProductTipOutput['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'suggestion': return <Lightbulb className="h-4 w-4 text-blue-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-72 mb-2" />
              <Skeleton className="h-5 w-96" />
            </>
          ) : (
            <>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
              {t('dashboardPage.welcome', { name: user?.displayName || 'User' })}
            </h1>
            <p className="text-muted-foreground mt-1">
              {t('dashboardPage.overview')}
            </p>
            </>
          )}
        </div>
        {isLoading ? (
          <Skeleton className="h-12 w-48" />
        ) : (
          <Button asChild size="lg">
            <Link href="/invoices/new">
              <FilePlus className="mr-2 h-5 w-5" /> {t('dashboardPage.createNewInvoice')}
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-1/2" /> <Skeleton className="h-5 w-5 rounded-full" />
              </CardHeader>
              <CardContent><Skeleton className="h-8 w-3/4 mt-1" /><Skeleton className="h-3 w-1/2 mt-2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboardPage.totalRevenue')}</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">MAD {stats?.totalRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboardPage.basedOnPaidInvoices')}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboardPage.outstanding')}</CardTitle>
            <ListChecks className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.outstandingInvoicesCount || 0} {t('dashboardPage.invoices')}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboardPage.totaling')} MAD {stats?.outstandingInvoicesAmount.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboardPage.draftInvoices')}</CardTitle>
            <FilePlus className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.draftInvoicesCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboardPage.invoicesPendingCompletion')}
            </p>
          </CardContent>
        </Card>
         <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboardPage.totalClients')}</CardTitle>
            <Users className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboardPage.managedClients')}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboardPage.totalProducts')}</CardTitle>
            <Package className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.totalProducts || 0}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboardPage.productInventoryDesc')}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('dashboardPage.totalStockValue')}</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">MAD {stats?.totalStockValue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboardPage.stockValueDesc')}
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('dashboardPage.recentInvoices')}</CardTitle>
            <CardDescription>{t('dashboardPage.recentInvoicesDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                    <TableHead className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(3)].map((_, i) => (
                    <TableRow key={`skeleton-${i}`}>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : recentInvoices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboardPage.invoiceTable.invoiceNo')}</TableHead>
                    <TableHead>{t('dashboardPage.invoiceTable.client')}</TableHead>
                    <TableHead className="text-right">{t('dashboardPage.invoiceTable.amount')}</TableHead>
                    <TableHead>{t('dashboardPage.invoiceTable.status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link href={`/invoices/${invoice.id}`} className="hover:underline text-primary">
                          {invoice.invoiceNumber}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.clientName}</TableCell>
                      <TableCell className="text-right">{invoice.currency} {invoice.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">{t(`invoiceStatus.${invoice.status}`)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('dashboardPage.noRecentInvoiceActivity')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('dashboardPage.createInvoiceToStart')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('dashboardPage.productsToWatchTitle')}</CardTitle>
            <CardDescription>{t('dashboardPage.productsToWatchDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Skeleton className="h-4 w-32" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(3)].map((_, i) => (
                    <TableRow key={`prod-skeleton-${i}`}>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-full" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : productsToWatch.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('dashboardPage.productTable.partName')}</TableHead>
                    <TableHead>{t('dashboardPage.productTable.stock')}</TableHead>
                    <TableHead>{t('dashboardPage.productTable.healthTip')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productsToWatch.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        <Link href={`/products/${product.id}`} className="hover:underline text-primary">
                          {product.name}
                        </Link>
                      </TableCell>
                      <TableCell>{product.stock}</TableCell>
                      <TableCell>
                          <div className="flex items-center gap-2">
                             {getTipIcon(tips[product.id!]?.type)}
                             <span className="text-xs">{tips[product.id!]?.tip}</span>
                          </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">{t('dashboardPage.noProductsToWatch')}</p>
                <p className="text-sm text-muted-foreground mt-1">{t('dashboardPage.productsLookingGood')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

    
    