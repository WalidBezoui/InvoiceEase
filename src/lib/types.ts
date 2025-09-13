
import type { Timestamp } from 'firebase/firestore';
import { z } from 'zod';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  photoURL?: string | null; 
  planId?: 'free' | 'pro' | 'business'; // Added planId
}

export interface UserPreferences {
  logoDataUrl?: string | null;
  watermarkLogoDataUrl?: string | null; 
  invoiceHeader?: string;
  invoiceFooter?: string;
  invoiceWatermark?: string; 
  currency?: string; 
  language?: string; 
  defaultNotes?: string;
  defaultPaymentTerms?: string;
  defaultTaxRate?: number;
}

export interface Client {
  id?: string; 
  userId: string;
  name: string;
  email?: string;
  address?: string;
  phone?: string;
  clientCompany?: string; 
  ice: string; 
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ClientFormData = Omit<Client, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export interface Product {
  id?: string;
  userId: string;
  name: string;
  reference?: string;
  description: string;
  sellingPrice: number;
  purchasePrice?: number;
  stock?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type ProductFormData = Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;

export type ProductTransactionType = 'initial' | 'sale' | 'purchase' | 'adjustment';

export interface ProductTransaction {
  id?: string;
  userId: string;
  productId: string;
  type: ProductTransactionType;
  quantityChange: number;
  newStock: number;
  notes?: string;
  invoiceId?: string; // Link to invoice for 'sale' type
  transactionDate: Timestamp;
  transactionPrice?: number; // Price per unit for this transaction (for sales or purchases)
}


export interface InvoiceItem {
  id?: string;
  productId?: string; // Link to the product
  reference?: string; // Denormalized from product for display
  description: string;
  quantity: number;
  unitPrice: number;
  total: number; 
}

export interface Invoice {
  id?: string; 
  userId: string;
  invoiceNumber: string;
  
  clientId?: string | null; 
  clientName: string;
  clientEmail: string;
  clientAddress?: string;
  clientCompany?: string; 
  clientICE?: string; 

  issueDate: string; 
  dueDate: string; 
  items: InvoiceItem[];
  subtotal: number;
  taxRate?: number; 
  taxAmount?: number;
  totalAmount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string; 

  currency: string; 
  language: string; 
  appliedDefaultNotes?: string; 
  appliedDefaultPaymentTerms?: string;
  
  sentDate?: string | null; 
  paidDate?: string | null; 
  stockUpdated?: boolean; // Flag to check if stock has been updated for this invoice

  createdAt?: Timestamp; 
  updatedAt?: Timestamp; 
}

// For Pricing Page
export interface PlanFeature {
  textKey: string; // Translation key for the feature text
  included: boolean;
}

export interface PricingPlan {
  id: 'free' | 'pro' | 'business';
  titleKey: string; // Translation key for plan title
  priceKey: string; // Translation key for price/description (e.g., "Free Forever" or "For Professionals")
  features: PlanFeature[];
  ctaKey: string; // Translation key for Call to Action button
  isPopular?: boolean;
}

// For AI Product Analysis
const TransactionSummarySchema = z.object({
  type: z.enum(['initial', 'sale', 'purchase', 'adjustment']),
  quantityChange: z.number(),
  transactionDate: z.string().describe("The ISO 8601 date of the transaction."),
  transactionPrice: z.number().optional().describe("The price per unit for this specific transaction."),
});

export const ProductAnalysisInputSchema = z.object({
  productName: z.string().describe("The name of the product."),
  sellingPrice: z.number().describe("The standard selling price of the product."),
  purchasePrice: z.number().optional().describe("The standard purchase price of the product."),
  currentStock: z.number().optional().describe("The current stock level."),
  transactions: z.array(TransactionSummarySchema).describe("A list of recent transactions for the product."),
});
export type ProductAnalysisInput = z.infer<typeof ProductAnalysisInputSchema>;

export const ProductAnalysisOutputSchema = z.object({
  analysis: z.string().describe("A concise, data-driven summary of the product's performance, including sales velocity, profitability insights, and stock level trends. Written in paragraph form."),
  suggestions: z.array(z.string()).describe("A list of 2-4 actionable, bullet-point suggestions for the user based on the analysis. For example, suggesting a reorder, a price adjustment, or a promotion."),
});
export type ProductAnalysisOutput = z.infer<typeof ProductAnalysisOutputSchema>;
