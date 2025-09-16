
"use server";

import { db } from "@/lib/firebase";
import { collection, doc, writeBatch, serverTimestamp, getDoc, type DocumentReference } from "firebase/firestore";
import type { Product, ProductTransaction, ProductTransactionType } from "./types";

/**
 * Handles stock adjustment for a product and creates a transaction log.
 * @param productId The ID of the product to update.
 * @param quantityChange The amount to change the stock by (can be positive or negative).
 * @param notes Optional notes for the transaction.
 * @param userId The ID of the user performing the action.
 * @param transactionPrice The price per unit for this transaction.
 * @param type The type of transaction.
 */
export async function handleStockAdjustment(
    productId: string,
    quantityChange: number,
    notes: string | undefined,
    userId: string,
    transactionPrice?: number,
    type: ProductTransactionType = quantityChange > 0 ? 'purchase' : 'sale'
) {
    if (!productId || !userId || quantityChange === 0) {
        throw new Error("Invalid arguments for stock adjustment.");
    }

    const batch = writeBatch(db);
    const productRef = doc(db, "products", productId);
    const transactionRef = doc(collection(db, "productTransactions"));

    // We need to get the current stock from the server to avoid race conditions
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) {
        throw new Error(`Product with ID ${productId} not found.`);
    }
    const product = productSnap.data() as Product;
    const currentStock = product.stock || 0;
    const newStock = currentStock + quantityChange;

    const newTransactionData: Omit<ProductTransaction, 'id' | 'transactionDate'> = {
        userId: userId,
        productId: productId,
        type: type,
        quantityChange: quantityChange,
        newStock: newStock,
        notes: notes || (quantityChange > 0 ? 'Stock purchase' : 'Direct Sale'),
        transactionPrice: transactionPrice ?? (quantityChange > 0 ? product.purchasePrice : product.sellingPrice),
    };
    
    batch.update(productRef, { stock: newStock });
    batch.set(transactionRef, { ...newTransactionData, transactionDate: serverTimestamp() });

    await batch.commit();

    return { newStock };
}
