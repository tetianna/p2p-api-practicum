# Test design: vendors and catalog

Sources: `docs/API.md` (Endpoints → Vendors, Catalog, Seed data, Errors, Basics) and OpenAPI (`GET/POST /vendors`, `GET /skus`, schemas `Vendor`, `VendorCreate`, `Sku`, `Error`).

Scope: `GET /vendors`, `POST /vendors`, `GET /skus` only. (`GET /vendors/{vendorId}/exposure` is a separate area.)

**Test data note:** Per project testing rules, each test creates its own vendors when needed; do not call `POST /admin/reset` inside tests. Seed vendors (`vnd-001`, `vnd-002`) and the five SKUs are documented in API.md *Seed data* and are expected after a fresh server start.

---

## GET /vendors

| ID | type | what we send | expected status | expected body (rule, key values) | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| VND-GET-01 | positive | `GET /vendors` (no body) | 200 | JSON array; every element matches `Vendor` (`id`, `name`, `active` required) | OpenAPI `GET /vendors` → `Vendor[]`; schema `Vendor` | — |
| VND-GET-02 | positive | `GET /vendors` on a fresh API instance | 200 | Array includes seed vendors: `vnd-001` / Maple Ridge Supply / `active: true`; `vnd-002` / Old Quarry Materials / `active: false` | API.md *Seed data*; OpenAPI examples on `Vendor` | — |
| VND-GET-03 | positive | `POST /vendors` with `{"name":"Cedar Point Hardware"}` then `GET /vendors` | 200 | List contains a vendor whose `name` is Cedar Point Hardware and whose `id` matches the `201` response `id` | API.md *Endpoints → Vendors* (list + create) | state |

No `404` or business-rule rows: the list endpoint has no path parameters and no rule in API.md applies to listing.

---

## POST /vendors

| ID | type | what we send | expected status | expected body (rule, key values) | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| VND-POST-01 | positive | `{"name":"Cedar Point Hardware"}` | 201 | `Vendor`: non-empty `id` (server-generated `vnd-…`), `name` Cedar Point Hardware, `active` true | API.md *Endpoints → Vendors*; OpenAPI `VendorCreate` (`active` default true), `Vendor` | — |
| VND-POST-02 | positive | `{"name":"Inactive Supplier","active":false}` | 201 | `active` false; `name` Inactive Supplier | API.md (`active` optional); OpenAPI `VendorCreate` | — |
| VND-POST-03 | positive | `{"name":"Explicit Active Co","active":true}` | 201 | `active` true | OpenAPI `VendorCreate` | — |
| VND-POST-04 | positive | `{"name":"A"}` | 201 | `name` is `A` (smallest non-empty string) | OpenAPI `VendorCreate.name` `minLength: 1` | boundary values |
| VND-POST-05 | negative | `{}` (omit `name`) | 400 | `rule`: `validation_error`; `detail` describes missing/invalid `name` | OpenAPI `VendorCreate` (`name` required); API.md *Errors* | equivalence classes (missing field) |
| VND-POST-06 | negative | `{"name":""}` | 400 | `rule`: `validation_error` | OpenAPI `VendorCreate.name` `minLength: 1` | boundary values (empty string) |
| VND-POST-07 | negative | `{"name":123}` | 400 | `rule`: `validation_error` | OpenAPI `VendorCreate.name` type `string` | equivalence classes (wrong type) |
| VND-POST-08 | negative | `{"name":"Valid Name","active":"yes"}` | 400 | `rule`: `validation_error` | OpenAPI `VendorCreate.active` type `boolean` | equivalence classes (wrong type) |
| VND-POST-09 | negative | Request body that is not valid JSON (e.g. raw `not-json`) with `Content-Type: application/json` | 400 | `rule`: `validation_error`; body indicates invalid JSON | API.md *Basics* (JSON bodies); API.md *Errors* (`validation_error`) | equivalence classes (malformed body) |
| VND-POST-10 | positive | Same `name` as VND-POST-01 sent twice in one test (two `POST`s) | 201 for both | Two distinct `id` values (unless docs later forbid duplicate names) | — | assumed — ask: Are duplicate vendor names allowed? (not in QUESTIONS.md; no delete/update endpoints documented) |

No business-rule rows: none of the eleven named rules in API.md govern vendor creation (only input validation → `validation_error`).

---

## GET /skus

| ID | type | what we send | expected status | expected body (rule, key values) | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| SKU-GET-01 | positive | `GET /skus` (no body) | 200 | JSON array; every element matches `Sku` (`sku`, `description`, `unit_price` required) | OpenAPI `GET /skus` → `Sku[]`; schema `Sku` | — |
| SKU-GET-02 | positive | `GET /skus` on a fresh API instance | 200 | Exactly five items; `unit_price` values are dollars rounded to cents | API.md *Endpoints → Catalog* (“five SKUs”); API.md *Basics* (money) | — |
| SKU-GET-03 | positive | `GET /skus` on a fresh API instance | 200 | Catalog matches seed table: `LUM-2X4-8` / 4.75; `PLY-12-4X8` / 22.40; `CEM-30KG` / 11.90; `REB-10MM-6` / 18.25; `SCR-DECK-1LB` / 9.99 (descriptions per API.md *Seed data*) | API.md *Seed data* | — |

No `404` or business-rule rows: the catalog list has no parameters and no applicable rule.

| ID | type | what we send | expected status | expected body (rule, key values) | source | technique |
| --- | --- | --- | --- | --- | --- | --- |
| SKU-GET-04 | — | `GET /skus` after arbitrary `POST /vendors` or PO activity in the same test | — | — | — | assumed — ask: Does the SKU catalog ever change at runtime, or is it always the five seed rows? (not documented; reset text only mentions restoring catalog) |

---

## Coverage notes

- **Schema validation:** VND-GET-01 and SKU-GET-01 overlap with the intent of `tests/api/schema.spec.ts` (Vendor schema on list). Implementation can reuse `expectSchema` without duplicating redundant cases.
- **Out of scope here:** `GET /vendors/{vendorId}/exposure` (rule `vendor_exposure_math`, 404 unknown vendor).
- **Open questions (do not assert until answered):** maximum `name` length (QUESTIONS.md §4); duplicate vendor names (VND-POST-10); whether catalog is immutable after create (SKU-GET-04).

**Approval:** Reply **approved** or request changes to this table before implementing Playwright tests.
