/**
 * Money utility for precise financial calculations.
 *
 * Principles:
 * 1. All internal arithmetic uses integer centimes (1/100 of the currency unit).
 * 2. Conversion to/from floating-point happens ONLY at boundaries (user input, display, persistence).
 * 3. Rounding is explicit at every step — never implicit via IEEE 754.
 * 4. Currency minor units are defined per currency code (MAD=2, JPY=0, etc.).
 *
 * This file has ZERO dependencies on Firebase, React, or the DOM.
 * It is pure arithmetic and can be tested in isolation.
 */

// ─── Currency Definitions ────────────────────────────────────────────

interface CurrencyInfo {
  code: string;
  minorUnits: number; // Number of decimal places (0 for JPY, 2 for MAD/EUR/USD)
  label: string;
}

const CURRENCIES: Record<string, CurrencyInfo> = {
  MAD: { code: 'MAD', minorUnits: 2, label: 'Moroccan Dirham' },
  EUR: { code: 'EUR', minorUnits: 2, label: 'Euro' },
  USD: { code: 'USD', minorUnits: 2, label: 'US Dollar' },
  GBP: { code: 'GBP', minorUnits: 2, label: 'British Pound' },
  JPY: { code: 'JPY', minorUnits: 0, label: 'Japanese Yen' },
  CAD: { code: 'CAD', minorUnits: 2, label: 'Canadian Dollar' },
  AUD: { code: 'AUD', minorUnits: 2, label: 'Australian Dollar' },
};

const DEFAULT_CURRENCY = 'MAD';

function getCurrencyInfo(code: string): CurrencyInfo {
  return CURRENCIES[code.toUpperCase()] ?? CURRENCIES[DEFAULT_CURRENCY];
}

function factor(code: string): number {
  return Math.pow(10, getCurrencyInfo(code).minorUnits);
}

// ─── Core Conversions ────────────────────────────────────────────────

/**
 * Convert a decimal amount (e.g. 120.50) to integer centimes (e.g. 12050).
 * Rounds to the nearest centime to handle floating-point input.
 */
export function toMinorUnits(amount: number, currencyCode: string = DEFAULT_CURRENCY): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  return Math.round(amount * factor(currencyCode));
}

/**
 * Convert integer centimes (e.g. 12050) back to decimal (e.g. 120.50).
 */
export function fromMinorUnits(minorUnits: number, currencyCode: string = DEFAULT_CURRENCY): number {
  const f = factor(currencyCode);
  return minorUnits / f;
}

/**
 * Format a decimal amount for display with the correct number of decimal places.
 */
export function formatAmount(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const info = getCurrencyInfo(currencyCode);
  return amount.toFixed(info.minorUnits);
}

/**
 * Format centimes for display.
 */
export function formatMinorUnits(minorUnits: number, currencyCode: string = DEFAULT_CURRENCY): string {
  return formatAmount(fromMinorUnits(minorUnits, currencyCode), currencyCode);
}

// ─── Line Item Calculation ───────────────────────────────────────────

export interface LineItemInput {
  quantity: number;
  unitPrice: number; // Decimal (pre-tax)
  taxRatePercent: number; // e.g. 20 for 20%
  currencyCode?: string;
}

export interface LineItemResult {
  quantity: number;
  /** Pre-tax unit price in decimal */
  unitPrice: number;
  /** Pre-tax unit price in centimes */
  unitPriceMinor: number;
  /** Line subtotal (pre-tax) in centimes: quantity × unitPrice */
  lineSubtotalMinor: number;
  /** Line tax amount in centimes */
  lineTaxMinor: number;
  /** Line total (tax-inclusive) in centimes */
  lineTotalMinor: number;
  /** Pre-tax line subtotal in decimal */
  lineSubtotal: number;
  /** Line tax amount in decimal */
  lineTax: number;
  /** Line total (tax-inclusive) in decimal */
  lineTotal: number;
  /** Tax-inclusive unit price in decimal (for display) */
  unitPriceTaxIncl: number;
  /** Tax-inclusive unit price in centimes */
  unitPriceTaxInclMinor: number;
}

/**
 * Calculate a single line item with explicit rounding at each step.
 *
 * Rounding policy: round to nearest centime at each multiplication.
 * This prevents accumulation of floating-point errors across items.
 *
 * Validation: quantity must be >= 0, unitPrice must be >= 0, taxRatePercent must be >= 0.
 * Throws an error if inputs are invalid.
 */
export function calculateLineItem(input: LineItemInput): LineItemResult {
  if (input.quantity < 0) {
    throw new Error(`Quantity must be non-negative, got ${input.quantity}`);
  }
  if (input.unitPrice < 0) {
    throw new Error(`Unit price must be non-negative, got ${input.unitPrice}`);
  }
  if (input.taxRatePercent < 0) {
    throw new Error(`Tax rate must be non-negative, got ${input.taxRatePercent}`);
  }

  const currencyCode = input.currencyCode ?? DEFAULT_CURRENCY;
  const f = factor(currencyCode);

  // Convert inputs to centimes
  const unitPriceMinor = toMinorUnits(input.unitPrice, currencyCode);
  const quantity = input.quantity;

  // Line subtotal in centimes: round(qty * unitPriceMinor)
  // We use Math.round on the final product to handle fractional quantities
  const lineSubtotalMinor = Math.round(quantity * unitPriceMinor);

  // Tax on this line: round(lineSubtotalMinor * taxRate / 100)
  const lineTaxMinor = Math.round(lineSubtotalMinor * input.taxRatePercent / 100);

  // Line total in centimes
  const lineTotalMinor = lineSubtotalMinor + lineTaxMinor;

  // Tax-inclusive unit price in centimes: round(unitPriceMinor * (1 + taxRate/100))
  // This is for display purposes (what the user types as "price with tax")
  const unitPriceTaxInclMinor = Math.round(unitPriceMinor * (100 + input.taxRatePercent) / 100);

  // Convert back to decimal for display/storage
  return {
    quantity,
    unitPrice: fromMinorUnits(unitPriceMinor, currencyCode),
    unitPriceMinor,
    lineSubtotalMinor,
    lineTaxMinor,
    lineTotalMinor,
    lineSubtotal: fromMinorUnits(lineSubtotalMinor, currencyCode),
    lineTax: fromMinorUnits(lineTaxMinor, currencyCode),
    lineTotal: fromMinorUnits(lineTotalMinor, currencyCode),
    unitPriceTaxIncl: fromMinorUnits(unitPriceTaxInclMinor, currencyCode),
    unitPriceTaxInclMinor,
  };
}

// ─── Invoice Total Calculation ───────────────────────────────────────

export interface InvoiceCalcInput {
  items: LineItemInput[];
  currencyCode?: string;
}

export interface InvoiceCalcResult {
  items: LineItemResult[];
  /** Sum of all line subtotals in centimes */
  subtotalMinor: number;
  /** Sum of all line taxes in centimes */
  taxAmountMinor: number;
  /** Grand total in centimes */
  totalMinor: number;
  /** Same values in decimal for display */
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currencyCode: string;
}

/**
 * Calculate full invoice totals from a list of line items.
 * Each line is rounded independently, then summed — no cross-line drift.
 */
export function calculateInvoice(input: InvoiceCalcInput): InvoiceCalcResult {
  const currencyCode = input.currencyCode ?? DEFAULT_CURRENCY;

  const lineResults = input.items.map(item => calculateLineItem({ ...item, currencyCode }));

  const subtotalMinor = lineResults.reduce((sum, line) => sum + line.lineSubtotalMinor, 0);
  const taxAmountMinor = lineResults.reduce((sum, line) => sum + line.lineTaxMinor, 0);
  const totalMinor = subtotalMinor + taxAmountMinor;

  return {
    items: lineResults,
    subtotalMinor,
    taxAmountMinor,
    totalMinor,
    subtotal: fromMinorUnits(subtotalMinor, currencyCode),
    taxAmount: fromMinorUnits(taxAmountMinor, currencyCode),
    totalAmount: fromMinorUnits(totalMinor, currencyCode),
    currencyCode,
  };
}

// ─── Price Derivation ────────────────────────────────────────────────

/**
 * Given a tax-inclusive unit price, derive the pre-tax unit price.
 * Used when the user enters a "price with tax" and we need to store the pre-tax amount.
 *
 * Rounding: round to nearest centime.
 * Validates: priceWithTax must be >= 0, taxRatePercent must be >= 0.
 */
export function derivePreTaxPrice(
  priceWithTax: number,
  taxRatePercent: number,
  currencyCode: string = DEFAULT_CURRENCY,
): number {
  if (priceWithTax < 0) {
    throw new Error(`Price with tax must be non-negative, got ${priceWithTax}`);
  }
  if (taxRatePercent < 0) {
    throw new Error(`Tax rate must be non-negative, got ${taxRatePercent}`);
  }
  const priceWithTaxMinor = toMinorUnits(priceWithTax, currencyCode);
  // preTax = priceWithTax / (1 + taxRate/100) = priceWithTax * 100 / (100 + taxRate)
  const preTaxMinor = Math.round(priceWithTaxMinor * 100 / (100 + taxRatePercent));
  return fromMinorUnits(preTaxMinor, currencyCode);
}

/**
 * Given a pre-tax unit price, derive the tax-inclusive unit price.
 *
 * Rounding: round to nearest centime.
 * Validates: preTaxPrice must be >= 0, taxRatePercent must be >= 0.
 */
export function deriveTaxInclPrice(
  preTaxPrice: number,
  taxRatePercent: number,
  currencyCode: string = DEFAULT_CURRENCY,
): number {
  if (preTaxPrice < 0) {
    throw new Error(`Pre-tax price must be non-negative, got ${preTaxPrice}`);
  }
  if (taxRatePercent < 0) {
    throw new Error(`Tax rate must be non-negative, got ${taxRatePercent}`);
  }
  const preTaxMinor = toMinorUnits(preTaxPrice, currencyCode);
  const taxInclMinor = Math.round(preTaxMinor * (100 + taxRatePercent) / 100);
  return fromMinorUnits(taxInclMinor, currencyCode);
}

// ─── Validation ──────────────────────────────────────────────────────

/**
 * Check if a currency code is supported.
 */
export function isSupportedCurrency(code: string): boolean {
  return code.toUpperCase() in CURRENCIES;
}

/**
 * Safely parse a user-input string to a decimal number.
 * Handles common formats:
 * - Standard: "1000.50"
 * - Comma thousands separator: "1,000.50" or "1,000,000.50"
 * - European/French: "1000,50" (comma as decimal separator)
 * - French with spaces: "1 000,50"
 * Returns null if the input is not a valid number.
 */
export function parseAmount(input: string): number | null {
  if (!input || input.trim() === '') return null;

  let cleaned = input.trim();

  // Determine format by analyzing separator positions and patterns
  const lastComma = cleaned.lastIndexOf(',');
  const lastPeriod = cleaned.lastIndexOf('.');

  if (lastComma === -1 && lastPeriod === -1) {
    // No separators — just remove spaces and parse
    cleaned = cleaned.replace(/\s/g, '');
  } else if (lastComma > lastPeriod) {
    // Comma comes after period (or no period exists)
    // Check if this is European decimal comma or thousands comma
    const afterLastComma = cleaned.substring(lastComma + 1).replace(/\s/g, '');
    if (lastPeriod !== -1) {
      // Has both: "1.000,50" → European (period=thousands, comma=decimal)
      cleaned = cleaned.replace(/[.\s]/g, '').replace(',', '.');
    } else if (afterLastComma.length === 3 && /^[\d\s]+$/.test(cleaned.substring(0, lastComma))) {
      // No period, comma followed by exactly 3 digits → thousands separator
      // e.g. "1,000" or "1,000,000"
      cleaned = cleaned.replace(/[, \s]/g, '');
    } else {
      // No period, comma followed by 1-2 digits → decimal separator
      // e.g. "1000,50" or "33,33"
      cleaned = cleaned.replace(/[\s.]/g, '').replace(',', '.');
    }
  } else {
    // Period comes after comma (or no comma exists)
    // Standard format: comma is thousands separator, period is decimal
    cleaned = cleaned.replace(/[,\s]/g, '');
  }

  const parsed = parseFloat(cleaned);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
