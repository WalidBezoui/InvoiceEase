
"use client"; 

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import SiteHeader from '@/components/layout/site-header';
import SiteFooter from '@/components/layout/site-footer';
import Image from 'next/image';
import { CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { useAuth } from '@/hooks/use-auth'; // Import useAuth
import { useRouter } from 'next/navigation'; // Import useRouter
import { useEffect } from 'react'; // Import useEffect

// A small helper component for rendering translated HTML
function TranslatedHtml({ translationKey }: { translationKey: string }) {
  const { t } = useLanguage();
  const rawHtml = t(translationKey);
  // Basic replacement for <1>InvoiceEase</1> -> <span className="text-accent">InvoiceEase</span>
  const processedHtml = rawHtml.replace(
    /<1>(.*?)<\/1>/g,
    '<span class="text-accent">$1</span>'
  );

  return <span dangerouslySetInnerHTML={{ __html: processedHtml }} />;
}


export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { isLoadingLocale } = useLanguage();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || isLoadingLocale || (!authLoading && user)) {
    // Show loading spinner or nothing while auth state is being determined or redirecting
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Only render homepage content if not loading and no user (i.e., logged out)
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-grow">
        <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
              <TranslatedHtml translationKey="homePage.heroTitle" />
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg leading-8 text-foreground/80">
              <TranslatedHtml translationKey="homePage.heroSubtitle" />
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button size="lg" asChild>
                <Link href="/signup"><TranslatedHtml translationKey="homePage.getStartedButton" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login"><TranslatedHtml translationKey="homePage.loginButton" /></Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="font-headline text-3xl font-bold text-center text-primary mb-12">
              <TranslatedHtml translationKey="homePage.featuresTitle" />
            </h2>
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <CheckCircle className="h-12 w-12 text-accent mb-4" />
                <h3 className="font-headline text-xl font-semibold text-primary mb-2"><TranslatedHtml translationKey="homePage.featureEasyCreationTitle" /></h3>
                <p className="text-foreground/70">
                  <TranslatedHtml translationKey="homePage.featureEasyCreationDesc" />
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <CheckCircle className="h-12 w-12 text-accent mb-4" />
                <h3 className="font-headline text-xl font-semibold text-primary mb-2"><TranslatedHtml translationKey="homePage.featureCustomizationTitle" /></h3>
                <p className="text-foreground/70">
                  <TranslatedHtml translationKey="homePage.featureCustomizationDesc" />
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <CheckCircle className="h-12 w-12 text-accent mb-4" />
                <h3 className="font-headline text-xl font-semibold text-primary mb-2"><TranslatedHtml translationKey="homePage.featureSecureTitle" /></h3>
                <p className="text-foreground/70">
                  <TranslatedHtml translationKey="homePage.featureSecureDesc" />
                </p>
              </div>
            </div>
          </div>
        </section>
        
        <section className="py-16 md:py-24 bg-primary/5">
          <div className="container mx-auto px-4 flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2">
              <Image 
                src="https://placehold.co/600x400.png" 
                alt="InvoiceEase dashboard preview"
                data-ai-hint="dashboard invoice" 
                width={600} 
                height={400}
                className="rounded-lg shadow-xl"
              />
            </div>
            <div className="md:w-1/2">
              <h2 className="font-headline text-3xl font-bold text-primary mb-6">
                <TranslatedHtml translationKey="homePage.manageEverythingTitle" />
              </h2>
              <p className="text-lg text-foreground/80 mb-4">
                <TranslatedHtml translationKey="homePage.manageEverythingSubtitle" />
              </p>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> <TranslatedHtml translationKey="homePage.manageEverythingFeature1" /></li>
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> <TranslatedHtml translationKey="homePage.manageEverythingFeature2" /></li>
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> <TranslatedHtml translationKey="homePage.manageEverythingFeature3" /></li>
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> <TranslatedHtml translationKey="homePage.manageEverythingFeature4" /></li>
              </ul>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
