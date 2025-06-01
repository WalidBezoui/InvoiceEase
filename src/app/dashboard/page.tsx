"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { FilePlus, Eye, BarChart3, Settings } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">
            Welcome, {user?.displayName || 'User'}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here&apos;s an overview of your invoicing activity.
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/invoices/new">
            <FilePlus className="mr-2 h-5 w-5" /> Create New Invoice
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <BarChart3 className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">$0.00</div>
            <p className="text-xs text-muted-foreground">
              (Based on paid invoices)
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Outstanding Invoices</CardTitle>
            <Eye className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">0</div>
            <p className="text-xs text-muted-foreground">
              Total unpaid invoices
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Invoices</CardTitle>
            <FilePlus className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">0</div>
            <p className="text-xs text-muted-foreground">
              Invoices pending completion
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-lg hover:shadow-xl transition-shadow bg-accent/10 border-accent">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-accent-foreground">Quick Actions</CardTitle>
             <Settings className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent className="flex flex-col space-y-2">
             <Button variant="outline" asChild className="w-full justify-start">
                <Link href="/preferences"><Settings className="mr-2 h-4 w-4" /> Customize Preferences</Link>
             </Button>
             <Button variant="outline" asChild className="w-full justify-start">
                <Link href="/invoices"><Eye className="mr-2 h-4 w-4" /> View All Invoices</Link>
             </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-xl text-primary">Recent Activity</CardTitle>
          <CardDescription>A log of your recent invoice actions and updates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">No recent activity to display.</p>
            <p className="text-sm text-muted-foreground mt-1">Create an invoice to get started!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
