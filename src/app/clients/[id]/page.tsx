
"use client";

import { useEffect, useState } from "react";
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
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [totalInvoiced, setTotalInvoiced] = useState(0);
  const [totalPaid, setTotalPaid] = useState(0);
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [monthlyTotals, setMonthlyTotals] = useState<MonthlyTotal[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<StatusDistribution[]>([]);


  useEffect(() => {
    async function fetchClientData() {
      if (!user || !clientId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        // Fetch client details
        const clientRef = doc(db, "clients", clientId);
        const clientSnap = await getDoc(clientRef);

        if (clientSnap.exists() && clientSnap.data().userId === user.uid) {
          setClient({ id: clientSnap.id, ...clientSnap.data() } as Client);
        } else {
          setError("Client not found or you do not have permission to view this client.");
          setIsLoading(false);
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

          const monthYear = format(parseISO(inv.issueDate), "MMM yyyy");
          monthlyData[monthYear] = (monthlyData[monthYear] || 0) + inv.totalAmount;
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
          .sort((a,b) => new Date(a.month).getTime() - new Date(b.month).getTime()); // Ensure chronological order for bar chart
        setMonthlyTotals(sortedMonthlyTotals);

      } catch (err) {
        console.error("Error fetching client data:", err);
        setError("Failed to load client details and invoices. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchClientData();
  }, [user, clientId]);

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
  
  const chartConfig = {
    total: { label: "Total Amount", color: "hsl(var(--chart-1))" },
    Draft: { label: "Draft", color: "hsl(var(--chart-1))" },
    Sent: { label: "Sent", color: "hsl(var(--chart-2))" },
    Paid: { label: "Paid", color: "hsl(var(--chart-3))" },
    Overdue: { label: "Overdue", color: "hsl(var(--chart-4))" },
    Cancelled: { label: "Cancelled", color: "hsl(var(--chart-5))" },
  } satisfies Record<string, { label: string; color: string }>;


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
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Client Data</h2>
        <p className="text-muted-foreground mb-6">{error}</p>
        <Button onClick={() => router.push("/clients")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Clients
        </Button>
      </div>
    );
  }

  if (!client) {
     return (
       <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-primary mb-2">Client Not Found</h2>
        <p className="text-muted-foreground mb-6">The client details could not be loaded.</p>
        <Button onClick={() => router.push("/clients")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Clients
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
              <span className="sr-only">Back to Clients</span>
            </Link>
          </Button>
          <div>
            <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{client.name}</h1>
            <p className="text-muted-foreground mt-1">{client.clientCompany || client.email || `Client ID: ${client.id}`}</p>
          </div>
        </div>
        <Button asChild>
          <Link href={`/clients/${client.id}/edit`}>
            <Edit className="mr-2 h-4 w-4" /> Edit Client
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">Client Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <div><strong className="text-primary">Name:</strong> {client.name}</div>
          {client.clientCompany && <div><strong className="text-primary">Company:</strong> {client.clientCompany}</div>}
          {client.email && <div><strong className="text-primary">Email:</strong> {client.email}</div>}
          {client.phone && <div><strong className="text-primary">Phone:</strong> {client.phone}</div>}
          {client.ice && <div><strong className="text-primary">ICE:</strong> {client.ice}</div>}
          {client.address && <div className="md:col-span-2"><strong className="text-primary">Address:</strong> <span className="whitespace-pre-wrap">{client.address}</span></div>}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <ListChecks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoiced</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{client.currency || invoices[0]?.currency || 'MAD'} {totalInvoiced.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
             <div className="text-2xl font-bold">{client.currency || invoices[0]?.currency || 'MAD'} {totalPaid.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
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
            <CardTitle className="font-headline text-xl text-primary">Invoice Status Overview</CardTitle>
            <CardDescription>Distribution of invoice statuses for {client.name}.</CardDescription>
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
              <p className="text-muted-foreground text-center py-8">No invoice data to display status distribution.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">Monthly Invoice Totals</CardTitle>
             <CardDescription>Total invoiced amount per month for {client.name}.</CardDescription>
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
               <p className="text-muted-foreground text-center py-8">No invoice data to display monthly totals.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">Invoice History</CardTitle>
          <CardDescription>All invoices associated with {client.name}.</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                      <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/invoices/${invoice.id}`}>
                          <Eye className="mr-1 h-4 w-4" /> View
                        </Link> 
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-8">No invoices found for this client.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

