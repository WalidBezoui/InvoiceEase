
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

export default function ClientsPage() {
  const { user } = useAuth();
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchClients() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
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
        setError("Failed to load clients. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchClients();
  }, [user]);

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
      alert("No data to export.");
      return;
    }
    const filename = `clients_export_${new Date().toISOString().slice(0,10)}.csv`;
    const headers = ["Name", "Company", "Email", "Phone", "Address", "Client ICE"];
    const rows = filteredClients.map(client => [
      client.name,
      client.clientCompany || "",
      client.email || "",
      client.phone || "",
      (client.address || "").replace(/\n/g, " "), 
      client.ice || "",
    ]);

    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n"
      + rows.map(e => e.map(val => `"${(val || '').toString().replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your customer information here.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/clients/new">
            <User className="mr-2 h-5 w-5" /> Add New Client
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-xl text-primary">Your Clients</CardTitle>
              <CardDescription>View and manage your client list.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  type="search" 
                  placeholder="Search clients..." 
                  className="pl-8 sm:w-[250px] md:w-[300px]" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Button variant="outline" onClick={exportToCsv}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading clients...</p>
            </div>
          )}
          {!isLoading && error && (
            <div className="text-center py-12 text-destructive">
              <p>{error}</p>
            </div>
          )}
          {!isLoading && !error && filteredClients.length > 0 && (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Client ICE</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                             <Eye className="mr-1 h-4 w-4" /> View
                          </Link> 
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/clients/${client.id}/edit`}>
                            <Edit className="mr-1 h-4 w-4" /> Edit
                          </Link> 
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && !error && filteredClients.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-primary">
                {allClients.length > 0 && searchTerm ? "No clients match your search" : "No clients yet"}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {allClients.length > 0 && searchTerm 
                  ? "Try adjusting your search term." 
                  : "Add your first client to get started."
                }
              </p>
              {!(allClients.length > 0 && searchTerm) && (
                 <Button className="mt-6" asChild>
                  <Link href="/clients/new">Add Client</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

