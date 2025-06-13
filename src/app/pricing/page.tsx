
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import SiteFooter from "@/components/layout/site-footer";
import SiteHeader from "@/components/layout/site-header";
import { useLanguage } from "@/hooks/use-language";
import type { PricingPlan } from "@/lib/types";
import { CheckCircle, XCircle, Star } from "lucide-react";
import Link from "next/link";

const plansData: PricingPlan[] = [
  {
    id: "free",
    titleKey: "pricingPage.plans.free.title",
    priceKey: "pricingPage.plans.free.price",
    features: [
      { textKey: "pricingPage.features.maxInvoices", included: true }, // Will be shown as "Up to 10 Invoices/month"
      { textKey: "pricingPage.features.maxClients", included: true }, // "Up to 5 Clients"
      { textKey: "pricingPage.features.basicCustomization", included: true },
      { textKey: "pricingPage.features.emailSupport", included: true },
      { textKey: "pricingPage.features.removeBranding", included: false },
      { textKey: "pricingPage.features.paymentReminders", included: false },
    ],
    ctaKey: "pricingPage.plans.free.cta",
  },
  {
    id: "pro",
    titleKey: "pricingPage.plans.pro.title",
    priceKey: "pricingPage.plans.pro.price",
    features: [
      { textKey: "pricingPage.features.maxInvoicesPro", included: true }, // "Up to 100 Invoices/month"
      { textKey: "pricingPage.features.maxClientsPro", included: true }, // "Up to 50 Clients"
      { textKey: "pricingPage.features.fullCustomization", included: true },
      { textKey: "pricingPage.features.removeBranding", included: true },
      { textKey: "pricingPage.features.prioritySupport", included: true },
      { textKey: "pricingPage.features.paymentReminders", included: false },
    ],
    ctaKey: "pricingPage.plans.pro.cta",
    isPopular: true,
  },
  {
    id: "business",
    titleKey: "pricingPage.plans.business.title",
    priceKey: "pricingPage.plans.business.price",
    features: [
      { textKey: "pricingPage.features.maxInvoicesBusiness", included: true }, // "Unlimited Invoices"
      { textKey: "pricingPage.features.maxClientsBusiness", included: true }, // "Unlimited Clients"
      { textKey: "pricingPage.features.fullCustomization", included: true },
      { textKey: "pricingPage.features.removeBranding", included: true },
      { textKey: "pricingPage.features.paymentReminders", included: true },
      { textKey: "pricingPage.features.teamCollaboration", included: true }, // Placeholder
      { textKey: "pricingPage.features.dedicatedSupport", included: true },
    ],
    ctaKey: "pricingPage.plans.business.cta",
  },
];

export default function PricingPage() {
  const { t, isLoadingLocale } = useLanguage();

  if (isLoadingLocale) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-grow container mx-auto flex items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
          <div className="animate-pulse h-12 w-1/2 bg-muted rounded"></div>
        </main>
        <SiteFooter />
      </div>
    );
  }
  
  // Helper to get specific limits for feature text
  const getFeatureText = (feature: PricingPlan['features'][0]) => {
    switch (feature.textKey) {
      case "pricingPage.features.maxInvoices":
        return t(feature.textKey, { limit: 10 });
      case "pricingPage.features.maxClients":
        return t(feature.textKey, { limit: 5 });
      case "pricingPage.features.maxInvoicesPro":
        return t(feature.textKey, { limit: 100 });
      case "pricingPage.features.maxClientsPro":
        return t(feature.textKey, { limit: 50 });
      default:
        return t(feature.textKey);
    }
  };


  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-background via-secondary/30 to-background">
      <SiteHeader />
      <main className="flex-grow container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <section className="text-center mb-16">
          <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
            {t('pricingPage.title')}
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg leading-8 text-foreground/80">
            {t('pricingPage.subtitle')}
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {plansData.map((plan) => (
            <Card key={plan.id} className={`flex flex-col shadow-xl hover:shadow-2xl transition-shadow duration-300 rounded-lg overflow-hidden ${plan.isPopular ? 'border-2 border-primary ring-2 ring-primary/50' : 'border-border'}`}>
              {plan.isPopular && (
                <div className="bg-primary text-primary-foreground py-1.5 px-4 text-sm font-semibold text-center flex items-center justify-center">
                  <Star className="h-4 w-4 mr-2 fill-current" /> {t('pricingPage.mostPopular')}
                </div>
              )}
              <CardHeader className="p-6 bg-card/50">
                <CardTitle className="font-headline text-2xl text-primary">{t(plan.titleKey)}</CardTitle>
                <CardDescription className="text-muted-foreground text-sm min-h-[40px]">{t(plan.priceKey)}</CardDescription>
              </CardHeader>
              <CardContent className="p-6 flex-grow">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      {feature.included ? (
                        <CheckCircle className="h-5 w-5 text-green-500 mr-3 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-muted-foreground mr-3 shrink-0" />
                      )}
                      <span className={!feature.included ? 'text-muted-foreground line-through' : 'text-foreground'}>
                        {getFeatureText(feature)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="p-6 bg-card/50 mt-auto">
                <Button 
                  size="lg" 
                  className="w-full" 
                  variant={plan.isPopular ? 'default' : 'outline'}
                  asChild
                >
                  <Link href={plan.id === 'free' ? "/signup" : "/signup"}> 
                    {t(plan.ctaKey)}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </section>
        
        <section className="mt-16 text-center">
            <p className="text-muted-foreground">{t('pricingPage.contactSalesText')}</p>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
