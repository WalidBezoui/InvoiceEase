/**
 * Centralized Invoice Transition Operation
 *
 * This is THE single function for changing invoice status. Both the invoice
 * list page and the invoice detail page must call this function — never
 * implement stock/status logic inline.
 *
 * Guarantees:
 * 1. ATOMIC: Uses Firestore runTransaction — all reads and writes succeed or fail together
 * 2. IDEMPOTENT: Reading invoice state inside the transaction prevents double stock deduction
 * 3. AUDITABLE: Stock movements are recorded as transactions, never deleted
 * 4. VALIDATED: Checks legal transitions, ownership, and product existence
 *
 * Usage:
 *   const result = await transitionInvoiceStatus(invoiceId, userId, 'paid');
 *   if (!result.success) { handleError(result.error); }
 */
import { db } from './firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type { Invoice, Product, ProductTransaction } from './types';
import {
  type InvoiceStatus,
  type TransitionResult,
  type StockMovement,
  isLegalTransition,
  requiresStockDeduction,
  requiresStockRestoration,
} from './invoice-transition-types';

/**
 * Transition an invoice to a new status.
 *
 * This function handles:
 * - Status validation (legal transitions only)
 * - Ownership verification (userId must match)
 * - Stock deduction (when marking as paid)
 * - Stock restoration (when reverting from paid — creates reversal transactions)
 * - Date tracking (sentDate, paidDate)
 * - Idempotency (stockUpdated flag checked atomically)
 */
export async function transitionInvoiceStatus(
  invoiceId: string,
  userId: string,
  newStatus: InvoiceStatus,
): Promise<TransitionResult> {
  const invoiceRef = doc(db, 'invoices', invoiceId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      // ─── 1. Read current invoice state (INSIDE the transaction) ────
      const invoiceSnap = await transaction.get(invoiceRef);

      if (!invoiceSnap.exists()) {
        return { success: false, error: 'Invoice not found.' } satisfies TransitionResult;
      }

      const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

      // ─── 2. Verify ownership ───────────────────────────────────────
      if (invoice.userId !== userId) {
        return { success: false, error: 'You do not have permission to modify this invoice.' } satisfies TransitionResult;
      }

      // ─── 3. Validate transition is legal ───────────────────────────
      const currentStatus = invoice.status as InvoiceStatus;
      if (!isLegalTransition(currentStatus, newStatus)) {
        return {
          success: false,
          error: `Cannot transition from '${currentStatus}' to '${newStatus}'.`,
        } satisfies TransitionResult;
      }

      // ─── 4. Build the update payload ───────────────────────────────
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updatedAt: serverTimestamp(),
      };

      const stockMovements: StockMovement[] = [];

      // ─── 5. Handle stock deduction (marking as paid) ───────────────
      if (requiresStockDeduction(currentStatus, newStatus, invoice.stockUpdated ?? false)) {
        // Aggregate quantities per product (handle duplicate product lines)
        const productQuantities = new Map<string, number>();
        for (const item of invoice.items) {
          if (item.productId) {
            const current = productQuantities.get(item.productId) ?? 0;
            productQuantities.set(item.productId, current + item.quantity);
          }
        }

        // Deduct stock for each product
        for (const [productId, totalQuantity] of productQuantities.entries()) {
          const productRef = doc(db, 'products', productId);
          const productSnap = await transaction.get(productRef);

          if (!productSnap.exists()) {
            return {
              success: false,
              error: `Product not found (ID: ${productId}). Cannot complete stock deduction. Please remove this item from the invoice or restore the product.`,
            } satisfies TransitionResult;
          }

          const product = productSnap.data() as Product;
          const currentStock = product.stock ?? 0;
          const newStock = currentStock - totalQuantity;

          // Update product stock
          transaction.update(productRef, { stock: newStock, updatedAt: serverTimestamp() });

          // Create stock movement record
          const transactionRef = doc(collection(db, 'productTransactions'));
          transaction.set(transactionRef, {
            userId: invoice.userId,
            productId,
            type: 'sale' as const,
            quantityChange: -totalQuantity,
            newStock,
            invoiceId: invoice.id,
            notes: invoice.invoiceNumber,
            transactionPrice: invoice.items.find(i => i.productId === productId)?.unitPrice ?? 0,
            transactionDate: serverTimestamp(),
          } satisfies Omit<ProductTransaction, 'id' | 'transactionDate'> & { transactionDate: ReturnType<typeof serverTimestamp> });

          stockMovements.push({
            productId,
            quantityChange: -totalQuantity,
            newStock,
            type: 'sale',
            invoiceId: invoice.id!,
          });
        }

        updateData.stockUpdated = true;
        updateData.paidDate = new Date().toISOString();
      }

      // ─── 6. Handle stock restoration (reverting from paid) ─────────
      if (requiresStockRestoration(currentStatus, newStatus, invoice.stockUpdated ?? false)) {
        // Find existing transactions for this invoice
        const transQuery = query(
          collection(db, 'productTransactions'),
          where('invoiceId', '==', invoiceId),
        );
        const transSnapshot = await getDocs(transQuery);

        // NOTE: getDocs inside a transaction doesn't participate in the
        // transaction's atomic guarantees for the query results. However,
        // the product stock updates below DO use transaction.get/update.
        // The product reads inside the loop are the critical section.

        if (!transSnapshot.empty) {
          // Aggregate by product (in case of duplicate product lines)
          const productReversals = new Map<string, number>();

          for (const transDoc of transSnapshot.docs) {
            const tx = transDoc.data() as ProductTransaction;
            const current = productReversals.get(tx.productId) ?? 0;
            productReversals.set(tx.productId, current + tx.quantityChange);
          }

          for (const [productId, totalQuantityChange] of productReversals.entries()) {
            const productRef = doc(db, 'products', productId);
            const productSnap = await transaction.get(productRef);

            if (!productSnap.exists()) {
              // Product was deleted — create a reversal transaction anyway
              // for audit trail, but skip the stock update
              const reversalRef = doc(collection(db, 'productTransactions'));
              transaction.set(reversalRef, {
                userId: invoice.userId,
                productId,
                type: 'reversal' as const,
                quantityChange: -totalQuantityChange, // Reverse the original change
                newStock: 0, // Unknown — product is gone
                invoiceId: invoice.id,
                notes: `Reversal: ${invoice.invoiceNumber} (product deleted)`,
                transactionDate: serverTimestamp(),
              });

              stockMovements.push({
                productId,
                quantityChange: -totalQuantityChange,
                newStock: 0,
                type: 'reversal',
                invoiceId: invoice.id!,
              });
              continue;
            }

            const product = productSnap.data() as Product;
            const currentStock = product.stock ?? 0;
            const restoredStock = currentStock - totalQuantityChange; // quantityChange was negative, so this adds back

            // Update product stock
            transaction.update(productRef, { stock: restoredStock, updatedAt: serverTimestamp() });

            // Create reversal transaction record (NOT deleting the original)
            const reversalRef = doc(collection(db, 'productTransactions'));
            transaction.set(reversalRef, {
              userId: invoice.userId,
              productId,
              type: 'reversal' as const,
              quantityChange: -totalQuantityChange,
              newStock: restoredStock,
              invoiceId: invoice.id,
              notes: `Reversal: ${invoice.invoiceNumber}`,
              transactionDate: serverTimestamp(),
            });

            stockMovements.push({
              productId,
              quantityChange: -totalQuantityChange,
              newStock: restoredStock,
              type: 'reversal',
              invoiceId: invoice.id!,
            });
          }
        }

        updateData.stockUpdated = false;
        updateData.paidDate = null;
      }

      // ─── 7. Handle sent date tracking ──────────────────────────────
      if (newStatus === 'sent' && currentStatus === 'draft') {
        updateData.sentDate = new Date().toISOString();
      }

      // ─── 8. Apply the update ───────────────────────────────────────
      transaction.update(invoiceRef, updateData as Record<string, any>);

      return {
        success: true,
        updatedInvoice: updateData as Partial<Invoice>,
        stockMovements,
      } satisfies TransitionResult;
    });

    return result;
  } catch (error) {
    console.error('Error transitioning invoice status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unexpected error occurred.',
    };
  }
}

/**
 * Check if an invoice can be safely deleted.
 *
 * Rules:
 * - Paid invoices with stockUpdated=true should NOT be deleted (stock was deducted)
 * - Invoices with productTransactions should not be hard-deleted (audit trail)
 * - Draft/sent/overdue/cancelled invoices without stock updates can be deleted
 */
export async function canDeleteInvoice(
  invoiceId: string,
  userId: string,
): Promise<{ canDelete: boolean; reason?: string }> {
  const invoiceRef = doc(db, 'invoices', invoiceId);
  const invoiceSnap = await getDoc(invoiceRef);

  if (!invoiceSnap.exists()) {
    return { canDelete: false, reason: 'Invoice not found.' };
  }

  const invoice = { id: invoiceSnap.id, ...invoiceSnap.data() } as Invoice;

  if (invoice.userId !== userId) {
    return { canDelete: false, reason: 'You do not have permission to delete this invoice.' };
  }

  if (invoice.status === 'paid' && invoice.stockUpdated) {
    return {
      canDelete: false,
      reason: 'Cannot delete a paid invoice with stock updates. Revert to "sent" first to restore stock, then delete.',
    };
  }

  // Check for existing transactions
  const transQuery = query(
    collection(db, 'productTransactions'),
    where('invoiceId', '==', invoiceId),
  );
  const transSnapshot = await getDocs(transQuery);

  if (!transSnapshot.empty) {
    return {
      canDelete: false,
      reason: 'Cannot delete an invoice with stock transaction history. This would break the audit trail.',
    };
  }

  return { canDelete: true };
}
