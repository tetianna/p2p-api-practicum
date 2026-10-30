---
name: p2p-qa-run
description: Runs the P2P QA agent — the explorer, then the adversary, then the judge — and shows the report. Use when the user asks to run the QA agent, test the P2P API on its own, run the challenge, or check the business rules end to end against a running API.
---

# P2P QA run

Orchestrates the three project subagents: **p2p-explorer**, **p2p-adversary**, **p2p-judge**.

Default base URL: `http://localhost:8000` (override if the user gives another).

## Steps

1. **Health** — `GET <base URL>/health` with curl. If it is down, tell the user to run `npm start` and **stop**.
2. **Empty `qa-run/`** — it holds run output only (delete contents or recreate the folder; do not touch `src/` or tests).
3. **Reset** — `POST <base URL>/admin/reset` with curl so seed data is clean.
4. **Explorer** — run the **p2p-explorer** subagent with the base URL; wait until it finishes (`qa-run/steps.jsonl` populated).
5. **Adversary** — run the **p2p-adversary** subagent with the base URL; wait until it finishes (`qa-run/attack-plan.md` and `qa-run/attacks.jsonl`).
6. **Judge** — run the **p2p-judge** subagent with the base URL; wait until `qa-run/report.json` exists.
7. **Show results** — happy path status from the report, the rule table from the judge, and the path `qa-run/report.json`.

## Out of scope

Fix nothing, write no tests, file no bugs: those are separate steps a human starts.

## Subagent invocation

Use the Task tool (or Cursor subagent UI) with:

- Subagent **p2p-explorer**: pass the base URL in the task prompt.
- Subagent **p2p-adversary**: pass the base URL.
- Subagent **p2p-judge**: pass the base URL for curl re-checks.

Run them **in order**; do not skip the judge.
