
"use client";

import PreferencesForm from "@/components/preferences/preferences-form";
import LogoUploader from "@/components/preferences/logo-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, FileText, Globe, DollarSign, Settings2 } from "lucide-react";


export default function PreferencesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Preferences</h1>
        <p className="text-muted-foreground mt-1">Customize your invoicing experience and branding.</p>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-1">
          <TabsTrigger value="branding" className="font-medium text-sm py-2.5">
            <Palette className="mr-2 h-4 w-4" /> Branding & Logo
          </TabsTrigger>
          <TabsTrigger value="content" className="font-medium text-sm py-2.5">
            <FileText className="mr-2 h-4 w-4" /> Invoice Content
          </TabsTrigger>
          <TabsTrigger value="regional" className="font-medium text-sm py-2.5">
            <Globe className="mr-2 h-4 w-4" /> Regional Defaults
          </TabsTrigger>
           <TabsTrigger value="invoice_defaults" className="font-medium text-sm py-2.5">
            <Settings2 className="mr-2 h-4 w-4" /> Invoice Defaults
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
            <LogoUploader />
             {/* Placeholder for brand color customization, can be a separate card or integrated */}
            <Card className="shadow-lg mt-6 bg-secondary/20">
                <CardHeader>
                <CardTitle className="font-headline text-lg text-primary">Brand Colors (Coming Soon)</CardTitle>
                <CardDescription>Customize the primary color of your invoices to match your brand.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">This feature will allow you to select a primary color that will be reflected on your generated PDF invoices.</p>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="content">
           {/* PreferencesForm now handles: Header, Footer, Watermark */}
           <PreferencesForm />
        </TabsContent>

        <TabsContent value="regional">
          {/* PreferencesForm now handles: Currency, Language */}
           <PreferencesForm />
        </TabsContent>
        
        <TabsContent value="invoice_defaults">
           {/* PreferencesForm now handles: Default Notes, Default Payment Terms */}
           <PreferencesForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
