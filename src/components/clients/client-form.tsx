
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import type { Client, ClientFormData } from "@/lib/types";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Save } from "lucide-react";

const clientFormSchema = z.object({
  name: z.string().min(2, "Client name must be at least 2 characters."),
  email: z.string().email("Invalid email address.").optional().or(z.literal("")),
  address: z.string().optional(),
  phone: z.string().optional(),
  clientCompany: z.string().optional(),
  ice: z.string()
    .length(15, "ICE must be exactly 15 digits.")
    .regex(/^\d{15}$/, "ICE must consist only of 15 digits.")
    .optional()
    .or(z.literal("")),
});

interface ClientFormProps {
  initialData?: Client;
  onSave?: (clientId: string) => void; 
}

export default function ClientForm({ initialData, onSave }: ClientFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: {
      name: initialData?.name || "",
      email: initialData?.email || "",
      address: initialData?.address || "",
      phone: initialData?.phone || "",
      clientCompany: initialData?.clientCompany || "",
      ice: initialData?.ice || "",
    },
  });

  async function onSubmit(values: ClientFormData) {
    if (!user) {
      toast({ title: "Authentication Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    setIsSaving(true);

    const clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: user.uid,
      name: values.name,
      email: values.email || "",
      address: values.address || "",
      phone: values.phone || "",
      clientCompany: values.clientCompany || "",
      ice: values.ice || "",
    };

    try {
      if (initialData?.id) {
        const clientRef = doc(db, "clients", initialData.id);
        await updateDoc(clientRef, { ...clientData, updatedAt: serverTimestamp() });
        toast({ title: "Client Updated", description: `${values.name} has been updated.` });
        if (onSave) onSave(initialData.id); else router.push("/clients");
      } else {
        const docRef = await addDoc(collection(db, "clients"), {
          ...clientData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        toast({ title: "Client Added", description: `${values.name} has been added.` });
        const redirectUrl = searchParams.get('redirect');
        if (onSave) onSave(docRef.id);
        else if (redirectUrl) router.push(decodeURIComponent(redirectUrl));
        else router.push("/clients");
      }
    } catch (error) {
      console.error("Error saving client:", error);
      toast({ title: "Error Saving Client", description: "Failed to save client. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">
              {initialData ? "Edit Client" : "Add New Client"}
            </CardTitle>
            <CardDescription>
              {initialData ? "Update the client's details below." : "Fill in the details for the new client."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Client Name / Company Name</FormLabel>
                <FormControl><Input placeholder="Acme Corp or John Doe" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="clientCompany" render={({ field }) => (
              <FormItem>
                <FormLabel>Legal Company Name (Optional)</FormLabel>
                <FormControl><Input placeholder="Acme Corp SARL" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="ice" render={({ field }) => (
              <FormItem>
                <FormLabel>ICE (Identifiant Commun de l'Entreprise - 15 digits)</FormLabel>
                <FormControl><Input placeholder="001234567000089" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email (Optional)</FormLabel>
                <FormControl><Input type="email" placeholder="contact@example.com" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone (Optional)</FormLabel>
                <FormControl><Input type="tel" placeholder="+212 600 000000" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="address" render={({ field }) => (
              <FormItem>
                <FormLabel>Address (Optional)</FormLabel>
                <FormControl><Textarea placeholder="123 Main St, Anytown" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {initialData ? "Save Changes" : "Add Client"}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </Form>
  );
}
