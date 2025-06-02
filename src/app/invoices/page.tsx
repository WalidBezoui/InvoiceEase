
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FilePlus, Search, Download, Eye, Loader2, ChevronDown, FilterX } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Invoice } from "@/lib/types";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { format } from "date-fns";
import { useLanguage } from "@/hooks/use-language"; // Import useLanguage
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const ALL_STATUSES: Invoice['status'][] = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];

export default function InvoicesPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, isLoadingLocale } = useLanguage(); // Use language hook
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<Invoice['status']>>(new Set());

  const isLoading = authLoading || isLoadingLocale || isLoadingData;

  useEffect(() => {
    async function fetchInvoices() {
      if (!user) {
        setIsLoadingData(false);
        setAllInvoices([]);
        return;
      }
      setIsLoadingData(true);
      setError(null);
      try {
        const invoicesRef = collection(db, "invoices");
        const q = query(invoicesRef, where("userId", "==", user.uid), orderBy("issueDate", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedInvoices: Invoice[] = [];
        querySnapshot.forEach((doc) => {
          fetchedInvoices.push({ id: doc.id, ...doc.data() } as Invoice);
        });
        setAllInvoices(fetchedInvoices);
      } catch (err) {
        console.error("Error fetching invoices:", err);
        setError(t('invoicesPage.error'));
      } finally {
        setIsLoadingData(false);
      }
    }
    
    if (user) {
        fetchInvoices();
    } else if (!authLoading && !user) { // Auth is done, and there's no user
        setIsLoadingData(false); 
        setAllInvoices([]); 
        setError(null);
    }
  }, [user, authLoading, t]);

  const handleStatusToggle = (status: Invoice['status']) => {
    setSelectedStatuses(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(status)) {
        newSelected.delete(status);
      } else {
        newSelected.add(status);
      }
      return newSelected;
    });
  };
  
  const handleClearStatusFilters = () => {
    setSelectedStatuses(new Set());
  };

  const filteredInvoices = useMemo(() => {
    let invoicesToDisplay = [...allInvoices];
    const lowerSearchTerm = searchTerm.toLowerCase();

    if (searchTerm) {
      invoicesToDisplay = invoicesToDisplay.filter(invoice =>
        invoice.invoiceNumber.toLowerCase().includes(lowerSearchTerm) ||
        invoice.clientName.toLowerCase().includes(lowerSearchTerm)
      );
    }

    if (selectedStatuses.size > 0) {
      invoicesToDisplay = invoicesToDisplay.filter(invoice => selectedStatuses.has(invoice.status));
    }

    return invoicesToDisplay;
  }, [allInvoices, searchTerm, selectedStatuses]);

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

  const exportToCsv = () => {
    if (filteredInvoices.length === 0) {
      alert(t('invoicesPage.exportNoData'));
      return;
    }
    const filename = `invoices_export_${new Date().toISOString().slice(0,10)}.csv`;
    const headers = [
        t('invoicesPage.table.invoiceNo'), 
        t('invoicesPage.table.client'), 
        t('invoicesPage.table.issueDate'), 
        t('invoicesPage.table.dueDate'), 
        t('invoicesPage.table.amount'), 
        t('invoicesPage.table.currency'), 
        t('invoicesPage.table.status')
    ];
    const rows = filteredInvoices.map(inv => [
      inv.invoiceNumber,
      inv.clientName,
      format(new Date(inv.issueDate), "yyyy-MM-dd"),
      format(new Date(inv.dueDate), "yyyy-MM-dd"),
      inv.totalAmount.toFixed(2),
      inv.currency,
      inv.status,
    ]);

    const bom = "\uFEFF"; // UTF-8 Byte Order Mark
    const csvData = headers.join(",") + "\n"
      + rows.map(e => e.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const csvContent = "data:text/csv;charset=utf-8," + bom + encodeURIComponent(csvData);
    
    const link = document.createElement("a");
    link.setAttribute("href", csvContent);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{t('invoicesPage.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('invoicesPage.description')}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/invoices/new">
            <FilePlus className="mr-2 h-5 w-5" /> {t('invoicesPage.createNewInvoice')}
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-xl text-primary">{t('invoicesPage.yourInvoicesCard.title')}</CardTitle>
              <CardDescription>{t('invoicesPage.yourInvoicesCard.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder={t('invoicesPage.yourInvoicesCard.searchPlaceholder')}
                  className="pl-8 sm:w-[250px] md:w-[300px]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    {selectedStatuses.size > 0 
                      ? t('invoicesPage.yourInvoicesCard.filterStatusTrigger', { count: selectedStatuses.size })
                      : t('invoicesPage.yourInvoicesCard.filterStatusAll')
                    } <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{t('invoicesPage.yourInvoicesCard.filterStatusLabel')}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_STATUSES.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status}
                      checked={selectedStatuses.has(status)}
                      onCheckedChange={() => handleStatusToggle(status)}
                      onSelect={(e) => e.preventDefault()} 
                      className="capitalize"
                    >
                      {t(`invoiceStatus.${status}`, { default: status })}
                    </DropdownMenuCheckboxItem>
                  ))}
                  {selectedStatuses.size > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleClearStatusFilters} className="text-sm">
                        <FilterX className="mr-2 h-4 w-4" /> {t('invoicesPage.yourInvoicesCard.clearAllFilters')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" onClick={exportToCsv}>
                <Download className="mr-2 h-4 w-4" /> {t('invoicesPage.yourInvoicesCard.export')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData && !allInvoices.length && !error && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
               <p className="ml-2 text-muted-foreground">{t('invoicesPage.loading')}</p>
            </div>
          )}
          {!isLoadingData && error && (
            <div className="text-center py-12 text-destructive">
              <p>{error}</p>
            </div>
          )}
          {!isLoadingData && !error && filteredInvoices.length > 0 && (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoicesPage.table.invoiceNo')}</TableHead>
                  <TableHead>{t('invoicesPage.table.client')}</TableHead>
                  <TableHead>{t('invoicesPage.table.issueDate')}</TableHead>
                  <TableHead>{t('invoicesPage.table.dueDate')}</TableHead>
                  <TableHead className="text-right">{t('invoicesPage.table.amount')}</TableHead>
                  <TableHead>{t('invoicesPage.table.status')}</TableHead>
                  <TableHead className="text-right">{t('invoicesPage.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{format(new Date(invoice.issueDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell>{format(new Date(invoice.dueDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right">{invoice.currency} {invoice.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">{t(`invoiceStatus.${invoice.status}`, { default: invoice.status })}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/invoices/${invoice.id}`}>
                          <Eye className="mr-1 h-4 w-4" /> {t('invoicesPage.viewAction')}
                        </Link> 
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoadingData && !error && filteredInvoices.length === 0 && (
            <div className="text-center py-12">
              <FilePlus className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-primary">
                {allInvoices.length > 0 && (searchTerm || selectedStatuses.size > 0) 
                    ? t('invoicesPage.noInvoicesMatchCriteria') 
                    : t('invoicesPage.noInvoicesYet')
                }
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {allInvoices.length > 0 && (searchTerm || selectedStatuses.size > 0) 
                  ? t('invoicesPage.noInvoicesMatchCriteriaDesc') 
                  : t('invoicesPage.noInvoicesYetDesc')
                }
              </p>
              {!(allInvoices.length > 0 && (searchTerm || selectedStatuses.size > 0)) && (
                <Button className="mt-6" asChild>
                  <Link href="/invoices/new">{t('invoicesPage.createInvoice')}</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    

    