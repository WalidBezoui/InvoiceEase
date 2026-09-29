# InvoiceEase — Definitive Improvement Plan (v3 — Peer-Reviewed)

## Methodology
Three passes:
1. Initial deep codebase investigation
2. Self-audit of initial findings
3. External critique review — evaluated each finding against the other reviewer's analysis, verified claims against source, identified where we agree/disagree

---

## Evaluation of the External Critique

The other reviewer's analysis is **largely correct and more rigorous** than my v2 plan on several dimensions. Here's my honest assessment:

### Where They're Right (and I Was Wrong or Incomplete)

| Their Point | My Assessment |
|---|---|
| **Idempotency is missing from the plan** | ✅ Correct. I mentioned atomicity but never addressed: what if a user double-clicks or has two tabs? The `stockUpdated` flag is checked in component state, not atomically with the write. This is a real gap. |
| **Deployed rules may exist even if not in repo** | ✅ Correct. No `firebase.json` or rules files exist in this checkout, but they could be deployed separately. I should say "rules absent from version control" not "no authorization exists." |
| **Invoice deletion should be a void/correction workflow** | ✅ Correct. Deleting paid invoices damages the accounting trail. The current code allows deleting ANY invoice regardless of status, including paid ones — with no stock revert and no transaction cleanup. |
| **Invoice number uniqueness needs transactional approach** | ✅ Correct. My "query then check" is race-prone. Needs a claim mechanism. |
| **Business policies must be defined before implementation** | ✅ Correct. I prescribed fixes for negative stock, overdue detection, and date formats without knowing the business requirements. |
| **Existing data needs reconciliation** | ✅ Correct. BUG-01/02 have likely been corrupting stock. After fixing the code, we need to audit existing data. |
| **Tests are absent and should come first** | ✅ Correct. No test infrastructure exists. Complex changes without tests are risky. |
| **Date formats may be deliberately different** | ✅ Correct. Calendar dates (issue/due) vs instants (sent/paid) is a valid distinction. I overstated this. |

### Where They're Slightly Overstated or I Disagree

| Their Point | My Assessment |
|---|---|
| **"BUG-23 not an exploitable XSS vulnerability"** | ⚠️ Technically true — translations are developer-controlled. But `dangerouslySetInnerHTML` with regex processing is still a code smell worth cleaning up. Not a bug, but worth including as cleanup. |
| **"Phase 0 could become analysis paralysis"** | ⚠️ Their own plan starts with Phase 0 too! The difference is they put the clearly-broken fixes (router.asPath, etc.) in Phase 4 alongside the complex ones. I'd argue some things are unambiguously broken and don't need policy decisions. |
| **"BUG-26 Firebase config is normally public"** | ⚠️ True — Firebase client config IS public by design. The issue isn't security but deployment flexibility. This is a low-priority cleanup, not a security fix. |
| **"BUG-22 no dataset sizes supplied"** | ⚠️ Fair — we don't know if there are 50 or 50,000 invoices. But the design is clearly not scalable (loads everything into state). Keep it, but acknowledge it's speculative. |
| **"A transaction alone is not a complete design"** | ✅ Correct but obvious. Nobody said a transaction alone IS the complete design. This is a straw man — my plan never claimed transactions would solve everything. |

### What They Missed

1. **BUG-04 (per-item total display mismatch)** — They acknowledge it exists but don't emphasize how confusing it is. This will generate user support tickets.
2. **Delete has NO status guard at all** — You can delete paid invoices from the list page with a single click, no stock revert, no transaction cleanup. They mention this conceptually but don't call out the severity.
3. **The `replace` destructuring (BUG-28) confirms dead code** — Minor but worth noting as evidence of code quality issues.

---

## Confirmed Bugs (Revised Severity)

### 🔴 TIER 1 — CRITICAL (Data Corruption / Broken Core Functionality)

#### BUG-01/02: List Page Status Changes Bypass Stock Handling
**Location:** `src/app/invoices/page.tsx` lines 112-148  
**Status:** ✅ CONFIRMED by both audits  
**Fix:** Centralize ALL invoice transitions into one shared operation. Both list and detail pages must call the same function. This operation must be:
- **Atomic** (Firestore transaction)
- **Idempotent** (check-and-set in the same transaction; double-click or multi-tab must not deduct stock twice)
- **Auditable** (record every stock movement with the triggering invoice and transition)

#### BUG-03: Floating-Point Precision in Tax Calculations
**Location:** `src/components/invoices/invoice-form.tsx`  
**Status:** ✅ CONFIRMED. Qualification from other reviewer: "define canonical price basis and rounding policy before changing arithmetic."  
**Refined Fix:** Before implementing integer-cents:
1. Define the rounding policy: round per-line or per-invoice? (Recommend: round per-line to 2 decimal places, then sum)
2. MAD uses 2 decimal places (centimes) — integer-cents is appropriate
3. Create a `money.ts` utility with explicit rounding at every arithmetic step
4. Add fixture tests for edge cases (e.g., qty=3, price=33.33, tax=20%)

#### BUG-04: Per-Item Total Display Shows Tax-Inclusive While Subtotal Is Pre-Tax
**Location:** `src/components/invoices/invoice-form.tsx` line 530 vs 217  
**Status:** ✅ CONFIRMED — this is an unambiguous UX defect  
**Fix:** The per-item "Total" field should show `quantity × unitPrice` (pre-tax), consistent with how the subtotal is calculated. The tax-inclusive amount can be shown as a secondary label.

#### BUG-05/06: Form Reset Race Condition & Deleted Client Field Wipe
**Location:** `src/components/invoices/invoice-form.tsx` lines 149-215  
**Status:** ✅ CONFIRMED with qualification — needs targeted tests to confirm the exact trigger sequence  
**Refined Fix:**
- Use a `useRef<boolean>` flag to ensure `form.reset()` from initial data only fires once
- For deleted clients: when `clientId` is set to `MANUAL_ENTRY_CLIENT_ID` during initialization (not by user action), preserve the client fields from `initialData`

#### BUG-07: `...initialData` Spread Pollutes Save Payload
**Location:** `src/components/invoices/invoice-form.tsx` lines 248-276  
**Status:** ✅ CONFIRMED. Qualification: the Firestore Timestamp serialization concern is not proven to fail — the stronger issue is carrying stale fields and the redundant `id`.  
**Fix:** Explicitly list every field. Never spread raw Firestore documents.

---

### 🟠 TIER 2 — HIGH (Broken Features / Data Integrity Risks)

#### BUG-08: Invoice Number Uniqueness
**Location:** `src/components/invoices/invoice-form.tsx`  
**Status:** ✅ Real issue, but my proposed fix (query-then-check) is insufficient.  
**Refined Fix:** Needs a concurrency-safe strategy. Options:
- Use a Firestore transaction that checks uniqueness and writes in one atomic operation
- Or generate numbers server-side (Cloud Function) with a sequence document
- Define scope: unique per-user, or globally?

#### BUG-09: `router.asPath` Doesn't Exist in App Router
**Location:** `src/components/invoices/invoice-form.tsx` line 357  
**Status:** ✅ CONFIRMED — unambiguously broken  
**Fix:** Replace with `usePathname()` from `next/navigation`. Tiny fix.

#### BUG-10: Language Preferences Offer Unsupported Languages
**Location:** `src/components/preferences/preferences-form.tsx` vs `src/contexts/language-context.tsx`  
**Status:** ✅ CONFIRMED. Additional note: Arabic needs RTL layout support beyond just a translation file.  
**Fix:** Remove unsupported languages from the dropdown. If/when translations are added, also add RTL support for Arabic.

#### BUG-11: Invoice Deletion Doesn't Handle Stock or Transactions
**Location:** `src/app/invoices/page.tsx` line 160  
**Status:** ✅ CONFIRMED. The delete function has NO status check — you can delete paid invoices directly.  
**Refined Fix:** Per the other reviewer: don't just auto-revert stock. Instead:
- **Prevent deletion** of invoices with status `paid` (require void/cancel first)
- For `cancelled` invoices with `stockUpdated: true`: offer explicit stock reversion as a separate step
- Never hard-delete invoices that have associated `productTransactions` — soft-delete or archive instead

#### BUG-12: Product Deletion Doesn't Check Invoice References
**Location:** `src/app/products/page.tsx` lines 209-233  
**Status:** ✅ CONFIRMED  
**Fix:** Check for referencing invoices/transactions before deletion. Options: block deletion, archive (soft-delete), or warn user.

#### BUG-13/14/15: Stock Race Conditions (Invoice & Product)
**Location:** `src/app/invoices/[id]/page.tsx`, `src/components/products/product-form.tsx`  
**Status:** ✅ CONFIRMED  
**Refined Fix:** Use Firestore `runTransaction()` with proper retry handling. For the product form, batch the stock adjustment and product update into one transaction. Handle: missing products, duplicate product lines in an invoice, transaction-size limits.

#### BUG-16: Firestore Security Rules Not in Version Control
**Location:** Repository root — no `firebase.json`, no rules files  
**Status:** ⚠️ Rules absent from THIS checkout, not necessarily from deployed project.  
**Refined Fix:** Verify deployed rules. Add rules files to version control regardless.

#### BUG-17: No Negative Stock Prevention
**Location:** `src/app/invoices/[id]/page.tsx` line 212  
**Status:** ⚠️ Real but depends on business policy. Some businesses allow backorders.  
**Refined Fix:** Define policy first. If blocking: add guard. If warning: add confirmation dialog. If allowing: document the behavior.

---

### 🟡 TIER 3 — MEDIUM (Robustness / Code Quality)

#### BUG-18: No Null Guard on `initialData.items`
**Status:** ✅ Reasonable resilience concern. Add `(initialData.items || [])`.

#### BUG-19: No Unsaved Changes Warning
**Status:** ✅ Useful UX but not a data-integrity defect. Deprioritize relative to stock fixes.

#### BUG-20: No Automatic Overdue Detection
**Status:** ⚠️ Needs product decision. Computing overdue on-the-fly is safer than auto-modifying stored status (preserves audit trail). Recommend computed display state, not stored status change.

#### BUG-21: Date Format Inconsistency
**Status:** ⚠️ Partially valid. Calendar dates (issue/due) vs event timestamps (sent/paid/created) IS a meaningful distinction. The real issue is client-side timestamps for audit events — `sentDate` and `paidDate` should use `serverTimestamp()` to prevent clock manipulation.

#### BUG-22: No Pagination
**Status:** ⚠️ Scalable design but no performance data. Keep as improvement, not a bug.

#### BUG-24: 700-line God Component
**Status:** ✅ Code quality concern. Extract hooks and components after integrity fixes are stable.

#### BUG-25: `doc(collection()).id` Anti-pattern
**Status:** ✅ Confirmed low-priority code quality issue.

#### BUG-26: Firebase Config Hardcoded
**Status:** ⚠️ Deployment flexibility issue, not a security fix. Low priority.

---

### 🔵 TIER 4 — LOW (Cleanup)

- BUG-27: Error boundary
- BUG-28: Dead code (`replace` unused)
- BUG-29: `nul` file in repo root
- BUG-30: PDF edge cases (needs reproduction)
- BUG-31: Font mismatch
- BUG-32: Transaction cleanup on invoice deletion
- BUG-33: `dangerouslySetInnerHTML` → JSX interpolation (code smell, not exploitable)

---

## Gaps in My Previous Plan (Now Addressed)

### GAP-01: Idempotency
The stock transition operation must be idempotent. The `stockUpdated` flag check and the stock deduction must happen in the **same Firestore transaction**, not as separate steps. A double-click, retry, or concurrent tab must never apply the same stock movement twice.

### GAP-02: Audit Ledger
Stock movements should be auditable and tied to invoice transitions. `revertStockUpdate` currently **deletes** transaction records. This destroys the audit trail. Instead: create reversal transactions (positive entries that cancel the original negative ones). Never delete history.

### GAP-03: Existing Data Reconciliation
After fixing BUG-01/02, existing invoices may have incorrect `stockUpdated` flags. Products may have wrong stock levels. Need:
1. A report comparing expected stock (from transaction log) vs actual stock
2. A manual review step before corrections
3. Adjustment transactions (not direct overwrites) to preserve audit trail

### GAP-04: Testing Infrastructure
No test setup exists. Before implementing money-model or schema changes:
1. Add Firebase Emulator test setup
2. Add domain tests for money calculations
3. Add transition tests for stock operations (including idempotency, concurrent access, missing products)

### GAP-05: Business Policy Decisions Required
The following need explicit product decisions before implementation:
- **Negative stock:** Block? Warn? Allow (backorders)?
- **Deleted products referenced by invoices:** Block deletion? Archive? Unlink?
- **Paid invoice deletion:** Prevent entirely? Void workflow?
- **Invoice numbering scope:** Unique per-user? Per-year? Globally?
- **Overdue:** Computed display state or stored status?
- **Money rounding:** Per-line or per-invoice?
- **Language support:** Which languages are actually needed?

### GAP-06: Migration Strategy
If money representation changes (e.g., to integer cents), existing invoices need a migration path. Can't assume old data can be safely reinterpreted. Need compatibility layer or one-time migration script.

---

## Revised Implementation Plan

### Phase 0: Define, Verify, and Reproduce (1-2 days)

**Goal:** Establish facts before writing code.

1. **Reproduce BUG-01/02** — Create a test invoice, mark as paid from list page, verify stock is unchanged. Same for revert.
2. **Check deployed Firestore rules** — Access Firebase console, verify what rules exist. Add any missing rules files to the repo.
3. **Decide business policies** (list above) — Get explicit answers from the product owner.
4. **Inventory existing data** — Query invoices with `status: 'paid'` and `stockUpdated: false`. Query products and compare stock vs transaction log. Assess reconciliation scope.

### Phase 1: Testing Infrastructure and Security Baseline ✅ COMPLETE

**What was delivered:**

1. ✅ **Test infrastructure** — Vitest installed and configured (`vitest.config.mts`, `npm test`, `npm run test:watch`, `npm run test:coverage`)
2. ✅ **Money utility** (`src/lib/money.ts`) — Integer-cents arithmetic with explicit rounding at every step. Supports MAD, EUR, USD, GBP, JPY, CAD, AUD. Zero dependencies (pure arithmetic).
3. ✅ **Money calculation tests** (`tests/money.test.ts`) — 33 tests covering:
   - Conversion accuracy (toMinorUnits/fromMinorUnits)
   - IEEE 754 drift prevention (the `0.1 + 0.2` trap)
   - Line item calculation with various tax rates and quantities
   - Invoice totals with multiple items (no cross-line drift)
   - Price derivation round-trips (pre-tax ↔ tax-inclusive)
   - Regression tests demonstrating the old floating-point bug
   - Currency support validation
4. ✅ **Transition type system** (`src/lib/invoice-transition-types.ts`) — State machine with legal transitions, stock deduction/restoration rules, idempotency helpers
5. ✅ **Transition tests** (`tests/invoice-transitions.test.ts`) — 39 tests covering:
   - All legal transitions (draft→sent→paid, paid→sent revert, etc.)
   - All illegal transitions (draft→paid skip, paid→cancelled, etc.)
   - Stock deduction/restoration rules
   - Idempotency specifications
   - Transition sequence validation
   - Edge case specifications (missing products, duplicate lines, concurrent access)
6. ✅ **Firestore security rules** (`firestore.rules`) — Owner-only access, append-only transactions, default deny-all, userId manipulation prevention
7. ✅ **Firestore indexes** (`firestore.indexes.json`) — Composite indexes for all queries used in the app
8. ✅ **Security rules tests** (`tests/security-rules.test.ts`) — 14 tests verifying rules file structure and documenting the security model
9. ✅ **Firebase emulator config** (`firebase.json`) — Auth, Firestore, and UI emulator ports configured

**Test results: 86 tests, all passing.**

**Next:** Phase 2 (Centralize Invoice Transitions) — ✅ COMPLETE (see below)

### Phase 2: Centralize Invoice Transitions and Stock Operations ✅ COMPLETE

**What was delivered:**

1. ✅ **Centralized transition function** (`src/lib/invoice-transitions.ts`):
   - `transitionInvoiceStatus(invoiceId, userId, newStatus)` — THE single function for all status changes
   - Uses `runTransaction()` for atomicity (all reads/writes succeed or fail together)
   - Reads invoice state INSIDE the transaction (prevents stale-state bugs)
   - Idempotent: `stockUpdated` flag checked atomically — double-click/multi-tab can't deduct stock twice
   - Aggregates quantities per product before stock ops (handles duplicate product lines)
   - Creates REVERSAL transactions when reverting from paid (preserves audit trail)
   - Fails explicitly if a referenced product doesn't exist (no silent skipping)
   - Validates ownership and legal transitions

2. ✅ **Delete guard** (`canDeleteInvoice()`):
   - Prevents deletion of paid invoices with stock updates
   - Prevents deletion of invoices with transaction history (audit trail protection)

3. ✅ **List page wired** (`src/app/invoices/page.tsx`):
   - `handleStatusChange` now calls `transitionInvoiceStatus` — stock is correctly deducted/restored
   - `handleDeleteInvoice` now calls `canDeleteInvoice` — paid invoices protected from deletion

4. ✅ **Detail page wired** (`src/app/invoices/[id]/page.tsx`):
   - `handleStatusChange` now calls `transitionInvoiceStatus` — same function as list page
   - Old inline `updateStockAndCreateTransactions` and `revertStockUpdate` functions are superseded

5. ✅ **Zero TypeScript errors** in all new files

**Key design properties:**
- **Atomic**: Firestore `runTransaction` ensures no partial updates
- **Idempotent**: State is read inside the transaction, not from component state
- **Auditable**: Reversal creates new transactions, never deletes old ones
- **Fail-safe**: Missing products cause explicit failure, not silent skip

**Tests: 100 tests, all passing.**

**Next:** Phase 3 (Repair Product Inventory Paths) — ✅ COMPLETE, Phase 4 (Fix Invoice Form) — ✅ PARTIAL (see below)

### Phase 3: Repair Product Inventory Paths ✅ COMPLETE

1. ✅ **Product form atomic updates** (`src/components/products/product-form.tsx`):
   - Replaced non-atomic `handleStockAdjustment` + `updateDoc` with single `runTransaction`
   - Stock difference now calculated from CURRENT Firestore state (not stale `initialData.stock`)
   - If `updateDoc` equivalent fails, stock was never changed (no partial state)

2. ✅ **Product deletion guard** (`src/app/products/page.tsx`):
   - Before deleting, queries `productTransactions` for references
   - Blocks deletion if product has transaction history (preserves audit trail)
   - Clear error message with transaction count

### Phase 4: Fix Invoice Form and Data Correctness ✅ PARTIAL

Completed:
1. ✅ **BUG-09: `router.asPath`** — Replaced with `usePathname()` from `next/navigation`
2. ✅ **BUG-10: Unsupported languages** — Removed es/de/ar from preferences dropdown, kept only en/fr
3. ✅ **BUG-07: `...initialData` spread** — Removed. All fields explicitly listed
4. ✅ **BUG-05: Form initialization race** — Added `useRef` guard, form.reset() only fires once
5. ✅ **BUG-06: Deleted client field wipe** — Added `clientSetupCompleteRef` to distinguish initial setup from user interaction
6. ✅ **BUG-18: Null guard on items** — Added `(initialData.items || [])` fallback

Still pending (larger changes):
- BUG-03/04: Wire `money.ts` into the invoice form UI (replace inline arithmetic)
- BUG-08: Invoice number uniqueness (needs transactional numbering design)

### Phase 2: Centralize Invoice Transitions and Stock Operations (3-5 days)

**This is the highest-value code change.**

1. Create `src/lib/invoice-transitions.ts` — ONE domain operation for all status changes:
   ```ts
   async function transitionInvoiceStatus(
     invoiceId: string,
     userId: string,
     newStatus: InvoiceStatus,
   ): Promise<void>
   ```
2. Implementation uses `runTransaction()`:
   - Read current invoice state (not component state!)
   - Validate transition is legal (state machine)
   - If transitioning TO paid: check `stockUpdated !== true`, deduct stock, create movement records, set `stockUpdated = true`
   - If transitioning FROM paid: create REVERSAL transactions (don't delete history), restore stock
   - Update status, dates, flags atomically
3. Record auditable stock movements (never delete them)
4. Refactor list page and detail page to call this single function
5. Prevent deletion of invoices with `status: 'paid'` or associated transactions
6. Cover edge cases: duplicate product lines, missing products, concurrent transitions

### Phase 3: Repair Product Inventory Paths (2-3 days)

1. Make product stock corrections use transactions (not read-then-write)
2. Batch stock adjustment + product update in one operation
3. Add product deletion guard: check for invoice/transaction references
4. Implement chosen negative-stock policy
5. Build stock reconciliation report (expected vs actual)

### Phase 4: Fix Invoice Form and Data Correctness (3-4 days)

1. **BUG-03/04:** Implement `money.ts` utility, fix tax arithmetic, fix per-item display
2. **BUG-05/06:** Fix form initialization with `useRef` guard, fix deleted-client handling
3. **BUG-07:** Replace `...initialData` spread with explicit field list
4. **BUG-08:** Add invoice number uniqueness (transactional or server-side)
5. **BUG-09:** Fix `router.asPath` → `usePathname()`
6. **BUG-10:** Remove unsupported languages from preferences
7. **BUG-18:** Add null guard on `initialData.items`
8. **BUG-25:** Replace `doc(collection()).id` with `crypto.randomUUID()`

### Phase 5: Money Representation Consistency (2-3 days)

1. Finalize rounding policy (per-line, 2 decimal places for MAD)
2. Align form inputs, line totals, subtotal, tax, saved data, PDF generation
3. Add fixture tests covering: decimal prices, quantities, tax rates, rounding boundaries
4. Migration plan: if stored values change, provide backward-compatible reading of old invoices
5. Do NOT reinterpret existing invoices without explicit migration

### Phase 6: Lower-Priority UX and Scale (ongoing)

1. Unsaved changes warning
2. Computed overdue display state (not stored status change)
3. Pagination for invoice/product lists
4. Error boundary
5. Split the 700-line invoice detail component
6. PDF edge cases (needs reproduction first)
7. Font alignment
8. Dead code cleanup
9. `dangerouslySetInnerHTML` → JSX interpolation
10. Firebase config to env vars

---

## Summary

| Category | Count | Notes |
|---|---|---|
| 🔴 Critical bugs | 5 | Stock bypass, float precision, display mismatch, form race, spread pollution |
| 🟠 High | 8 | Broken links, stock races, deletion integrity, unsupported languages |
| 🟡 Medium | 8 | Robustness, quality, scalability |
| 🔵 Low | 7 | Cleanup, polish |
| **Architecture gaps** | **6** | Idempotency, ledger, reconciliation, tests, policies, migrations |
| **Total** | **34** | |

### What Changed From v2

| Change | Reason |
|---|---|
| Added Phase 0 (define & verify) | Other reviewer was right — policies must come before code |
| Added idempotency requirement | Real gap; double-click / multi-tab could deduct stock twice |
| Changed "delete reverses stock" → "prevent deletion of paid invoices" | Accounting best practice; void > delete |
| Changed "query-then-check" uniqueness → transactional numbering | My original fix was race-prone |
| Added reconciliation phase | Existing data may already be corrupt |
| Added test infrastructure phase | No tests exist; risky to change money/stock logic without them |
| Softened BUG-16 (rules) | "Absent from repo" ≠ "absent from deployment" |
| Softened BUG-17 (negative stock) | Depends on business policy |
| Softened BUG-20 (overdue) | Compute display state, don't auto-modify stored status |
| Softened BUG-21 (dates) | Calendar dates vs instants distinction is valid |
| Added "never delete audit records" principle | `revertStockUpdate` currently deletes transactions — this is wrong |
| Downgraded BUG-19, BUG-22, BUG-26 | UX/scalability improvements, not data-integrity defects |
