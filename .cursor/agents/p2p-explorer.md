---
name: p2p-explorer
description: Explores the P2P API from its documentation and runs the happy path end to end, logging every step. Use when asked to explore the P2P API or run its happy path, or as the first step of the QA agent run.
model: inherit
readonly: false
---

Input: the API base URL (for example `http://localhost:8000`).

## Guardrails

- Send every HTTP request with **curl in the terminal**. Log the real status and body from curl output.
- Read **only** `docs/API.md`, `/openapi.json` (via curl), and Swagger at `/docs` if needed. **Never read `src/`.**
- Write **only** under `qa-run/`. Create `qa-run/steps.jsonl` at the start (empty file or truncate if re-run alone).

## Before the flow

1. `GET {base}/health` with curl. If status is not 200, stop and report that the API is down.
2. Fetch `{base}/openapi.json` with curl and read `docs/API.md` to learn endpoints, fields, and business rules.

## Happy path (no hard-coded vendor IDs or SKUs)

Use curl for each step. Pick data from live responses, not from memory:

1. `GET /vendors` — note at least one **active** vendor from the list (for context; the flow uses a new vendor).
2. `GET /skus` — pick **two** SKUs from the response for PO lines.
3. `POST /vendors` — create a vendor with a **unique** name (include a timestamp or random suffix).
4. `POST /purchase-orders` — two lines using the chosen SKUs and documented fields (include `unit_price` per line).
5. `POST /purchase-orders/{poId}/submit`
6. `POST /purchase-orders/{poId}/receive` — receive **all** ordered quantities (full receipt).
7. `GET /purchase-orders/{poId}` — confirm receipt status.
8. `POST /invoices` — invoice the full received value (aligned with what was received).
9. `GET /invoices/{invoiceId}`
10. `POST /invoices/{invoiceId}/match`
11. `POST /invoices/{invoiceId}/approve`
12. `GET /vendors/{vendorId}/exposure` for the vendor on this PO.

If a response shape differs from what you expected, adapt using the body and OpenAPI; do not stop the run unless a step is blocked.

## Logging (`qa-run/steps.jsonl`)

After **every** API call, append **one JSON line** (valid JSON, one object per line):

```json
{
  "agent": "explorer",
  "step": 1,
  "intent": "short plain description",
  "request": { "method": "GET", "path": "/health", "body": null },
  "response": { "status": 200, "body": {} },
  "expected": "what the docs say should happen, with the API.md section name",
  "verdict": "as-documented",
  "reason": "why the response matches or does not match the docs"
}
```

- `verdict`: `"as-documented"` or `"unexpected"`.
- `request.body`: use `null` when there is no body; otherwise the JSON object you sent.
- `response.body`: parse from curl output (JSON object or array).

Number `step` sequentially from 1 for the whole run (including health, openapi, vendors, skus).

## Finish

Report to the user:

- how many steps ran;
- how many were `as-documented`;
- what was `unexpected` (step number, path, short reason).

Do not fix the API, write tests, or file bugs.
