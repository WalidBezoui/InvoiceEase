
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FilePlus, Eye, BarChart3, Settings, Loader2, Users, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/hooks/use-language"; // Import useLanguage
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Invoice } from "@/lib/types";
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardStats {
  totalRevenue: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesAmount: number;
  draftInvoicesCount: number;
  totalClients: number;
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, isLoadingLocale } = useLanguage(); // Use language hook
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
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
        const invoicesRef = collection(db, "invoices");
        const q = query(invoicesRef, where("userId", "==", user.uid));
        const querySnapshot = await getDocs(q);
        
        let totalRevenue = 0;
        let outstandingInvoicesCount = 0;
        let outstandingInvoicesAmount = 0;
        let draftInvoicesCount = 0;
        const fetchedRecentInvoices: Invoice[] = [];

        querySnapshot.forEach((doc) => {
          const invoice = { id: doc.id, ...doc.data() } as Invoice;
          if (invoice.status === 'paid') {
            totalRevenue += invoice.totalAmount;
          }
          if (invoice.status === 'sent' || invoice.status === 'overdue') {
            outstandingInvoicesCount++;
            outstandingInvoicesAmount += invoice.totalAmount;
          }
          if (invoice.status === 'draft') {
            draftInvoicesCount++;
          }
          fetchedRecentInvoices.push(invoice);
        });
        
        fetchedRecentInvoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
        setRecentInvoices(fetchedRecentInvoices.slice(0, 5));

        const clientsRef = collection(db, "clients");
        const clientsQuery = query(clientsRef, where("userId", "==", user.uid));
        const clientsSnapshot = await getDocs(clientsQuery);
        const totalClients = clientsSnapshot.size;

        setStats({ totalRevenue, outstandingInvoicesCount, outstandingInvoicesAmount, draftInvoicesCount, totalClients });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        setStats({ totalRevenue: 0, outstandingInvoicesCount: 0, outstandingInvoicesAmount: 0, draftInvoicesCount: 0, totalClients: 0 });
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchDashboardData();
  }, [user]);

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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="shadow-lg">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-1/2" /> <Skeleton className="h-5 w-5 rounded-full" />
              </CardHeader>
              <CardContent><Skeleton className="h-8 w-3/4 mt-1" /><Skeleton className="h-3 w-1/2 mt-2" /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
            <div className="text-2xl font-bold text-primary">{stats?.outstandingInvoicesCount || 0} invoices</div>
            <p className="text-xs text-muted-foreground">
              {t('dashboardPage.totaling', { amount: stats?.outstandingInvoicesAmount.toFixed(2) || '0.00' })}
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
      </div>
      )}

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
                  <TableHead><Skeleton className="h-4 w-24" /></TableHead>
                  <TableHead className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableHead>
                  <TableHead><Skeleton className="h-4 w-16" /></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(3)].map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell><Skeleton className="h-4 w-full" /></TableCell>
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
                  <TableHead>{t('dashboardPage.tableHeader.invoiceNumber')}</TableHead>
                  <TableHead>{t('dashboardPage.tableHeader.client')}</TableHead>
                  <TableHead>{t('dashboardPage.tableHeader.issueDate')}</TableHead>
                  <TableHead className="text-right">{t('dashboardPage.tableHeader.amount')}</TableHead>
                  <TableHead>{t('dashboardPage.tableHeader.status')}</TableHead>
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
                    <TableCell>{format(new Date(invoice.issueDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right">{invoice.currency} {invoice.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">{invoice.status}</Badge>
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
    </div>
  );
}
