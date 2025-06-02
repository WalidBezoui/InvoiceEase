
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { User, Search, Loader2, Users, Download, Eye, Edit } from "lucide-react"; 
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Client } from "@/lib/types";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/hooks/use-language"; // Import useLanguage

export default function ClientsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t, isLoadingLocale } = useLanguage(); // Use language hook
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const isLoading = authLoading || isLoadingLocale || isLoadingData;

  useEffect(() => {
    async function fetchClients() {
      if (!user) { // Should already be handled by the conditional call below, but good for safety
        setIsLoadingData(false);
        setAllClients([]); // Clear data if no user
        return;
      }
      setIsLoadingData(true);
      setError(null);
      try {
        const clientsRef = collection(db, "clients");
        const q = query(clientsRef, where("userId", "==", user.uid), orderBy("name", "asc"));
        const querySnapshot = await getDocs(q);
        const fetchedClients: Client[] = [];
        querySnapshot.forEach((doc) => {
          fetchedClients.push({ id: doc.id, ...doc.data() } as Client);
        });
        setAllClients(fetchedClients);
      } catch (err) {
        console.error("Error fetching clients:", err);
        setError(t('clientsPage.error'));
      } finally {
        setIsLoadingData(false);
      }
    }

    if (user) { // Fetch data if user is available
      fetchClients();
    } else if (!authLoading && !user) { // Auth is done, and there's no user
      setIsLoadingData(false); // Ensure loading stops
      setAllClients([]); // Clear any stale client data
      setError(null); // Clear any previous errors
    }
    // The dependencies are user and authLoading.
    // isLoadingLocale and t are handled by the main isLoading guard for the component's render.
  }, [user, authLoading, t]); // Keep t here for error message translation if fetchClients fails

  const filteredClients = useMemo(() => {
    if (!searchTerm) {
      return allClients;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    return allClients.filter(client =>
      client.name.toLowerCase().includes(lowerSearchTerm) ||
      (client.clientCompany && client.clientCompany.toLowerCase().includes(lowerSearchTerm)) ||
      (client.email && client.email.toLowerCase().includes(lowerSearchTerm)) ||
      (client.ice && client.ice.toLowerCase().includes(lowerSearchTerm))
    );
  }, [allClients, searchTerm]);

  const exportToCsv = () => {
    if (filteredClients.length === 0) {
      alert(t('invoicesPage.exportNoData')); 
      return;
    }
    const filename = `clients_export_${new Date().toISOString().slice(0,10)}.csv`;
    const headers = [
        t('clientsPage.table.name'), 
        t('clientsPage.table.company'), 
        t('clientsPage.table.email'), 
        t('clientForm.labels.phone'), 
        t('clientForm.labels.address'),
        t('clientsPage.table.clientICE')
    ];
    
    const rows = filteredClients.map(client => {
      const phoneValue = client.phone || "";
      const iceValue = client.ice || "";
      return [
        client.name,
        client.clientCompany || "",
        client.email || "",
        phoneValue ? `="${phoneValue}"` : "", 
        (client.address || "").replace(/\n/g, " "), 
        iceValue ? `="${iceValue}"` : "",     
      ];
    });

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
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{t('clientsPage.title')}</h1>
          <p className="text-muted-foreground mt-1">{t('clientsPage.description')}</p>
        </div>
        <Button asChild size="lg">
          <Link href="/clients/new">
            <User className="mr-2 h-5 w-5" /> {t('clientsPage.addNewClient')}
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-xl text-primary">{t('clientsPage.yourClientsCard.title')}</CardTitle>
              <CardDescription>{t('clientsPage.yourClientsCard.description')}</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder={t('clientsPage.yourClientsCard.searchPlaceholder')} 
                  className="pl-8 sm:w-[250px] md:w-[300px]" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={exportToCsv}>
                <Download className="mr-2 h-4 w-4" /> {t('clientsPage.yourClientsCard.export')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingData && !allClients.length && !error && ( 
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">{t('clientsPage.loading')}</p>
            </div>
          )}
          {!isLoadingData && error && (
            <div className="text-center py-12 text-destructive">
              <p>{error}</p>
            </div>
          )}
          {!isLoadingData && !error && filteredClients.length > 0 && (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('clientsPage.table.name')}</TableHead>
                  <TableHead>{t('clientsPage.table.company')}</TableHead>
                  <TableHead>{t('clientsPage.table.email')}</TableHead>
                  <TableHead>{t('clientsPage.table.clientICE')}</TableHead>
                  <TableHead className="text-right">{t('clientsPage.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.clientCompany || "N/A"}</TableCell>
                    <TableCell>{client.email || "N/A"}</TableCell>
                    <TableCell>{client.ice || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/clients/${client.id}`}>
                             <Eye className="mr-1 h-4 w-4" /> {t('clientsPage.actions.view')}
                          </Link> 
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/clients/${client.id}/edit`}>
                            <Edit className="mr-1 h-4 w-4" /> {t('clientsPage.actions.edit')}
                          </Link> 
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoadingData && !error && filteredClients.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-primary">
                {allClients.length > 0 && searchTerm ? t('clientsPage.noClientsMatchSearch') : t('clientsPage.noClientsYet')}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {allClients.length > 0 && searchTerm 
                  ? t('clientsPage.noClientsMatchSearchDesc') 
                  : t('clientsPage.noClientsYetDesc')
                }
              </p>
              {!(allClients.length > 0 && searchTerm) && (
                 <Button className="mt-6" asChild>
                  <Link href="/clients/new">{t('clientsPage.addClient')}</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
