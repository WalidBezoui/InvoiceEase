
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FilePlus, Eye, BarChart3, Settings, Loader2, Users, ListChecks } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import type { Invoice } from "@/lib/types";
import { collection, query, where, getDocs, orderBy, limit as firestoreLimit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface DashboardStats {
  totalRevenue: number;
  outstandingInvoicesCount: number;
  outstandingInvoicesAmount: number;
  draftInvoicesCount: number;
  totalClients: number; // Added for client count
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
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
        
        // Sort for recent invoices (desc by issueDate) and take top 5
        fetchedRecentInvoices.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
        setRecentInvoices(fetchedRecentInvoices.slice(0, 5));

        // Fetch client count
        const clientsRef = collection(db, "clients");
        const clientsQuery = query(clientsRef, where("userId", "==", user.uid));
        const clientsSnapshot = await getDocs(clientsQuery);
        const totalClients = clientsSnapshot.size;

        setStats({ totalRevenue, outstandingInvoicesCount, outstandingInvoicesAmount, draftInvoicesCount, totalClients });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
        // Set stats to zero or show error
        setStats({ totalRevenue: 0, outstandingInvoicesCount: 0, outstandingInvoicesAmount: 0, draftInvoicesCount: 0, totalClients: 0 });
      } finally {
        setIsLoading(false);
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
      default: return "outline";
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
            Welcome, {user?.displayName || 'User'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s an overview of your business activity.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/invoices/new">
            <FilePlus className="mr-2 h-5 w-5" /> Create New Invoice
          </Link>
        </Button>
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
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">MAD {stats?.totalRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              (Based on paid invoices)
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding</CardTitle>
            <ListChecks className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.outstandingInvoicesCount || 0} invoices</div>
            <p className="text-xs text-muted-foreground">
              Totaling MAD {stats?.outstandingInvoicesAmount.toFixed(2) || '0.00'}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Invoices</CardTitle>
            <FilePlus className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.draftInvoicesCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              Invoices pending completion
            </p>
          </CardContent>
        </Card>
         <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats?.totalClients || 0}</div>
            <p className="text-xs text-muted-foreground">
              Managed clients
            </p>
          </CardContent>
        </Card>
      </div>
      )}

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">Recent Invoices</CardTitle>
          <CardDescription>A log of your most recent invoices.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
             <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading recent activity...</p>
            </div>
          )}
          {!isLoading && recentInvoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
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
          ) : !isLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No recent invoice activity to display.</p>
              <p className="text-sm text-muted-foreground mt-1">Create an invoice to get started!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
