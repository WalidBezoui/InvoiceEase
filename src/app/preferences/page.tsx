
"use client";

import PreferencesForm from "@/components/preferences/preferences-form";
import LogoUploader from "@/components/preferences/logo-uploader";
import WatermarkUploader from "@/components/preferences/watermark-uploader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings2, Brush } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export default function PreferencesPage() {
  const { t, isLoadingLocale } = useLanguage();

  if (isLoadingLocale) {
    // You might want a more sophisticated skeleton loader here
    return <div>Loading language...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary">{t('preferencesPage.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('preferencesPage.description')}</p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-2 mb-6">
          <TabsTrigger value="general" className="font-medium text-sm py-2.5">
            <Settings2 className="mr-2 h-4 w-4" /> {t('preferencesPage.tabs.general')}
          </TabsTrigger>
          <TabsTrigger value="branding" className="font-medium text-sm py-2.5">
            <Brush className="mr-2 h-4 w-4" /> {t('preferencesPage.tabs.branding')}
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
                <CardTitle className="font-headline text-lg text-primary">{t('preferencesPage.brandColors.title')}</CardTitle>
                <CardDescription>{t('preferencesPage.brandColors.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">{t('preferencesPage.brandColors.comingSoonMessage')}</p>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

      