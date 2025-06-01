import Link from 'next/link';
import { Button } from '@/components/ui/button';
import SiteHeader from '@/components/layout/site-header';
import SiteFooter from '@/components/layout/site-footer';
import Image from 'next/image';
import { CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-grow">
        <section className="py-16 md:py-24 lg:py-32 bg-gradient-to-br from-primary/10 via-background to-background">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-headline text-4xl font-bold tracking-tight text-primary sm:text-5xl md:text-6xl">
              Simplify Your Invoicing with <span className="text-accent">InvoiceEase</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg leading-8 text-foreground/80">
              Create professional invoices in minutes, manage your clients, and get paid faster.
              Focus on your business, let us handle the paperwork.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Button size="lg" asChild>
                <Link href="/signup">Get Started for Free</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Login to Your Account</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <h2 className="font-headline text-3xl font-bold text-center text-primary mb-12">
              Features Designed for You
            </h2>
            <div className="grid grid-cols-1 gap-x-8 gap-y-10 md:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <CheckCircle className="h-12 w-12 text-accent mb-4" />
                <h3 className="font-headline text-xl font-semibold text-primary mb-2">Easy Invoice Creation</h3>
                <p className="text-foreground/70">
                  Generate beautiful, professional invoices with just a few clicks using our intuitive editor.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <CheckCircle className="h-12 w-12 text-accent mb-4" />
                <h3 className="font-headline text-xl font-semibold text-primary mb-2">Customization Options</h3>
                <p className="text-foreground/70">
                  Add your logo, customize colors, and tailor invoices to match your brand identity.
                </p>
              </div>
              <div className="flex flex-col items-center text-center p-6 bg-card rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <CheckCircle className="h-12 w-12 text-accent mb-4" />
                <h3 className="font-headline text-xl font-semibold text-primary mb-2">Secure & Reliable</h3>
                <p className="text-foreground/70">
                  Your data is safe with us. Built on robust technology to ensure reliability and security.
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
                Manage Everything in One Place
              </h2>
              <p className="text-lg text-foreground/80 mb-4">
                Track invoice statuses, manage client information, and get insights into your billing cycles. 
                InvoiceEase provides a comprehensive dashboard to keep you organized.
              </p>
              <ul className="space-y-2 text-foreground/70">
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> Client Management</li>
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> Invoice Tracking</li>
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> Customizable Templates</li>
                <li className="flex items-center"><CheckCircle className="h-5 w-5 text-accent mr-2" /> Secure Cloud Storage</li>
              </ul>
            </div>
          </div>
        </section>

      </main>
      <SiteFooter />
    </div>
  );
}
