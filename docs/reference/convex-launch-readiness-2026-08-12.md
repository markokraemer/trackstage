# Convex launch-readiness — 2026-08-12

Target: the isolated local deployment at `http://127.0.0.1:3210`, using the code in
`codex/adversarial-e2e-audit-20260811`. This is deliberately a **code-only + local
behavioral** report. It is not production telemetry.

## Coverage

| Pass | Result | Evidence |
| --- | --- | --- |
| Authz | Ran | Deterministic four-shape scan over 186 public functions: 0 identity-from-argument candidates. Manual event/workspace-scope review plus the 656-check backend suite covers anonymous, cross-user, cross-event, cross-workspace, REST-key and MCP-key denial paths. The webhook delivery hole found by that review is fixed and has a browser regression. |
| Reviewer | Ran | 55 Convex source files parsed through the TypeScript AST. 0 missing `args`, 0 database `.filter()` predicates, 0 `Date.now()` calls inside registered queries, and 0 scheduler calls targeting public `api.*`. Two systemic debt classes remain below. |
| Verify | Ran | Local Convex accepted the schema/functions. Backend/API/MCP verifier: 658/658 before the final merge cycle. Platform-email provider/retry unit probes: 7/7. Full final matrix is recorded in the build log after the last merge. |
| Advisor | **Skipped** | The official Convex Advisor tool and a cloud deployment with representative 72-hour traffic were unavailable. A skipped pass is not a pass. |
| Insights | **Skipped** | The official Convex Insights/log tool was unavailable. Local expected-denial logs are not a substitute for production failure telemetry. |

## Auditable score

The skill's required formula is `100 - 15×high - 5×medium - 1×low`, floored at
zero. Findings are counted per affected public-function identity, not collapsed into one
cosmetic umbrella:

```text
high:    0 × 15 =   0
medium: 95 ×  5 = 475  missing explicit returns validators
medium: 39 ×  5 = 195  public functions with potentially unbounded .collect()
low:     0 ×  1 =   0
score: max(0, 100 - 475 - 195) = 0 / 100 (code-only)
```

This score is intentionally harsh and must not be misread as “the product is 0% working.”
The live-local feature probes are green; the zero is caused by broad framework-contract and
future-scale debt which the readiness rubric penalizes per function. It is equally wrong to
hide that debt behind a green product-E2E result or to claim the skipped cloud passes passed.

## Blockers (high)

None found in the code/local-behavior passes after the webhook authorization fix.

## Should fix (medium)

### R1 — 95 public functions lack explicit return validators

- Class: contract / validation
- Identity: each affected public function
- Fix capability: `convex-reviewer`
- Why: callers are not protected from accidental response-shape drift at the Convex
  boundary. This is deterministic readiness debt, not an observed failing user flow.
- Distribution: `agenda` 4, `auth` 1, `dashboard` 2, `evaluationsAdmin` 6, `events` 6,
  `files` 4, `forms` 6, `portal` 11, `publicData` 5, `review` 2, `roomsTracks` 7,
  `submissions` 10, `submit` 3, `tasksAdmin` 13, `valueLists` 2, `webhooks` 3,
  `workspaces` 10.
- Fix: add exact reusable object validators incrementally, one module at a time; never use
  `v.any()` merely to move the score.

### R2 — 39 public functions contain 53 `.collect()` calls

- Class: scale / read bounds
- Identity: each affected public function
- Fix capability: `convex-reviewer` followed by migration/rehearsal where indexes change
- Why: event-scoped reads are behaviorally correct today but can cross Convex transaction
  limits as a customer event grows. The scan found 39 affected public functions across
  `agenda`, `apiKeys`, `events`, `files`, `forms`, `portal`, `roomsTracks`,
  `sessionStatuses`, `speakersAdmin`, `submissions`, `submit`, `tasksAdmin`, `valueLists`,
  `webhooks`, and `workspaces`.
- Fix: decide the product cap for each surface, then use an index plus `.take(n)` or
  pagination. Do not mechanically truncate exports, queue commits, cascades or aggregate
  views without a continuation design.

## Closed findings

- Event-scoped members could read another event's webhook deliveries when they knew a hook
  id. Every hook-id operation now authorizes through `requireEventAccess`; workspace-wide
  hooks retain workspace membership semantics. The negative cross-event browser probe passes.
- Platform transactional emails now have durable rows, scoped issue queries, automatic and
  manual retries, a five-attempt ceiling, stuck-attempt recovery, 90-day retention, HTML
  escaping and stable Resend idempotency keys. Synthetic 429/5xx/network/4xx probes pin the
  transport classifications and backoff policy.

## Ordered follow-up

1. Add exact return validators module-by-module, starting with security-sensitive portal,
   webhook and workspace functions.
2. Replace unbounded reads, starting with externally callable list/export paths; add indexes
   and continuation jobs where a simple cap would lose data.
3. Re-run authz + reviewer scans and show the score delta.
4. Run official Advisor and Insights against a real deployment with representative traffic
   before calling Convex production-ready.
