"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { FilePlus, Search, Filter, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Mock data for demonstration
const mockInvoices = [
  { id: "INV-001", clientName: "Acme Corp", issueDate: "2023-10-01", dueDate: "2023-10-31", totalAmount: 1500, status: "paid", currency: "USD" },
  { id: "INV-002", clientName: "Beta LLC", issueDate: "2023-10-05", dueDate: "2023-11-04", totalAmount: 850, status: "sent", currency: "USD" },
  { id: "INV-003", clientName: "Gamma Inc", issueDate: "2023-09-15", dueDate: "2023-10-15", totalAmount: 2200, status: "overdue", currency: "USD" },
  { id: "INV-004", clientName: "Delta Co", issueDate: "2023-10-10", dueDate: "2023-11-09", totalAmount: 500, status: "draft", currency: "USD" },
];


export default function InvoicesPage() {
  // TODO: Fetch invoices for the logged-in user from Firestore

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "paid": return "default"; // Using primary color for paid
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
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Invoices</h1>
          <p className="text-muted-foreground mt-1">Manage all your customer invoices here.</p>
        </div>
        <Button asChild size="lg">
          <Link href="/invoices/new">
            <FilePlus className="mr-2 h-5 w-5" /> Create New Invoice
          </Link>
        </Button>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="font-headline text-xl text-primary">Your Invoices</CardTitle>
              <CardDescription>View, edit, and track your invoices.</CardDescription>
            </div>
            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="relative flex-grow md:flex-grow-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input type="search" placeholder="Search invoices..." className="pl-8 sm:w-[300px]" />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" /> Filter
              </Button>
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mockInvoices.length > 0 ? (
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Issue Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.id}</TableCell>
                    <TableCell>{invoice.clientName}</TableCell>
                    <TableCell>{invoice.issueDate}</TableCell>
                    <TableCell>{invoice.dueDate}</TableCell>
                    <TableCell className="text-right">{invoice.currency} {invoice.totalAmount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(invoice.status)} className="capitalize">{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        {/* TODO: Link to /invoices/[id] */}
                        <Link href={`/invoices/${invoice.id.toLowerCase()}`}>View</Link> 
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <FilePlus className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-xl font-semibold text-primary">No invoices yet</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating your first invoice.
              </p>
              <Button className="mt-6" asChild>
                <Link href="/invoices/new">Create Invoice</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
