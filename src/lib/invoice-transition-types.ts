/**
 * Invoice Transition Types
 * 
 * These types define the interface for the centralized invoice transition
 * operation that will be implemented in Phase 2.
 */
import type { Invoice } from './types';

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export interface TransitionResult {
  success: boolean;
  error?: string;
  /** The updated invoice data (without the id) */
  updatedInvoice?: Partial<Invoice>;
  /** Stock movements that were applied */
  stockMovements?: StockMovement[];
}

export interface StockMovement {
  productId: string;
  quantityChange: number;
  newStock: number;
  /** 'sale' when marking paid, 'reversal' when reverting from paid */
  type: 'sale' | 'reversal';
  invoiceId: string;
}

/**
 * Legal state transitions for invoices.
 * 
 * draft → sent → paid → sent (revert)
 *                → cancelled
 *       → overdue
 * sent → paid
 *      → overdue
 *      → cancelled
 * overdue → paid
 *         → cancelled
 * paid → sent (revert, stock restored)
 * cancelled → draft (reopen)
 */
export const LEGAL_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['sent'],
  sent: ['paid', 'overdue', 'cancelled'],
  paid: ['sent'], // Revert to sent; stock is restored
  overdue: ['paid', 'cancelled'],
  cancelled: ['draft'], // Reopen as draft
};

/**
 * Check if a status transition is legal.
 */
export function isLegalTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return LEGAL_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Check if a transition requires stock deduction (marking as paid).
 */
export function requiresStockDeduction(
  from: InvoiceStatus,
  to: InvoiceStatus,
  currentlyStockUpdated: boolean,
): boolean {
  return to === 'paid' && !currentlyStockUpdated;
}

/**
 * Check if a transition requires stock restoration (leaving paid state).
 */
export function requiresStockRestoration(
  from: InvoiceStatus,
  to: InvoiceStatus,
  currentlyStockUpdated: boolean,
): boolean {
  return from === 'paid' && to !== 'paid' && currentlyStockUpdated;
}
