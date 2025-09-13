
import AppLayout from '@/components/layout/app-layout';
import type { ReactNode } from 'react';

export default function ProductsLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
