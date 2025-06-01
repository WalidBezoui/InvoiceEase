
"use client";

import ClientForm from "@/components/clients/client-form";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewClientPage() {
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
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Add New Client</h1>
          <p className="text-muted-foreground mt-1">Enter the details for your new client.</p>
        </div>
      </div>
      
      <ClientForm />
    </div>
  );
}
