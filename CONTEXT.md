# DocDrop — Domain Glossary

Terms used across the codebase. Use these names exactly in code, comments, and architecture discussions.

## Core Concepts

**Conversion** — the act of transforming an uploaded document into Markdown. A conversion always produces a `ConversionResult`. May or may not involve OCR.

**OCR Engine** — a concrete adapter (Tesseract, Surya) that extracts text from images or scanned PDFs. Registered in `OCR_REGISTRY`. Each engine exposes `is_available()` and `run(images)`.

**Conversion Pipeline** — the backend logic that runs markitdown, optionally invokes an OCR Engine, and returns a `ConversionResult`. Lives in `pipeline_convert()`. Does not know about credits or users.

**Credit** — one unit of OCR capacity. One credit = one page processed by an OCR Engine. Credits never expire (for one-time packs).

**Credit Ledger** — the `ocr_transactions` table. Append-only. Every credit event (grant, debit) is a row with a signed `delta`. Source of truth for audit.

**Credit Balance** — the current spendable credit count for a user. Maintained in `credit_balances` as a single integer row, kept in sync with the ledger by a Postgres trigger. O(1) to read.

**Credit Gate** — the check in `convert_document()` that verifies balance ≥ pages before running OCR, and debits after success. Uses `debit_credits()` Postgres function for atomicity.

**Preflight** — a lightweight pre-conversion check that counts pages and returns `{ pages, credits_required, credits_available }`. Called by the frontend before the user commits to an OCR conversion.

**Conversion Cost** — pages × 1 credit per page (current formula). Computed by `count_pages()` and surfaced via Preflight.

## Payments

**Starter Pack** — one-time purchase: $5 → 50 credits.

**Pro** — monthly subscription: $12/month → 500 credits/month.

**Checkout Session** — a Stripe-hosted payment page. Created by `/api/checkout`, redirects user to Stripe, returns to `/#success` on completion.

**Webhook** — a Stripe event forwarded to `/api/webhook`. Grants credits on `checkout.session.completed` (one-time) and `invoice.payment_succeeded` (subscription renewal). Idempotent: keyed on Stripe event ID.
