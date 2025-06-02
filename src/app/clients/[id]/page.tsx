
"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Client, Invoice } from "@/lib/types";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Loader2, AlertTriangle, Edit, Eye, BarChart3, PieChart as PieChartIcon, ListChecks, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, PieChart, Pie, Cell, Legend as RechartsLegend, ResponsiveContainer } from "recharts";
import { useLanguage } from "@/hooks/use-language";

interface MonthlyTotal {
  month: string;
  total: number;
}

interface StatusDistribution {
  name: string;
  value: number;
  fill: string;
}

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function ClientDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, isLoadingLocale } = useLanguage();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalInvoiced, setTotalInvoiced] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);

  const isLoading = authLoading || isLoadingLocale || isLoadingData;


  useEffect(() => {
    async function fetchClientData() {
      // This function is now called when user or clientId changes,
      // independent of isLoadingLocale.
      if (!user || !clientId) {
        setIsLoadingData(false); // Ensure loading stops if prerequisites aren't met
        setClient(null);
        setInvoices([]);
        return;
      }

      setIsLoadingData(true);
      setError(null);
      try {
        // Fetch client details
        const clientRef = doc(db, "clients", clientId);
        const clientSnap = await getDoc(clientRef);

        if (clientSnap.exists() && clientSnap.data().userId === user.uid) {
          setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
        } else {
          setError(t('clientDetailPage.errorPermissionMessage'));
          setIsLoadingData(false);
          return;
        }

        // Fetch client invoices
        const invoicesRef = collection(db, "invoices");
        const q = query(
          invoicesRef,
          where("userId", "==", user.uid),
          where("clientId", "==", clientId),
          orderBy("issueDate", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetchedInvoices: Invoice[] = [];
        querySnapshot.forEach((doc) => {
          fetchedInvoices.push({ id: doc.id, ...doc.data() } as Invoice);
        });
        setInvoices(fetchedInvoices);

        // Calculate stats
        let invoiced = 0;
        let paid = 0;
        let outstanding = 0;
        const statuses: { [key: string]: number } = { Draft: 0, Sent: 0, Paid: 0, Overdue: 0, Cancelled: 0 };
        const monthlyData: { [key: string]: number } = {};

        fetchedInvoices.forEach(inv => {
          invoiced += inv.totalAmount;
          if (inv.status === 'paid') {
            paid += inv.totalAmount;
          }
          if (inv.status === 'sent' || inv.status === 'overdue') {
            outstanding += inv.totalAmount;
          }
          const statusKey = inv.status.charAt(0).toUpperCase() + inv.status.slice(1);
          statuses[statusKey] = (statuses[statusKey] || 0) + 1;

          // Ensure inv.issueDate is valid before parsing
          try {
            const monthYear = format(parseISO(inv.issueDate), "MMM yyyy");
            monthlyData[monthYear] = (monthlyData[monthYear] || 0) + inv.totalAmount;
          } catch (e) {
            console.warn(`Invalid issueDate encountered for invoice ID ${inv.id}: ${inv.issueDate}`);
          }
        });

        setTotalInvoiced(invoiced);
        setTotalPaid(paid);
        setTotalOutstanding(outstanding);

        setStatusDistribution(
          Object.entries(statuses)
            .map(([name, value], index) => ({ name, value, fill: CHART_COLORS[index % CHART_COLORS.length] }))
            .filter(s => s.value > 0)
        );
        
        const sortedMonthlyTotals = Object.entries(monthlyData)
          .map(([month, total]) => ({ month, total }))
          .sort((a,b) => {
            try {
              // Ensure month strings are valid before creating Date objects
              return new Date(a.month).getTime() - new Date(b.month).getTime();
            } catch (e) {
              console.warn(`Invalid month string for sorting: ${a.month} or ${b.month}`);
              return 0; // Keep original order if parsing fails
            }
          });
        setMonthlyTotals(sortedMonthlyTotals);

      } catch (err) {
        console.error("Error fetching client data:", err);
        setError(t('clientDetailPage.errorFailedLoadMessage')); // t() will be available on re-render
      } finally {
        setIsLoadingData(false);
      }
    }

    // Call fetchClientData if user and clientId are available.
    // The overall isLoading flag will handle cases where translations are not yet ready.
    if (user && clientId) {
        fetchClientData();
    } else if (!authLoading && !user) { // Handle case where auth is done but no user
        setIsLoadingData(false);
        setClient(null);
        setInvoices([]);
    }
  }, [user, clientId, authLoading, t]); // `t` is included here because it's used in error messages within the effect. 
                                    // It's less critical than before when it controlled the effect's execution.

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
  
  const chartConfig = useMemo(() => ({
    Draft: { label: t('invoiceStatus.draft', { default: "Draft"}), color: "hsl(var(--chart-1))" },
    Sent: { label: t('invoiceStatus.sent', { default: "Sent"}), color: "hsl(var(--chart-2))" },
    Paid: { label: t('invoiceStatus.paid', { default: "Paid"}), color: "hsl(var(--chart-3))" },
    Overdue: { label: t('invoiceStatus.overdue', { default: "Overdue"}), color: "hsl(var(--chart-4))" },
    Cancelled: { label: t('invoiceStatus.cancelled', { default: "Cancelled"}), color: "hsl(var(--chart-5))" },
    // For the bar chart
    total: { label: t('clientDetailPage.charts.barLabelTotal', { default: "Total Amount" }), color: "hsl(var(--chart-1))" },
  }), [t]);


  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-8 w-64" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
        <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
         <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent><Skeleton className="h-64 w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent><Skeleton className="h-48 w-full" /></CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">{t('clientDetailPage.errorLoadingDataTitle')}</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/clients")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('clientDetailPage.backToClients')}
        </Button>
      </div>
    );
  }

  if (!client) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">{t('clientDetailPage.clientNotFoundTitle')}</h2>
        <p className="text-muted-foreground mb-6">{t('clientDetailPage.clientNotFoundMessage')}</p>
        <Button onClick={() => router.push("/clients")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> {t('clientDetailPage.backToClients')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/clients">
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">{t('clientDetailPage.backToClients')}</span>
            </Link>
          </Button>
          <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{client.name}</h1>
            <p className="text-muted-foreground mt-1">{client.clientCompany || client.email || `${t('clientDetailPage.labels.clientId', { default: "Client ID" })}: ${client.id}`}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/clients/${client.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> {t('clientDetailPage.editClient')}
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">{t('clientDetailPage.clientDetailsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div><strong className="text-primary">{t('clientDetailPage.labels.name')}</strong> {client.name}</div>
          {client.clientCompany && <div><strong className="text-primary">{t('clientDetailPage.labels.company')}</strong> {client.clientCompany}</div>}
          {client.email && <div><strong className="text-primary">{t('clientDetailPage.labels.email')}</strong> {client.email}</div>}
          {client.phone && <div><strong className="text-primary">{t('clientDetailPage.labels.phone')}</strong> {client.phone}</div>}
          {client.ice && <div><strong className="text-primary">{t('clientDetailPage.labels.ice')}</strong> {client.ice}</div>}
          {client.address && <div className="md:col-span-2"><strong className="text-primary">{t('clientDetailPage.labels.address')}</strong> <span className="whitespace-pre-wrap">{client.address}</span></div>}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('clientDetailPage.stats.totalInvoices')}</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('clientDetailPage.stats.totalInvoiced')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.currency || invoices[0]?.currency || 'MAD'} {totalInvoiced.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('clientDetailPage.stats.totalPaid')}</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">{client.currency || invoices[0]?.currency || 'MAD'} {totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('clientDetailPage.stats.totalOutstanding')}</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.currency || invoices[0]?.currency || 'MAD'} {totalOutstanding.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('clientDetailPage.charts.statusOverviewTitle')}</CardTitle>
            <CardDescription>{t('clientDetailPage.charts.statusOverviewDesc', {clientName: client.name})}</CardDescription>
          </CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" labelLine={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {statusDistribution.map((entry) => (
                      <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">{t('clientDetailPage.charts.noStatusData')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('clientDetailPage.charts.monthlyTotalsTitle')}</CardTitle>
             <CardDescription>{t('clientDetailPage.charts.monthlyTotalsDesc', {clientName: client.name})}</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyTotals.length > 0 ? (
              <ChartContainer config={chartConfig} className="aspect-[16/9] max-h-[300px]">
                <BarChart data={monthlyTotals} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis tickLine={false} tickMargin={10} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="total" fill="var(--color-total)" radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
               <p className="text-muted-foreground text-center py-8">{t('clientDetailPage.charts.noMonthlyData')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">{t('clientDetailPage.invoiceHistory.title')}</CardTitle>
          <CardDescription>{t('clientDetailPage.invoiceHistory.description', {clientName: client.name})}</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('clientDetailPage.table.invoiceNo')}</TableHead>
                  <TableHead>{t('clientDetailPage.table.issueDate')}</TableHead>
                  <TableHead>{t('clientDetailPage.table.dueDate')}</TableHead>
                  <TableHead className="text-right">{t('clientDetailPage.table.amount')}</TableHead>
                  <TableHead>{t('clientDetailPage.table.status')}</TableHead>
                  <TableHead className="text-right">{t('clientDetailPage.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                        <Link href={`/invoices/${invoice.id}`} className="hover:underline text-primary">
                           {invoice.invoiceNumber}
                        </Link>
                    </TableCell>
                    <TableCell>{format(parseISO(invoice.issueDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{format(parseISO(invoice.dueDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right">{invoice.currency} {invoice.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">{t(`invoiceStatus.${invoice.status}`, { default: invoice.status})}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/invoices/${invoice.id}`}>
                          <Eye className="mr-1 h-4 w-4" /> {t('clientDetailPage.viewAction')}
                        </Link> 
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">{t('clientDetailPage.noInvoicesFound')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

