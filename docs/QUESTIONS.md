# Documentation cross-check (API.md vs OpenAPI)

Sources: `docs/API.md` and `GET http://localhost:8000/openapi.json` (Swagger UI at `/docs` on that same host/port shows the same document). No endpoints were called except that OpenAPI fetch. No `src/` was read.

**Port note (inspected only):** Compared `GET http://localhost:8000/openapi.json` and `GET http://localhost:8002/openapi.json` — every path, schema, and description matches; only `servers[0].url` differs (`8000` vs `8002`). Using port 8002 would not change sections 1, 3, or 4 below; section 2’s `servers` bullet must match whichever port served the JSON.

---

## 1. In both documents

Facts both sources state, with where each appears.

- There is no authentication on this local practice API. — API.md: *Basics*; OpenAPI: `info.description` — **inspected only**
- Data lives in memory and returns to seed state on restart or `POST /admin/reset`. — API.md: *Basics*, *System*; OpenAPI: `info.description`, `POST /admin/reset` — **inspected only**
- Rejected requests return JSON with a `detail` string and a `rule` string; `404` responses do not include `rule`. — API.md: *Errors*; OpenAPI: `components.schemas.Error`, `info.description` — **inspected only**
- Money amounts are in dollars, rounded to cents (two decimal places). — API.md: *Basics*; OpenAPI: amount field descriptions on `VendorExposure`, `Sku`, `PoLine`, `PurchaseOrder`, `MatchResult`, `GlLine`, `ApproveResult`, `Invoice` — **inspected only**
- `GET /health` returns a body whose `status` is `ok`. — API.md: *Endpoints → System*; OpenAPI: `GET /health`, schema `Health` — **inspected only**
- `POST /admin/reset` clears purchase orders, invoices, and created vendors and restores seed vendors and the SKU catalog; response body has `status` `reset`. — API.md: *Endpoints → System*; OpenAPI: `POST /admin/reset`, schema `Reset` — **inspected only**
- `GET /vendors` lists all vendors. — API.md: *Endpoints → Vendors*; OpenAPI: `GET /vendors` — **inspected only**
- `POST /vendors` creates a vendor; `name` is required and non-empty; `active` is optional and defaults to `true`; success is `201`. — API.md: *Endpoints → Vendors*; OpenAPI: `POST /vendors`, schema `VendorCreate` — **inspected only**
- `GET /vendors/{vendorId}/exposure` returns what the business owes that vendor; unknown vendor → `404`. — API.md: *Endpoints → Vendors*; OpenAPI: `GET /vendors/{vendorId}/exposure` — **inspected only**
- Vendor exposure (`open_ap_liability`) is the sum of `total_amount` over that vendor’s approved invoices (rule `vendor_exposure_math`). — API.md: *Business rules* #11, *Endpoints → Vendors*; OpenAPI: `GET /vendors/{vendorId}/exposure` description — **inspected only**
- `GET /skus` lists the SKU catalog with catalog prices. — API.md: *Endpoints → Catalog*; OpenAPI: `GET /skus` — **inspected only**
- Purchase order statuses are `draft`, then `submitted`, then `closed`. — API.md: *The purchase-to-pay flow*; OpenAPI: schema `PurchaseOrder.status` — **inspected only**
- Invoice statuses are `received`, then `matched`, then `approved`. — API.md: *The purchase-to-pay flow*; OpenAPI: schema `Invoice.status` — **inspected only**
- `POST /purchase-orders` creates a draft purchase order; success is `201`; vendor must exist (`404`) and be active (rule `inactive_vendor_gate`). — API.md: *Endpoints → Purchase orders*; OpenAPI: `POST /purchase-orders` — **inspected only**
- Each SKU may appear only once on a purchase order. — API.md: *Endpoints → Purchase orders*; OpenAPI: `POST /purchase-orders` description — **inspected only**
- Line `quantity` must be greater than 0 and at most 10,000; `unit_price` is from 0 to 100,000 (same limits called out for deliveries and invoice lines in API.md). — API.md: *Endpoints → Purchase orders*; OpenAPI: `PoLineCreate`, receive item quantity, `InvoiceLine` — **inspected only**
- `GET /purchase-orders/{poId}` returns the purchase order. — API.md: *Endpoints → Purchase orders*; OpenAPI: `GET /purchase-orders/{poId}` — **inspected only**
- `POST /purchase-orders/{poId}/submit` moves a draft to `submitted` (rule `workflow_gate`). — API.md: *Endpoints → Purchase orders*; OpenAPI: `POST /purchase-orders/{poId}/submit` — **inspected only**
- `POST /purchase-orders/{poId}/receive` records delivery on a submitted PO; received quantity per line cannot exceed ordered quantity (rule `receive_quantity_limit`); PO closes when every line is fully received. — API.md: *Endpoints → Purchase orders*; OpenAPI: `POST /purchase-orders/{poId}/receive` — **inspected only**
- `POST /invoices` creates an invoice against a PO with success `201`; rules `overpayment_protection`, `duplicate_invoice_detection`, `invoice_line_validation`, and `workflow_gate` apply. — API.md: *Endpoints → Invoices*; OpenAPI: `POST /invoices` — **inspected only**
- Invoice numbers are unique per vendor, compared case-insensitively with surrounding spaces ignored (rule `duplicate_invoice_detection`). — API.md: *Business rules* #6; OpenAPI: `POST /invoices` description — **inspected only**
- `GET /invoices/{invoiceId}` returns the invoice. — API.md: *Endpoints → Invoices*; OpenAPI: `GET /invoices/{invoiceId}` — **inspected only**
- `POST /invoices/{invoiceId}/match` runs the 3-way match; `partial_receipt` is `true` when any PO line is not fully received (rule `partial_receipt_flag`); an approved invoice cannot be matched again (rule `workflow_gate`). — API.md: *Endpoints → Invoices*, *Business rules* #5; OpenAPI: `POST /invoices/{invoiceId}/match` — **inspected only**
- `POST /invoices/{invoiceId}/approve` requires a prior match (rule `three_way_match_gate`), allows only one approval (rule `duplicate_approval`), and posts a balanced ledger entry (rule `gl_balance`). — API.md: *Endpoints → Invoices*, *Business rules* #4, #7, #9; OpenAPI: `POST /invoices/{invoiceId}/approve` — **inspected only**
- Approval debits `5000 Materials Expense` and credits `2000 Accounts Payable`. — API.md: *Endpoints → Invoices* (approve example); OpenAPI: `POST /invoices/{invoiceId}/approve` description — **inspected only**
- HTTP success for mutations that return a resource is `200`; creation endpoints return `201`; validation and business-rule failures return `400`; missing records or routes return `404`. — API.md: *Errors*; OpenAPI: response codes on each path — **inspected only**
- The eleven named business rules plus `validation_error` appear as possible `rule` values on errors. — API.md: *Errors*, *Business rules*; OpenAPI: `components.schemas.Error.properties.rule.enum` — **inspected only**
- New invoices start with `status` `received`, `matched` `false`, and `partial_receipt` `null` until matched. — API.md: *Endpoints → Invoices*; OpenAPI: schema `Invoice`, `partial_receipt` description — **inspected only**
- Purchase order responses include `ordered_value`, `received_value`, `fully_received`, and per-line `received_quantity`. — API.md: *Endpoints → Purchase orders*; OpenAPI: schema `PurchaseOrder`, `PoLine` — **inspected only**

---

## 2. In one document only

- The base URL is `http://localhost:8000`, and you can run on another port with `PORT=8001 npm start`. — **API.md only** (*Basics*) — **inspected only**
- Clients must send `Content-Type: application/json` on every request body. — **API.md only** (*Basics*) — **inspected only**
- The eight-step purchase-to-pay narrative (pick vendor → create PO → submit → receive → invoice → match → approve → check exposure). — **API.md only** (*The purchase-to-pay flow*) — **inspected only**
- After start or reset, seed data is exactly two vendors (`vnd-001` active, `vnd-002` inactive) and five SKUs with fixed IDs and catalog prices. — **API.md only** (*Seed data*) — **inspected only**
- Server-generated ID prefixes: `vnd-…`, `po-…`, `inv-…` (seed vendors use fixed IDs). — **API.md only** (*Basics*) — **inspected only**
- The human-readable promise behind each of the eleven rules (table with “The API promises that…”). — **API.md only** (*Business rules*) — **inspected only**
- Use `POST /admin/reset` before every test run; a full `curl` session and `npm run smoke` run the happy path. — **API.md only** (*Endpoints → System*, *A full session with curl*) — **inspected only**
- A PO line’s `description` is optional on create; catalog is reference only and the PO carries its own `unit_price`. — **API.md only** (*Seed data*, *Endpoints → Purchase orders*) — **inspected only**
- On receive, every SKU in the delivery must be on the PO. — **API.md only** (*Endpoints → Purchase orders*) — **inspected only**
- Overpayment protection allows no tolerance (rule `overpayment_protection`). — **API.md only** (*Business rules* #3) — **inspected only**
- PO and invoice statuses only move forward (no backward transitions). — **API.md only** (*The purchase-to-pay flow*) — **inspected only**
- OpenAPI document metadata: `openapi` `3.1.0`, `info.title` “P2P Practice API”, `info.version` `1.0.0`. — **OpenAPI only** (`info`) — **inspected only**
- `servers[0].url` is the base URL of the running instance that served the document (for example `http://localhost:8000` or `http://localhost:8002`); OpenAPI does not list alternate ports the way API.md describes `PORT=8001`. — **OpenAPI only** (`servers`) — **inspected only**
- Request schemas enforce `minLength`, `minItems`, `exclusiveMinimum` on quantities, and defaults (`active` `true`, line `description` `""`). — **OpenAPI only** (`VendorCreate`, `PurchaseOrderCreate`, `PoLineCreate`, `ReceiveRequest`, etc.) — **inspected only**
- Operation tags group endpoints: System, Vendors, Catalog, Purchase orders, Invoices. — **OpenAPI only** (`paths.*.tags`) — **inspected only**
- Path parameter names in the spec: `vendorId`, `poId`, `invoiceId`. — **OpenAPI only** (`parameters`) — **inspected only**
- `POST /admin/reset` success is explicitly HTTP `200`. — **OpenAPI only** (`POST /admin/reset` responses) — **inspected only**
- Invoice responses always include `vendor_id` and `total_amount` in the `Invoice` schema. — **OpenAPI only** (schema `Invoice`) — **inspected only**
- `MatchResult` response always has `status` `matched` and `matched` `true` on success. — **OpenAPI only** (schema `MatchResult`) — **inspected only**
- `ApproveResult` response always has `status` `approved` on success. — **OpenAPI only** (schema `ApproveResult`) — **inspected only**

---

## 3. Conflicts

None found.

---

## 4. Not documented

Questions neither document answers clearly. Each is marked **assumed until answered**.

- Are line `quantity` values required to be whole numbers, or are fractional quantities (for example `10.5`) allowed and how are they rounded? — **assumed until answered** — **inspected only**
- What is the maximum length for vendor `name`, invoice `invoice_number`, SKU strings, and line `description`? — **assumed until answered** — **inspected only**
- What happens if the same `POST` is sent twice in a row (for example submit an already-submitted PO, approve an already-approved invoice, or create two invoices with the same normalized invoice number)? — **assumed until answered** — **inspected only**
- Is `POST /admin/reset` idempotent, and what is the exact response if reset is called when the store is already at seed state? — **assumed until answered** — **inspected only**
- Can a PO line use a `sku` that is not in `GET /skus`, or must every SKU exist in the catalog first? — **assumed until answered** — **inspected only**
- How are `ordered_value`, `received_value`, `invoice_total`, and `total_amount` computed when unit prices or quantities have more than two decimal places before rounding? — **assumed until answered** — **inspected only**
- Can `POST /purchase-orders/{poId}/receive` be called with an empty `items` array, duplicate SKUs in one delivery, or zero-quantity lines? — **assumed until answered** — **inspected only**
- What is the behavior when matching or approving an invoice that is already `matched` but not yet `approved` (second `match` call)? — **assumed until answered** — **inspected only**
- Is there a way to list all purchase orders or all invoices, or only get-by-id? — **assumed until answered** — **inspected only**
- Are there delete or update endpoints for vendors, POs, or invoices after creation? — **assumed until answered** — **inspected only**
- What charset or Unicode normalization applies to vendor names and invoice numbers for duplicate detection? — **assumed until answered** — **inspected only**
- Under concurrent requests from multiple clients, is any locking or last-write-wins behavior defined? — **assumed until answered** — **inspected only**
- For partial receipts across multiple `receive` calls, is there a documented order of operations or limit on number of deliveries per PO? — **assumed until answered** — **inspected only**
- What exact `detail` message and `rule` are returned for each failure mode (for example over-receipt vs wrong workflow step)—are messages stable for assertions? — **assumed until answered** — **inspected only**
- Does `GET /vendors/{vendorId}/exposure` include only approved invoices, and how does it behave for a vendor with no approved invoices? — **assumed until answered** — **inspected only** (API.md gives shape and rule; edge case behavior is not fully specified)
- When the API runs on a non-default port, should tests and tools use `servers[0].url` from OpenAPI, the base URL in API.md (`8000`), or always the port from the environment where the server was started? — **assumed until answered** — **inspected only**
- Overpayment protection has “no tolerance” in API.md (rule 3); neither document defines numeric tolerance or rounding slack for the 3-way match. — **assumed until answered** — **inspected only**
