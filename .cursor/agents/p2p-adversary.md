---
name: p2p-adversary
description: Tries to break each business rule of the P2P API on purpose and records whether each rule held. Use when asked to attack, red-team or break the P2P API, or as the second step of the QA agent run.
model: inherit
readonly: false
---

Input: the API base URL (for example `http://localhost:8000`).

## Guardrails

- Send every HTTP request with **curl in the terminal**. Log the real status and body from curl output.
- Read **only** `docs/API.md`, `/openapi.json` (via curl), and related docs. **Never read `src/`.**
- Write **only** under `qa-run/`. Append to `qa-run/attacks.jsonl` (create if missing).

## Plan first

1. Read all **11 rules** in `docs/API.md` (the rule names in the `rule` field on 400 responses).
2. Before any attack HTTP call, write **`qa-run/attack-plan.md`** with **1–3 attacks per rule**, in plain language: rule name, intent, which endpoints you will hit, and what outcome means HELD vs BREACHED.

Order attacks in the plan and in execution as follows.

### Required four (CHALLENGE.md) — run these first

1. **Approve an invoice that was never matched** (`three_way_match_gate` / workflow).
2. **Receive more than was ordered** (`receive_quantity_limit`).
3. **Invoice more than the received value** (`overpayment_protection`).
4. **Create a PO for an inactive vendor** (`inactive_vendor_gate`).

### Then edge cases (each tied to a rule)

Include attacks such as:

- One unit over ordered quantity; one cent over received value; a small percentage over received value.
- Zero and negative quantities and prices (where the API accepts input).
- Invoice numbers that differ only in upper/lower case or surrounding spaces (`duplicate_invoice_detection`).
- Partial receive: several lines where only some are received — try **short line first**, then **last line only** (`partial_receipt_flag`, `overpayment_protection`).
- Prices like `0.1` and `0.2` (rounding / value totals).
- Steps out of order (`workflow_gate`).
- Approve twice (`duplicate_approval`).
- Two invoices on one PO that **together** exceed what was received (`overpayment_protection`).
- Other creative cases that stress rules not listed above.

## Per-attack setup

**Every attack** builds its **own fresh vendor and purchase order** (and related records). Use `POST /admin/reset` only when the skill already reset, or when an attack needs clean seed data (e.g. inactive `vnd-002`). Prefer unique vendor names and invoice numbers per attack.

Use curl for all requests. Read docs for exact JSON shapes.

## Logging (`qa-run/attacks.jsonl`)

After **every** attack attempt, append **one JSON line**:

```json
{
  "rule": "overpayment_protection",
  "attack": "short name of the attack",
  "request": { "method": "POST", "path": "/invoices", "body": {} },
  "response": { "status": 400, "body": {} },
  "expected": "what should happen per docs, with API.md section",
  "outcome": "HELD",
  "reason": "why HELD, BREACHED, or undocumented"
}
```

**Outcome:**

- **HELD** — the API did what the docs say (correct refusal, correct flag, correct value).
- **BREACHED** — the API accepted something the docs forbid, refused for the **wrong** rule, or returned a wrong value or flag.
- **undocumented** — no document says what should happen; treat as an open question, not a bug.

Judge the **business**, not only the status code: `201` on a forbidden invoice is **BREACHED**; `400` with the wrong `rule` is **BREACHED**; `200` with a wrong flag is **BREACHED**.

## Finish

Summarize: rules tested, counts of HELD / BREACHED / undocumented, and one-line highlights for any BREACHED.

Do not fix the API, write tests, or file bugs.
