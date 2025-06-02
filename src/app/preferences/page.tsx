
"use client";

import PreferencesForm from "@/components/preferences/preferences-form";
import LogoUploader from "@/components/preferences/logo-uploader";
import WatermarkUploader from "@/components/preferences/watermark-uploader"; // Added import
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, FileText, Globe, Settings2, Brush, Image as ImageIcon } from "lucide-react";


export default function PreferencesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">Preferences</h1>
        <p className="text-muted-foreground mt-1">Customize your invoicing experience, branding, and defaults.</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-2 mb-6">
          <TabsTrigger value="general" className="font-medium text-sm py-2.5">
            <Settings2 className="mr-2 h-4 w-4" /> General & Defaults
          </TabsTrigger>
          <TabsTrigger value="branding" className="font-medium text-sm py-2.5">
            <Brush className="mr-2 h-4 w-4" /> Branding & Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
            <PreferencesForm />
        </TabsContent>

        <TabsContent value="branding" className="space-y-6">
            <LogoUploader />
            <WatermarkUploader /> 
            <Card className="shadow-lg bg-secondary/20">
                <CardHeader>
                <CardTitle className="font-headline text-lg text-primary">Brand Colors (Coming Soon)</CardTitle>
                <CardDescription>Customize the primary color of your invoices to match your brand.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">This feature will allow you to select a primary color that will be reflected on your generated PDF invoices.</p>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
