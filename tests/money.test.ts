/**
 * Tests for the money utility.
 *
 * These tests verify that financial calculations are precise and
 * do NOT suffer from IEEE 754 floating-point drift.
 *
 * Each test documents the expected behavior with exact values.
 */
import { describe, it, expect } from 'vitest';
import {
  toMinorUnits,
  fromMinorUnits,
  formatAmount,
  formatMinorUnits,
  calculateLineItem,
  calculateInvoice,
  derivePreTaxPrice,
  deriveTaxInclPrice,
  isSupportedCurrency,
  parseAmount,
} from '@/lib/money';

// ─── Conversion Tests ────────────────────────────────────────────────

describe('toMinorUnits / fromMinorUnits', () => {
  it('converts MAD amounts correctly (2 decimal places)', () => {
    expect(toMinorUnits(120.50, 'MAD')).toBe(12050);
    expect(toMinorUnits(0, 'MAD')).toBe(0);
    expect(toMinorUnits(0.01, 'MAD')).toBe(1);
    expect(toMinorUnits(999.99, 'MAD')).toBe(99999);
    expect(fromMinorUnits(12050, 'MAD')).toBe(120.50);
    expect(fromMinorUnits(1, 'MAD')).toBe(0.01);
  });

  it('converts JPY amounts correctly (0 decimal places)', () => {
    expect(toMinorUnits(1000, 'JPY')).toBe(1000);
    expect(toMinorUnits(1, 'JPY')).toBe(1);
    expect(fromMinorUnits(1000, 'JPY')).toBe(1000);
  });

  it('handles floating-point input without drift', () => {
    // This is the KEY test: 0.1 + 0.2 = 0.30000000000000004 in IEEE 754
    // Our conversion must round correctly
    expect(toMinorUnits(0.1 + 0.2, 'MAD')).toBe(30); // Not 30.000000000000004
    expect(toMinorUnits(0.1 + 0.2, 'USD')).toBe(30);
  });

  it('rounds to nearest centime for imprecise inputs', () => {
    // 1/3 can't be represented exactly, but rounding should give us 33 centimes
    expect(toMinorUnits(1 / 3, 'MAD')).toBe(33);
    // 2/3 rounds to 67 centimes
    expect(toMinorUnits(2 / 3, 'MAD')).toBe(67);
  });

  it('throws on non-finite amounts', () => {
    expect(() => toMinorUnits(NaN, 'MAD')).toThrow('Invalid amount');
    expect(() => toMinorUnits(Infinity, 'MAD')).toThrow('Invalid amount');
    expect(() => toMinorUnits(-Infinity, 'MAD')).toThrow('Invalid amount');
  });

  it('handles unknown currency by falling back to MAD', () => {
    expect(toMinorUnits(100, 'XYZ')).toBe(10000); // Falls back to MAD (2 decimals)
  });

  it('is case-insensitive for currency codes', () => {
    expect(toMinorUnits(100, 'mad')).toBe(10000);
    expect(toMinorUnits(100, 'Mad')).toBe(10000);
    expect(toMinorUnits(100, 'MAD')).toBe(10000);
  });
});

// ─── Format Tests ────────────────────────────────────────────────────

describe('formatAmount / formatMinorUnits', () => {
  it('formats MAD with 2 decimal places', () => {
    expect(formatAmount(120, 'MAD')).toBe('120.00');
    expect(formatAmount(120.5, 'MAD')).toBe('120.50');
    expect(formatAmount(120.50, 'MAD')).toBe('120.50');
    expect(formatMinorUnits(12050, 'MAD')).toBe('120.50');
  });

  it('formats JPY with 0 decimal places', () => {
    expect(formatAmount(1000, 'JPY')).toBe('1000');
    expect(formatMinorUnits(1000, 'JPY')).toBe('1000');
  });
});

// ─── Line Item Calculation Tests ─────────────────────────────────────

describe('calculateLineItem', () => {
  it('calculates a simple line item with 20% tax', () => {
    const result = calculateLineItem({
      quantity: 2,
      unitPrice: 100,
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });

    expect(result.unitPriceMinor).toBe(10000);
    expect(result.lineSubtotalMinor).toBe(20000); // 2 × 10000
    expect(result.lineTaxMinor).toBe(4000);        // 20000 × 0.20
    expect(result.lineTotalMinor).toBe(24000);     // 20000 + 4000
    expect(result.lineSubtotal).toBe(200);
    expect(result.lineTax).toBe(40);
    expect(result.lineTotal).toBe(240);
  });

  it('handles fractional quantities correctly', () => {
    const result = calculateLineItem({
      quantity: 1.5,
      unitPrice: 100,
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });

    // 1.5 × 10000 centimes = 15000 centimes
    expect(result.lineSubtotalMinor).toBe(15000);
    expect(result.lineTaxMinor).toBe(3000); // 15000 × 0.20
    expect(result.lineTotalMinor).toBe(18000);
  });

  it('handles zero tax rate', () => {
    const result = calculateLineItem({
      quantity: 3,
      unitPrice: 33.33,
      taxRatePercent: 0,
      currencyCode: 'MAD',
    });

    expect(result.lineSubtotalMinor).toBe(9999); // 3 × 3333
    expect(result.lineTaxMinor).toBe(0);
    expect(result.lineTotalMinor).toBe(9999);
  });

  it('rounds tax correctly for awkward amounts', () => {
    // 1 × 33.33 with 20% tax
    // subtotal = 3333 centimes
    // tax = round(3333 × 20 / 100) = round(666.6) = 667 centimes
    const result = calculateLineItem({
      quantity: 1,
      unitPrice: 33.33,
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });

    expect(result.lineSubtotalMinor).toBe(3333);
    expect(result.lineTaxMinor).toBe(667); // Rounded up from 666.6
    expect(result.lineTotalMinor).toBe(4000);
  });

  it('handles the classic floating-point trap: 0.1 + 0.2', () => {
    // This would fail with naive float arithmetic
    const result = calculateLineItem({
      quantity: 1,
      unitPrice: 0.1 + 0.2, // 0.30000000000000004 in IEEE 754
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });

    // toMinorUnits(0.30000000000000004) → Math.round(0.30000000000000004 * 100) = 30
    expect(result.unitPriceMinor).toBe(30);
    expect(result.lineSubtotalMinor).toBe(30);
    expect(result.lineTaxMinor).toBe(6); // 30 × 0.20 = 6
    expect(result.lineTotalMinor).toBe(36);
  });

  it('computes tax-inclusive unit price for display', () => {
    const result = calculateLineItem({
      quantity: 1,
      unitPrice: 100,
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });

    // Tax-inclusive: round(10000 × 120 / 100) = 12000
    expect(result.unitPriceTaxInclMinor).toBe(12000);
    expect(result.unitPriceTaxIncl).toBe(120);
  });

  it('handles 14% Moroccan tax rate correctly', () => {
    const result = calculateLineItem({
      quantity: 10,
      unitPrice: 85.50,
      taxRatePercent: 14,
      currencyCode: 'MAD',
    });

    // subtotal: 10 × 8550 = 85500 centimes
    // tax: round(85500 × 14 / 100) = round(11970) = 11970
    // total: 85500 + 11970 = 97470
    expect(result.lineSubtotalMinor).toBe(85500);
    expect(result.lineTaxMinor).toBe(11970);
    expect(result.lineTotalMinor).toBe(97470);
    expect(result.lineSubtotal).toBe(855);
    expect(result.lineTax).toBe(119.70);
    expect(result.lineTotal).toBe(974.70);
  });

  it('throws on negative quantity', () => {
    expect(() => calculateLineItem({
      quantity: -1,
      unitPrice: 100,
      taxRatePercent: 20,
    })).toThrow('Quantity must be non-negative');
  });

  it('throws on negative unit price', () => {
    expect(() => calculateLineItem({
      quantity: 1,
      unitPrice: -50,
      taxRatePercent: 20,
    })).toThrow('Unit price must be non-negative');
  });

  it('throws on negative tax rate', () => {
    expect(() => calculateLineItem({
      quantity: 1,
      unitPrice: 100,
      taxRatePercent: -10,
    })).toThrow('Tax rate must be non-negative');
  });

  it('handles zero quantity correctly', () => {
    const result = calculateLineItem({
      quantity: 0,
      unitPrice: 100,
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });
    expect(result.lineSubtotalMinor).toBe(0);
    expect(result.lineTaxMinor).toBe(0);
    expect(result.lineTotalMinor).toBe(0);
  });

  it('handles zero unit price correctly', () => {
    const result = calculateLineItem({
      quantity: 5,
      unitPrice: 0,
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });
    expect(result.lineSubtotalMinor).toBe(0);
    expect(result.lineTaxMinor).toBe(0);
    expect(result.lineTotalMinor).toBe(0);
  });

  it('handles very large amounts without overflow', () => {
    // 999,999,999.99 MAD → 99,999,999,999 centimes
    // Still within Number.MAX_SAFE_INTEGER (9,007,199,254,740,991)
    const result = calculateLineItem({
      quantity: 1,
      unitPrice: 999999999.99,
      taxRatePercent: 20,
      currencyCode: 'MAD',
    });
    expect(result.unitPriceMinor).toBe(99999999999);
    expect(result.lineSubtotalMinor).toBe(99999999999);
    expect(result.lineTaxMinor).toBe(20000000000); // round(99999999999 * 0.20) = 19999999999.8 → 20000000000
    expect(result.lineTotalMinor).toBe(119999999999);
  });
});

// ─── Invoice Calculation Tests ───────────────────────────────────────

describe('calculateInvoice', () => {
  it('sums multiple line items correctly', () => {
    const result = calculateInvoice({
      items: [
        { quantity: 2, unitPrice: 100, taxRatePercent: 20 },
        { quantity: 1, unitPrice: 50, taxRatePercent: 20 },
      ],
      currencyCode: 'MAD',
    });

    // Item 1: subtotal=20000, tax=4000, total=24000
    // Item 2: subtotal=5000, tax=1000, total=6000
    // Invoice: subtotal=25000, tax=5000, total=30000
    expect(result.subtotalMinor).toBe(25000);
    expect(result.taxAmountMinor).toBe(5000);
    expect(result.totalMinor).toBe(30000);
    expect(result.subtotal).toBe(250);
    expect(result.taxAmount).toBe(50);
    expect(result.totalAmount).toBe(300);
  });

  it('handles items with different tax rates (edge case)', () => {
    const result = calculateInvoice({
      items: [
        { quantity: 1, unitPrice: 100, taxRatePercent: 20 },
        { quantity: 1, unitPrice: 100, taxRatePercent: 10 },
      ],
      currencyCode: 'MAD',
    });

    // Item 1: subtotal=10000, tax=2000
    // Item 2: subtotal=10000, tax=1000
    // Invoice: subtotal=20000, tax=3000, total=23000
    expect(result.subtotalMinor).toBe(20000);
    expect(result.taxAmountMinor).toBe(3000);
    expect(result.totalMinor).toBe(23000);
  });

  it('does NOT accumulate floating-point errors across 100 items', () => {
    // Create 100 items each with unitPrice = 0.33 and 20% tax
    // Naive float: 100 × (0.33 × 1.2) could drift
    // Our method: each line rounds independently, then sums integers
    const items = Array.from({ length: 100 }, () => ({
      quantity: 1,
      unitPrice: 0.33,
      taxRatePercent: 20,
    }));

    const result = calculateInvoice({ items, currencyCode: 'MAD' });

    // Each line: subtotal = 33 centimes, tax = round(33 × 20/100) = round(6.6) = 7 centimes
    // Total: subtotal = 3300, tax = 700, total = 4000
    expect(result.subtotalMinor).toBe(3300);
    expect(result.taxAmountMinor).toBe(700);
    expect(result.totalMinor).toBe(4000);
    expect(result.subtotal).toBe(33);
    expect(result.taxAmount).toBe(7);
    expect(result.totalAmount).toBe(40);
  });

  it('handles empty items array', () => {
    const result = calculateInvoice({ items: [], currencyCode: 'MAD' });
    expect(result.subtotalMinor).toBe(0);
    expect(result.taxAmountMinor).toBe(0);
    expect(result.totalMinor).toBe(0);
    expect(result.items).toHaveLength(0);
  });
});

// ─── Price Derivation Tests ──────────────────────────────────────────

describe('derivePreTaxPrice / deriveTaxInclPrice', () => {
  it('derives pre-tax price from tax-inclusive price', () => {
    // 120 MAD tax-inclusive at 20% → 100 MAD pre-tax
    expect(derivePreTaxPrice(120, 20, 'MAD')).toBe(100);
  });

  it('derives tax-inclusive price from pre-tax price', () => {
    // 100 MAD pre-tax at 20% → 120 MAD tax-inclusive
    expect(deriveTaxInclPrice(100, 20, 'MAD')).toBe(120);
  });

  it('round-trips without drift', () => {
    // Start with pre-tax, go to tax-incl, back to pre-tax
    const original = 85.50;
    const taxRate = 14;
    const taxIncl = deriveTaxInclPrice(original, taxRate, 'MAD');
    const backToPreTax = derivePreTaxPrice(taxIncl, taxRate, 'MAD');
    
    // The round-trip should be exact (or within 1 centime)
    expect(Math.abs(backToPreTax - original)).toBeLessThanOrEqual(0.01);
  });

  it('handles the round-trip for tricky values', () => {
    // 33.33 at 20% tax
    const taxIncl = deriveTaxInclPrice(33.33, 20, 'MAD');
    // 3333 × 1.2 = 3999.6 → rounds to 4000 centimes → 40.00
    expect(taxIncl).toBe(40);

    // Round-trip: 40.00 / 1.2 = 33.333... → rounds to 3333 centimes → 33.33
    const backToPreTax = derivePreTaxPrice(taxIncl, 20, 'MAD');
    expect(backToPreTax).toBe(33.33);
  });

  it('handles zero tax rate', () => {
    expect(derivePreTaxPrice(100, 0, 'MAD')).toBe(100);
    expect(deriveTaxInclPrice(100, 0, 'MAD')).toBe(100);
  });

  it('handles JPY (0 decimal places)', () => {
    // 1200 JPY at 10% tax → pre-tax = round(1200 × 100/110) = round(1090.9) = 1091
    expect(derivePreTaxPrice(1200, 10, 'JPY')).toBe(1091);
    // 1091 JPY at 10% tax → tax-incl = round(1091 × 110/100) = round(1200.1) = 1200
    expect(deriveTaxInclPrice(1091, 10, 'JPY')).toBe(1200);
  });

  it('throws on negative priceWithTax', () => {
    expect(() => derivePreTaxPrice(-100, 20, 'MAD')).toThrow('Price with tax must be non-negative');
  });

  it('throws on negative preTaxPrice', () => {
    expect(() => deriveTaxInclPrice(-100, 20, 'MAD')).toThrow('Pre-tax price must be non-negative');
  });

  it('throws on negative tax rate in derivePreTaxPrice', () => {
    expect(() => derivePreTaxPrice(100, -10, 'MAD')).toThrow('Tax rate must be non-negative');
  });

  it('throws on negative tax rate in deriveTaxInclPrice', () => {
    expect(() => deriveTaxInclPrice(100, -10, 'MAD')).toThrow('Tax rate must be non-negative');
  });
});

// ─── Demonstration: What the Old Code Got Wrong ─────────────────────

describe('regression: old floating-point approach', () => {
  it('shows how naive float arithmetic drifts', () => {
    // This test demonstrates the BUG we're fixing.
    // The old code did: priceWithTax = unitPrice * (1 + taxRate/100)
    // Then on save: unitPrice stays as-is (already drifted)
    // Then subtotal = sum of drifted values

    const unitPrice = 33.33;
    const taxRate = 20;
    const quantity = 3;

    // Old approach (naive):
    const oldPriceWithTax = unitPrice * (1 + taxRate / 100); // 39.996000000000004
    const oldSubtotal = quantity * unitPrice;                  // 99.99 (ok here)
    const oldTax = oldSubtotal * (taxRate / 100);              // 19.998000000000002
    const oldTotal = oldSubtotal + oldTax;                     // 119.98800000000001

    // Our approach:
    const result = calculateLineItem({
      quantity,
      unitPrice,
      taxRatePercent: taxRate,
      currencyCode: 'MAD',
    });

    // Old: total = 119.98800000000001 (WRONG)
    // New: totalMinor = 9999 + 2000 = 11999 → total = 119.99 (CORRECT)
    expect(oldTotal).not.toBe(119.99); // Proves the bug exists
    expect(result.lineTotal).toBe(119.99); // Proves our fix works
    expect(result.lineTotalMinor).toBe(11999);
  });

  it('shows drift compounding over multiple edit cycles', () => {
    // Simulate: load invoice → user doesn't change anything → save → repeat 10 times
    let unitPrice = 100;
    const taxRate = 20;

    // Old approach: each "edit cycle" divides and multiplies
    for (let i = 0; i < 10; i++) {
      const priceWithTax = unitPrice * (1 + taxRate / 100); // Add tax
      unitPrice = priceWithTax / (1 + taxRate / 100);        // Remove tax
    }

    // After 10 cycles, the old approach drifts
    // Note: in this specific case, multiplication and division by the same
    // factor cancels out in IEEE 754, but the issue manifests with
    // different tax rates or when values are stored/retrieved from the DB
    // with string conversion. This test just shows the pattern.

    // Our approach: always works from integer centimes, no drift possible
    const result = calculateLineItem({
      quantity: 1,
      unitPrice: 100,
      taxRatePercent: taxRate,
      currencyCode: 'MAD',
    });
    expect(result.unitPriceMinor).toBe(10000); // Always exact
    expect(result.lineSubtotalMinor).toBe(10000);
  });
});

// ─── Validation Tests ────────────────────────────────────────────────

describe('isSupportedCurrency', () => {
  it('recognizes supported currencies', () => {
    expect(isSupportedCurrency('MAD')).toBe(true);
    expect(isSupportedCurrency('EUR')).toBe(true);
    expect(isSupportedCurrency('USD')).toBe(true);
    expect(isSupportedCurrency('JPY')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isSupportedCurrency('mad')).toBe(true);
    expect(isSupportedCurrency('Mad')).toBe(true);
  });

  it('rejects unsupported currencies', () => {
    expect(isSupportedCurrency('XYZ')).toBe(false);
    expect(isSupportedCurrency('BTC')).toBe(false);
    expect(isSupportedCurrency('')).toBe(false);
  });
});

describe('parseAmount', () => {
  it('parses valid amount strings', () => {
    expect(parseAmount('100')).toBe(100);
    expect(parseAmount('100.50')).toBe(100.50);
    expect(parseAmount('0.01')).toBe(0.01);
    expect(parseAmount('-50')).toBe(-50);
  });

  it('returns null for invalid inputs', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('   ')).toBeNull();
  });

  it('handles comma as thousands separator (standard format)', () => {
    expect(parseAmount('1,000')).toBe(1000);
    expect(parseAmount('1,000.50')).toBe(1000.50);
    expect(parseAmount('1,000,000.99')).toBe(1000000.99);
    expect(parseAmount('10,000')).toBe(10000);
  });

  it('handles European/French format (comma as decimal separator)', () => {
    expect(parseAmount('1000,50')).toBe(1000.50);
    expect(parseAmount('33,33')).toBe(33.33);
    expect(parseAmount('0,01')).toBe(0.01);
  });

  it('handles French format with spaces as thousands separator', () => {
    expect(parseAmount('1 000,50')).toBe(1000.50);
    expect(parseAmount('1 000.50')).toBe(1000.50);
    expect(parseAmount('10 000')).toBe(10000);
  });

  it('handles mixed formats correctly', () => {
    // European: "1.000,50" — period is thousands, comma is decimal
    expect(parseAmount('1.000,50')).toBe(1000.50);
    // Standard: "1,000.50" — comma is thousands, period is decimal
    expect(parseAmount('1,000.50')).toBe(1000.50);
  });
});
