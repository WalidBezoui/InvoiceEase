"use client";

import PreferencesForm from "@/components/preferences/preferences-form";
import LogoUploader from "@/components/preferences/logo-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, FileText, Globe, DollarSign } from "lucide-react";


export default function PreferencesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Preferences</h1>
        <p className="text-muted-foreground mt-1">Customize your invoicing experience and branding.</p>
      </div>

      <Tabs defaultValue="branding" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="branding" className="font-medium">
            <Palette className="mr-2 h-4 w-4" /> Branding
          </TabsTrigger>
          <TabsTrigger value="content" className="font-medium">
            <FileText className="mr-2 h-4 w-4" /> Invoice Content
          </TabsTrigger>
          <TabsTrigger value="regional" className="font-medium">
            <Globe className="mr-2 h-4 w-4" /> Regional
          </TabsTrigger>
           <TabsTrigger value="defaults" className="font-medium">
            <DollarSign className="mr-2 h-4 w-4" /> Defaults
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card className="shadow-lg mt-6">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Company Branding</CardTitle>
              <CardDescription>Upload your logo and set brand colors.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <LogoUploader />
              {/* Placeholder for brand color customization */}
              <div>
                <h3 className="text-lg font-medium text-foreground mb-2">Brand Colors (Coming Soon)</h3>
                <p className="text-sm text-muted-foreground">Customize the primary color of your invoices.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
           <PreferencesForm />
        </TabsContent>

        <TabsContent value="regional">
          <Card className="shadow-lg mt-6">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Regional Settings</CardTitle>
              <CardDescription>Set your preferred language and currency for invoices.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Form fields for language and currency will be part of PreferencesForm or a separate component */}
              <p className="text-sm text-muted-foreground">Language and currency settings will appear here. (Part of Preferences Form)</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="defaults">
          <Card className="shadow-lg mt-6">
            <CardHeader>
              <CardTitle className="font-headline text-xl text-primary">Invoice Defaults</CardTitle>
              <CardDescription>Set default payment terms, notes, etc.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <p className="text-sm text-muted-foreground">Default settings for new invoices will be configurable here. (Part of Preferences Form)</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
