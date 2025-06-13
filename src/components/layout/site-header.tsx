
"use client";

import Link from 'next/link';
import { Building2, LogIn, LogOut, UserPlus, LayoutDashboard, FileText, Settings, Users, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language'; 
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from '@/components/ui/skeleton'; 

export default function SiteHeader() {
  const { user, loading: authLoading } = useAuth();
  const { t, isLoadingLocale } = useLanguage(); 
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    const names = name.split(' ');
    if (names.length > 1) {
      return names[0][0] + names[names.length - 1][0];
    }
    return names[0].substring(0, 2);
  };

  const isLoading = authLoading || isLoadingLocale;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 max-w-screen-2xl items-center justify-between px-4">
        <Link href="/" className="flex items-center space-x-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-headline text-xl font-bold text-primary">InvoiceEase</span>
        </Link>
        <nav className="flex items-center space-x-1 md:space-x-2">
          {isLoading ? (
            <div className="flex items-center space-x-2 md:space-x-4">
              <Skeleton className="h-8 w-20 hidden md:inline-flex" />
              <Skeleton className="h-8 w-20 hidden md:inline-flex" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          ) : user ? (
            <>
              <Button variant="ghost" size="sm" asChild className="text-sm font-medium text-muted-foreground transition-colors hidden md:inline-flex hover:text-accent-foreground">
                <Link href="/dashboard">
                  <LayoutDashboard className="mr-2 h-4 w-4" /> {t('siteNav.dashboard')}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-sm font-medium text-muted-foreground transition-colors hidden md:inline-flex hover:text-accent-foreground">
                <Link href="/invoices">
                  <FileText className="mr-2 h-4 w-4" /> {t('siteNav.invoices')}
                </Link>
              </Button>
               <Button variant="ghost" size="sm" asChild className="text-sm font-medium text-muted-foreground transition-colors hidden md:inline-flex hover:text-accent-foreground">
                <Link href="/clients">
                  <Users className="mr-2 h-4 w-4" /> {t('siteNav.clients')}
                </Link>
              </Button>
              <Button variant="ghost" size="sm" asChild className="text-sm font-medium text-muted-foreground transition-colors hidden md:inline-flex hover:text-accent-foreground">
                <Link href="/preferences">
                  <Settings className="mr-2 h-4 w-4" /> {t('siteNav.preferences')}
                </Link>
              </Button>
              
               <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.photoURL || undefined} alt={user.displayName || user.email || "User"} />
                      <AvatarFallback>{getInitials(user.displayName || user.email)}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                   <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                     <Link href="/dashboard"><LayoutDashboard className="mr-2 h-4 w-4" />{t('siteNav.dashboard')}</Link>
                   </DropdownMenuItem>
                   <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                     <Link href="/invoices"><FileText className="mr-2 h-4 w-4" />{t('siteNav.invoices')}</Link>
                   </DropdownMenuItem>
                   <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                     <Link href="/clients"><Users className="mr-2 h-4 w-4" />{t('siteNav.clients')}</Link>
                   </DropdownMenuItem>
                   <DropdownMenuItem asChild className="cursor-pointer md:hidden">
                     <Link href="/preferences"><Settings className="mr-2 h-4 w-4" />{t('siteNav.preferences')}</Link>
                   </DropdownMenuItem>
                   <DropdownMenuSeparator className="md:hidden"/>
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>{t('siteNav.logout')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/pricing">
                  <DollarSign className="mr-2 h-4 w-4" /> {t('siteNav.pricing', {default: "Pricing"})}
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/login">
                  <LogIn className="mr-2 h-4 w-4" /> {t('siteNav.login')}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/signup">
                  <UserPlus className="mr-2 h-4 w-4" /> {t('siteNav.signup')}
                </Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
