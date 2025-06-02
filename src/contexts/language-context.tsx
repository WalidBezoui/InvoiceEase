
"use client";

import type { ReactNode } from 'react';
import { createContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserPreferences } from '@/lib/types';

// Import translations
import enTranslations from '@/locales/en.json';
import frTranslations from '@/locales/fr.json';

export type Locale = 'en' | 'fr';
type Translations = typeof enTranslations; // Assuming structure is the same

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, replacements?: Record<string, string | number>) => string;
  isLoadingLocale: boolean;
}

const availableTranslations: Record<Locale, Translations> = {
  en: enTranslations,
  fr: frTranslations,
};

const defaultLocale: Locale = 'fr';

// Helper function to navigate nested keys like "siteNav.dashboard"
const getNestedValue = (obj: any, path: string): string | undefined => {
  return path.split('.').reduce((acc, part) => acc && acc[part], obj);
};

export const LanguageContext = createContext<LanguageContextType>({
  locale: defaultLocale,
  setLocale: () => {},
  t: (key: string) => key,
  isLoadingLocale: true,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [currentLocale, setCurrentLocaleState] = useState<Locale>(defaultLocale);
  const [isLoadingLocale, setIsLoadingLocale] = useState(true);

  useEffect(() => {
    const fetchAndSetLocale = async () => {
      if (authLoading) {
        setIsLoadingLocale(true);
        return;
      }
      setIsLoadingLocale(true);
      let determinedLocale: Locale = defaultLocale;

      if (user && user.uid) { // Ensure user and user.uid are available
        try {
          const prefDocRef = doc(db, "userPreferences", user.uid);
          const prefDocSnap = await getDoc(prefDocRef);
          if (prefDocSnap.exists()) {
            const prefs = prefDocSnap.data() as UserPreferences;
            if (prefs.language && (prefs.language === 'en' || prefs.language === 'fr')) {
              determinedLocale = prefs.language as Locale;
            }
          }
        } catch (error) {
          console.error("Error fetching user language preferences:", error);
        }
      }
      setCurrentLocaleState(determinedLocale);
      setIsLoadingLocale(false);
    };

    fetchAndSetLocale();
  }, [user, authLoading]);

  const setLocale = (newLocale: Locale) => {
    setCurrentLocaleState(newLocale);
    // Optionally save to user preferences here if user initiates change
  };

  const t = useCallback((key: string, replacements?: Record<string, string | number>): string => {
    let translation = getNestedValue(availableTranslations[currentLocale], key) 
                      || getNestedValue(availableTranslations[defaultLocale], key) 
                      || key;
    if (replacements) {
      Object.keys(replacements).forEach(placeholder => {
        const regex = new RegExp(`{{${placeholder}}}`, 'g');
        translation = translation.replace(regex, String(replacements[placeholder]));
      });
    }
    return translation;
  }, [currentLocale]);

  // Update the lang attribute of the HTML tag when locale changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = currentLocale;
    }
  }, [currentLocale]);

  return (
    <LanguageContext.Provider value={{ locale: currentLocale, setLocale, t, isLoadingLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}
