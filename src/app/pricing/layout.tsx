
import type { ReactNode } from 'react';

// This layout can be very simple, as SiteHeader and SiteFooter are part of the PricingPage itself.
// However, if we wanted a different root structure for /pricing/* routes, this would be the place.
// For now, it just passes children through. LanguageProvider and AuthProvider are in the root layout.

export default function PricingLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
