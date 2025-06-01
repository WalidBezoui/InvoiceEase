
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { db } from "@/lib/firebase";
import type { Client } from "@/lib/types";
import { doc, getDoc } from "firebase/firestore";
import ClientForm from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditClientPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clientId = params.id as string;

  const [client, setClient] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchClient() {
      if (!user || !clientId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const clientRef = doc(db, "clients", clientId);
        const docSnap = await getDoc(clientRef);

        if (docSnap.exists()) {
          const fetchedClient = { id: docSnap.id, ...docSnap.data() } as Client;
          if (fetchedClient.userId === user.uid) {
            setClient(fetchedClient);
          } else {
            setError("You do not have permission to edit this client.");
            setClient(null); 
          }
        } else {
          setError("Client not found.");
          setClient(null);
        }
      } catch (err) {
        console.error("Error fetching client for editing:", err);
        setError("Failed to load client details. Please try again.");
        setClient(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchClient();
  }, [user, clientId]);

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <Skeleton className="h-[400px] w-full rounded-md" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold text-destructive mb-2">Error Loading Client</h2>
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
        <p className="text-muted-foreground mb-6">The client you are trying to edit does not exist or could not be loaded.</p>
        <Button onClick={() => router.push("/clients")}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Clients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Clients</span>
          </Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Edit Client: {client.name}</h1>
          <p className="text-muted-foreground mt-1">Update the details for this client.</p>
        </div>
      </div>
      
      <ClientForm initialData={client} />
    </div>
  );
}
