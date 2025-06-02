
"use client";

import { Building2 } from 'lucide-react';
import { useLanguage } from '@/hooks/use-language'; // Import useLanguage

export default function SiteFooter() {
  const currentYear = new Date().getFullYear();
  const { t, isLoadingLocale } = useLanguage(); // Use language hook

  if (isLoadingLocale) {
    return (
      <footer className="border-t border-border/40 bg-background py-6 md:py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <div className="animate-pulse h-5 w-1/3 bg-muted rounded"></div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border/40 bg-background py-6 md:py-8">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
        <div className="flex items-center space-x-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {t('siteFooter.copyright', { year: currentYear })}
          </p>
        </div>
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          {/* Add footer links here if needed, e.g., Privacy Policy, Terms of Service */}
          {/* <Link href="/privacy" className="hover:text-primary">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-primary">Terms of Service</Link> */}
        </div>
      </div>
    </footer>
  );
}

      