
import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null; 
}

export interface UserPreferences {
  logoDataUrl?: string | null;
  watermarkLogoDataUrl?: string | null; // Added for watermark logo
  invoiceHeader?: string;
  invoiceFooter?: string;
  invoiceWatermark?: string; // This is for text watermark, distinct from logo
  currency?: string; // e.g., "USD", "EUR"
  language?: string; // e.g., "en", "es"
  defaultNotes?: string;
  defaultPaymentTerms?: string;
  defaultTaxRate?: number;
}

export interface Client {
  id?: string; // Firestore document ID
  userId: string;
  name: string;
  email?: string;
  address?: string;
  phone?: string;
  clientCompany?: string; // Optional company name for the client
  ice: string; // Identifiant Commun de l'Entreprise (Morocco) - 15 digits
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ClientFormData = Omit<Client, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export interface InvoiceItem {
  id?: string; // Optional: mainly for client-side keying in forms
  description: string;
  quantity: number;
  unitPrice: number;
  total: number; // Calculated: quantity * unitPrice
}

export interface Invoice {
  id?: string; // Firestore document ID, optional for new invoices
  userId: string;
  invoiceNumber: string;
  
  // Client details snapshot at the time of invoice creation
  clientId?: string | null; // Optional: ID of the client if selected from a list
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  clientCompany?: string; // Snapshot of client's company name
  clientICE?: string; // Snapshot of client's ICE

  issueDate: string; // ISO string date
  dueDate: string; // ISO string date
  items: InvoiceItem[];
  subtotal: number;
  taxRate?: number; // Optional tax rate (e.g., 0.05 for 5%)
  taxAmount?: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string; // Invoice-specific notes

  // Fields populated from UserPreferences at the time of invoice creation
  currency: string; 
  language: string; 
  logoDataUrl?: string | null;
  watermarkLogoDataUrl?: string | null; // Added for watermark logo
  companyInvoiceHeader?: string;
  companyInvoiceFooter?: string;
  appliedDefaultNotes?: string; 
  appliedDefaultPaymentTerms?: string;
  
  sentDate?: string | null; // ISO string date, when invoice was marked as sent
  paidDate?: string | null; // ISO string date, when invoice was marked as paid

  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}
