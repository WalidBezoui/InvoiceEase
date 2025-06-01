
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FilePlus, User, Search, Loader2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Client } from "@/lib/types";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useEffect, useState } from "react";

export default function ClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setClients(fetchedClients);
      } catch (err) {
        console.error("Error fetching clients:", err);
        setError("Failed to load clients. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
    fetchClients();
  }, [user]);

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
            <div className="relative flex-grow md:flex-grow-0">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input type="search" placeholder="Search clients..." className="pl-8 sm:w-[300px]" />
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
          {!isLoading && !error && clients.length > 0 && (
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
                {clients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>{client.clientCompany || "N/A"}</TableCell>
                    <TableCell>{client.email || "N/A"}</TableCell>
                    <TableCell>{client.ice || "N/A"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/clients/${client.id}/edit`}>Edit</Link> 
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && !error && clients.length === 0 && (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-primary">No clients yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first client to get started.
              </p>
              <Button className="mt-6" asChild>
                <Link href="/clients/new">Add Client</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
