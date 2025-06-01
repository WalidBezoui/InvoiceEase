import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null; 
}

export interface UserPreferences {
  logoUrl?: string;
  invoiceHeader?: string;
  invoiceFooter?: string;
  invoiceWatermark?: string;
  currency?: string; // e.g., "USD", "EUR"
  language?: string; // e.g., "en", "es"
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id?: string; // Firestore document ID, optional for new invoices
  userId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  issueDate: string; // ISO string date
  dueDate: string; // ISO string date
  items: InvoiceItem[];
  subtotal: number;
  taxRate?: number; // Optional tax rate (e.g., 0.05 for 5%)
  taxAmount?: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  // Customized elements based on preferences at time of creation/update
  customHeader?: string;
  customFooter?: string;
  customWatermark?: string;
  logoUrl?: string; 
  currency?: string; 
  language?: string; 
  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}
