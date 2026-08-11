# API parity — Sessionboard's public API vs ours

**Mandate:** [RULES.md rule 28](../memory/RULES.md) — 100% parity on the *program* side of
Sessionboard's public API, no degradation anywhere, improve where obvious. Rule 28 was
later extended: their API reference is also a **feature census**, so this document ends
with a [UI implications](#ui-implications--the-feature-census) section that turns every
endpoint into a product-surface verdict.

**Their source of truth:** `https://apidocs.sessionboard.com/api-reference/openapi.yaml`
(OpenAPI 3.1, 131 paths / 177 operations, crawled 2026-08-11). Base URLs
`https://public-api.sessionboard.com` (US) and `…-eu` (EU).

**Ours:** `convex/apiRoutes.ts` (manifest) → `convex/apiHttp.ts` (routing/auth) →
`convex/apiV1.ts` (data) → `public/docs/api/openapi.json` (generated, 80 operations).
Regenerate with `pnpm openapi:regen`; `pnpm openapi:verify` probes every documented route
against the live deployment.

---

## Scope filter

| Their tag | Ops | In scope? | Why |
| --- | --- | --- | --- |
| Sessions | 4 | ✅ | The core program object. |
| Session Writes | 6 | ✅ | |
| Session Files | 7 | ✅ | Speaker deliverables. |
| Speakers | 2 | ✅ | |
| Event Settings | 16 | ✅ | Fields (custom fields!), tracks, rooms, tags, formats, levels, languages, statuses. |
| Field Writes | 3 | ✅ | The custom-fields model Marko explicitly called out. |
| Metadata Writes | 22 | ✅ | |
| Events | 1 | ✅ | |
| Agenda Planning | 22 | ⚠️ partial | Scheduling is in scope; their *draft workspace* subsystem is a deliberate non-mirror (below). |
| Webhooks (doc page) | — | ✅ | "Real-time notifications instead of polling." |
| Media / Session Recordings | 9 | ❌ | Video/audio ingestion + automatic transcription. A media-processing product, not program management; struck by scope discipline, not laziness — see "Not mirrored". |
| Transcriptions | 13 | ❌ | Same. |
| Contacts / Contact Writes | 11 | ❌ | CRM. Explicitly out. |
| Sponsors / Sponsor Writes | 7 | ❌ | Out. |
| Exhibitors / Exhibitor Writes | 7 | ❌ | Out. |
| Insights / SbQL | 28 | ❌ | A query language + AI query generator over event data. Out. |
| Dashboards & Widgets | 8 | ❌ | Out. |
| Reports & Queries | 5 | ❌ | Out. |
| GDPR | 2 | ❌ | Out. |
| OAuth | 4 | ✅ (already had it) | We ship OAuth 2.1 + PKCE for MCP via Better Auth at `/.well-known/oauth-protected-resource`. |

**In-scope operations: 61 of their 177.** We serve **80**.

---

## Endpoint matrix

Legend: **MATCH** = same capability, same shape · **PARTIAL** = same capability, field
differences listed · **OURS-BETTER** = we do more · **N/A** = deliberately not mirrored.

### Events

| Theirs | Ours | Verdict |
| --- | --- | --- |
| `GET /v1/events` | `GET /v1/events` | **MATCH.** Theirs returns `{results, pagination}` with integer event ids; ours returns `{data, results, pagination}` with string ids plus `slug`, `venue`, `timezone`, `agenda_published_at`, `features`. |

### Sessions (read)

| Theirs | Ours | Verdict |
| --- | --- | --- |
| `POST /v1/event/{id}/sessions` (search) | `POST /v1/event/{ref}/sessions` | **MATCH.** Same `filters`/`sort`/`expand` body, same `results` + `pagination`. Their `filters.status` enum is identical to our pipeline. We add `filters.trackId`, `tagId`, `search`, `includeDeleted`, and `sort.order` also accepts `startsAt`/`title`. |
| `GET /v1/event/{id}/sessions` (CRUD proxy) | `GET /v1/event/{ref}/sessions` | **MATCH.** Same query params (`page`, `page_size`, `is_abstract`, `status`, `track_id`, `tag_id`, `search`, `expand`). Ours defaults to the accepted program when no filter is given — the behaviour this endpoint had before parity, preserved so nothing broke. |
| `POST /v1/event/{id}/sessions/status` | `POST /v1/event/{ref}/sessions/status` | **MATCH.** Lightweight id+status projection, soft-deleted rows included with `deleted_at`. |
| `GET /v1/event/{id}/sessions/{sid}` | `GET /v1/event/{ref}/sessions/{sid}` | **MATCH**, plus `expand=files` and `expand=deleted`. |

**Session shape — field-by-field.** Ours is a strict superset. Present and identical:
`id`, `friendly_id`, `friendly_id_raw`, `title`, `description`, `status`, `is_abstract`,
`is_public`, `starts_at`, `ends_at`, `created_at`, `updated_at`, `capacity`,
`custom_fields[]`, `speakers[]`, `chairpersons[]`, `moderators[]`, `participants[]`,
`tags[]`, `track{}`, `room{}`, `format{}`, `level{}`, `language{}`, `subsessions[]`.

Theirs and not ours, with reasons:

| Field | Why not |
| --- | --- |
| `composition_status`, `composition` | Their "compose one session out of several" feature. No equivalent object in our model; inventing a field that is always `null` would be worse than omitting it. |
| `custom_status_id`, `custom_status` | Per-event custom statuses. Our pipeline is a fixed, judged enum (`GET /statuses` returns it with `system: true`). |
| `ceu_credits` | Continuing-education credits — a US-association feature, not conference program management. |
| `client_session_id`, `external_url` | Import bookkeeping for their migration tooling. |
| `translated_fields` | Multi-locale events. Not in our product. |
| `sponsors[]`, `exhibitors[]` | Out of scope. |
| `admin_url` | We return `id`; the admin deep link is `/app/submissions?id={id}`, documented in the reference rather than duplicated per row. |

Ours and not theirs: `answers{}` (the raw, lossless answer map), `kind`, `decided_at`,
`notified_at`, `deleted_at`, `duration_minutes`, `submitter{}`, `files[]` (on expand), and
the legacy epoch-millisecond aliases (`startTime`, `endTime`, `durationMinutes`,
`location`, `trackColor`, `submittedAt`, `decidedAt`) that keep pre-parity consumers working.

### Sessions (write)

| Theirs | Ours | Verdict |
| --- | --- | --- |
| `POST /sessions/create` | same | **MATCH.** Same body keys (`title`, `description`, `starts_at`, `ends_at`, `capacity`, `room_id`, `track_id`, `status`, `is_public`, `is_abstract`, `tag_ids`, `custom_fields`). `level_id`/`format_id`/`language_id` are `level`/`format`/`language` strings for us because those are value lists, not tables — `tag_ids` is accepted as an alias of `tags`. We add `submitter_email`/`_first_name`/`_last_name` and `speaker_ids`. |
| `PUT /sessions/{id}` | same | **MATCH**, including `updated_at` optimistic concurrency → **409** with the current value. |
| `DELETE /sessions/{id}` | same | **MATCH.** Soft delete; row leaves every listing and reads 404. |
| `POST /sessions/{id}/restore` | same | **MATCH.** |
| `POST /sessions/bulk` | same | **MATCH.** ≤100 ops, `{batch_id, results[{index, action, status, id, error{code,message}}], stats{total,succeeded,failed}}` — identical envelope. |
| `PUT /sessions/{id}/fields` | same | **MATCH.** |

### Speakers

| Theirs | Ours | Verdict |
| --- | --- | --- |
| `POST /v1/event/{id}/speakers` (search) | same | **MATCH**, plus `search` and `workflow_status` filters. |
| `GET /v1/event/{id}/speakers/{cid}` | same | **MATCH**, and ours embeds the speaker's full sessions rather than ids. |
| — | `GET /v1/event/{ref}/speakers` | **OURS-BETTER.** A plain list form; theirs is POST-only. |
| — | `POST /speakers/create`, `PUT /speakers/{id}` | **OURS-BETTER.** Theirs puts speaker writes under Contact Writes (`write:contacts`) in the CRM half we excluded. Speakers are program-side, so we ship program-scoped speaker writes (idempotent on email). |

Speaker shape: their `Contact` has ~40 CRM fields (`ethnicity`, `annual_revenue`,
`speaker_fee`, `headcount`, `past_companies`, …). We return the program-relevant subset —
`full_name`, `first_name`, `last_name`, `email`, `title`, `company_name`, `about`,
`photo_url`, `phone_mobile`, `pronouns`, `salutation`, `website_url`, `linkedin_url`,
`twitter_url` — plus `workflow_status` (invited/confirmed/dropped), which theirs has no
equivalent of, plus the camelCase legacy aliases.

### Event settings — including custom fields

| Theirs | Ours | Verdict |
| --- | --- | --- |
| `GET`/`POST /fields` | same | **MATCH.** See below. |
| `GET`/`POST` for tags, tracks, rooms, formats, levels, languages | same 6 × 2 | **MATCH.** |
| `GET /statuses`, `POST /session-statuses` | same | **PARTIAL.** Ours returns the fixed pipeline with `system: true`. Custom statuses are not mirrored (below). |
| `POST /fields/create`, `PUT`/`DELETE /fields/{id}` | same | **MATCH.** |
| `POST /{resource}/create`, `PUT`/`DELETE /{resource}/{id}` × 7 | same 21 | **MATCH** for rooms and tracks (real tables). **PARTIAL** for tags/formats/levels/languages — see below. **N/A** for statuses (documented 400). |

**Custom fields — the model.** Their `Field` is a definition on an event "module"; the
values ride on a session as `custom_fields[]` keyed by `internal_name`. Ours maps onto
that exactly, and the mapping is *real* rather than a shim:

> **A custom field IS a CFP form question.** `forms.questions[]` are the definitions;
> `submissions.answers{}` are the values.

- `GET /fields` assembles definitions from every form on the event: `internal_name` = the
  question id, `public_name` = its label, `field_type` = its type, `field_source` =
  `standard` for locked system questions / `custom` for organizer-added ones, `options`,
  `required`, `enabled`, `help`, `form_id`, and `contains_pii` (true for participant
  name/email/phone). Participant fields appear with `scope: "contact"`, session questions
  with `scope: "session"`.
- Every session carries `custom_fields[]` — `{id, internal_name, name, type, value,
  value_raw, created_at}`. `value` is the flattened string their clients expect;
  **`value_raw` is ours-better**: the untouched JSON, so a multi-select answer is never
  lossily stringified.
- `PUT /sessions/{id}/fields` and `custom_fields` on create/update write them. Unknown
  keys are stored and returned rather than dropped.
- `POST /fields/create` appends a question to the event's form — so a field created over
  the API immediately appears in the form builder **and on the public submission form**.
  Their API cannot do that; theirs and their form builder are separate systems.

**Value lists.** They model tags/formats/levels/languages as tables with ids. We model
them as the option set on the corresponding form question (`format`, `level`, `language`,
`tags`). Reads therefore return `{id: <the value>, name: <the value>, order}` — the id is
the value itself — and writes edit the question's options across every form. Reads also
union in any value actually in use, so a session never references an unknown value. This
keeps the form builder and the API as one source of truth instead of two that drift.

### Agenda

| Theirs | Ours | Verdict |
| --- | --- | --- |
| — | `GET /v1/event/{ref}/agenda` | **OURS-BETTER.** Rooms, tracks, every placement, everything unscheduled, and the live conflict list in one read. They have no equivalent single-call agenda read. |
| — | `POST /agenda/publish`, `/unpublish` | **OURS-BETTER.** The public-programme go-live gate. |
| Scheduling a session | `PUT /sessions/{id}` with `room_id` + `starts_at` | **MATCH** (they schedule the same way). |
| `agenda-drafts/*` (12 ops), `rules/*` (5), `personas/*` (5) | — | **N/A**, reasoned below. |

### Webhooks

| Theirs | Ours | Verdict |
| --- | --- | --- |
| Dashboard-only (no API) | `GET`/`POST /v1/webhooks`, `GET`/`PUT`/`DELETE /v1/webhooks/{id}`, `POST /{id}/test`, `POST /{id}/rotate`, `GET /{id}/deliveries` | **OURS-BETTER.** Sessionboard has webhooks but manages them only through Settings → Integrations → Webhooks; there is no endpoint for them in their public API. Ours are fully API-managed. |
| `{data, metadata}` payload | identical | **MATCH** — `data` carries the full resource + `id` + `sourceOfChange`; `metadata` carries `action`, `event_id`, `org_id`, `resource_url`, `version`, `datetime`. |
| Session events (`session.created/updated/deleted`, `session.speaker.attached/detached`) | all present | **MATCH.** |
| Contact / sponsor / exhibitor events | — | **N/A** (out of scope). |
| "Custom headers for security" | **HMAC-SHA256 signature** | **OURS-BETTER.** Every delivery carries `Trackstage-Signature: t=<unix-seconds>,v1=<hex>` over `"{t}.{body}"` keyed with the endpoint's `whsec_…` secret, plus `Trackstage-Event` and `Trackstage-Delivery` (idempotency). Theirs offers only a static shared header, which cannot detect tampering or replay. |
| Retries with exponential backoff | 5 attempts: 1s, 5s, 25s, 125s | **MATCH.** |
| Delivery log in the dashboard | `GET /{id}/deliveries` — status, attempts, response code, error, and the exact signed payload | **OURS-BETTER** (API-readable). |
| — | `POST /v1/_echo?secret=…` | **OURS-BETTER.** A signature-verifying echo sink: point a webhook at it and a 200 *proves* the HMAC verified. Their equivalent advice is "use Svix Play". |

Our event catalogue adds `submission.created/updated`, `session.scheduled/unscheduled`,
`decision.committed`, `agenda.published`, `speaker.created/updated`,
`file.uploaded/deleted` — the moments an organizer's automation actually cares about.

### Session files

| Theirs | Ours | Verdict |
| --- | --- | --- |
| `GET .../files` | same | **MATCH** — completed files only, latest version per group. |
| `POST .../files/upload` (simple, ≤50 MB) | same | **MATCH**, same 50 MB ceiling, same `file` field name, same 413. |
| `POST .../files` → presigned URL | same → `upload.url` on our own origin | **PARTIAL (better).** Theirs hands out a presigned S3 URL; ours hands out an authenticated URL on this deployment. Same three-step shape (`initiate → PUT bytes → complete`) and same response key (`data.upload.{url,method,headers}`), but the upload leg is authenticated with your ordinary API key instead of a credential embedded in a URL that leaks through logs and referrers. Their 500 MB direct-to-storage ceiling is bounded by Convex storage limits instead. |
| `POST .../files/{id}/complete` | same | **MATCH.** |
| `POST .../files/{id}/replace` | same | **MATCH** — versions the file group. |
| `PUT .../files/{id}` (title, assigned participant) | same | **MATCH.** |
| `DELETE .../files/{id}` | same | **MATCH** — soft delete, 204. |
| — | `PUT .../files/{id}/bytes` | The upload leg above. |

### Cross-cutting

| Concern | Theirs | Ours | Verdict |
| --- | --- | --- | --- |
| **Auth header** | `x-access-token` (API token) or `Authorization: Bearer` (OAuth) | **both**, interchangeably | **MATCH.** Any `sb_live_…` key works in either header. |
| **Auth model** | Org-scoped token; OAuth tokens inherit the user's permissions | Key resolves to a user; **every request re-runs the same workspace-membership authorization the app uses** | **OURS-BETTER.** A key can never reach an event its owner cannot, so a leaked key is bounded by a real permission model rather than by an org boundary. |
| **Scopes** | 17 scopes; legacy empty-scope tokens get all reads and no writes | 8 scopes (`read:events`, `read:sessions`, `read:contacts`, `write:sessions`, `write:contacts`, `write:fields`, `write:metadata`, `write:events`); **unset = unrestricted within the owner's membership**, set = narrowing only | **PARTIAL, deliberately.** Their legacy rule would have silently broken every existing key (and the MCP server, which shares the table). Ours is additive: scopes can only ever narrow. 403s name the missing scope. |
| **Public demo credential** | none | `demo-api-token`, read-only, writes 403 | **OURS-BETTER** — the API is explorable without signing up. |
| **Pagination** | `results` + `pagination{currentPage,pageSize,totalPages,totalResults}` on search; `data` + `pagination{current_page,…}` on the CRUD proxy — *two* conventions | **both, always**: every paginated response carries `data` AND `results` (same array) and every pagination key in both spellings | **OURS-BETTER.** A client written against either convention works, and no endpoint makes you check which one you're on. Same defaults (25) and max (100). |
| **Error format** | `{error: "TooManyRequestsError", message: "…"}` | `{error: "<sentence>", code: "TooManyRequestsError", message: "<sentence>", status}` | **PARTIAL, deliberately.** Their `error` holds the *name*; ours has always held the *message*. Emitting both under separate keys means neither contract breaks. Messages are organizer-readable, never stack traces. |
| **Status codes** | 200/400/401/403/404/409/429/500 | same, plus 201 on create, 204 on delete, 413 on oversize upload | **MATCH+.** |
| **Rate limits** | 100 / 15 min per token per category, `RateLimit-*` headers, 429 + `Retry-After` | identical, same header names, same buckets (`entity_reads`, `session_writes`, `field_writes`, `metadata_writes`, `event_writes`) | **MATCH.** |
| **Regions / base URL** | US + EU hosts | one host — your own deployment's Convex site URL | **N/A.** Self-hosted per workspace; data residency is the deployment's region, which is stronger than a two-region choice. |
| **Timestamps** | ISO-8601 | ISO-8601 in responses, ISO-8601 **or** epoch ms accepted in requests, legacy epoch-ms fields retained | **MATCH+.** |
| **Event addressing** | integer `eventId` | slug **or** id, everywhere | **OURS-BETTER** — `/v1/event/ai-summit-2026/sessions` is legible in a shell history. |
| **`expand`** | `translated_fields`, `subsession_details`, `linked_sources`, `composition` | `files`, `deleted` | **PARTIAL.** Theirs expand features we do not have; ours expand things we do. |
| **OpenAPI spec** | published, hand-maintained | **generated from the route manifest**, drift-checked in CI, every route probed live | **OURS-BETTER.** |
| **MCP** | `read:insights` scope, MCP for Insights only | full MCP server over the whole product at `/mcp`, OAuth 2.1 + PKCE | **OURS-BETTER.** |

---

## Not mirrored, and why

1. **Agenda drafts / scheduling rules / evaluation personas (22 ops).** A whole
   scenario-planning subsystem: fork the agenda, move things about in the fork, preview a
   diff, commit. Our agenda is live, reactive and instantly reversible (drag, see
   conflicts flagged in real time, drag back) — which is the differentiator swyx asked
   for, since his complaint about Sessionboard was slowness. Adding a draft/commit round
   trip would make the fast thing slow to match a feature that exists because their board
   is not fast. If scenario planning is wanted later it should be designed for our
   interaction model, not ported.
2. **Custom session statuses.** Our pipeline (`draft → pending → accept_queue /
   decline_queue → accepted / declined`, plus `withdrawn`) is the domain language the
   brief and the eval kit are written in, and identical wording in the organizer and
   speaker UIs is an explicit requirement. Arbitrary statuses would break that contract.
   `GET /statuses` returns the pipeline with `system: true`; writes answer 400 with the
   reason rather than pretending.
3. **Media upload + transcriptions + recordings (22 ops).** Video/audio ingestion,
   multipart-to-S3, automatic transcription, summaries, topic extraction, translations,
   content documents. This is a media-processing product bolted onto an event product.
   Out of the brief's scope and not something to half-build.
4. **Subsessions / composition.** No parent-child sessions in our model. `subsessions[]`
   is returned as an empty array so clients written against their API can iterate without
   a guard.
5. **`translated_fields`.** Multi-locale events.
6. **CRM (contacts), sponsors, exhibitors, GDPR requests, Insights/SbQL, dashboards,
   saved reports.** Explicitly struck from scope.

---

## UI implications — the feature census

Rule 28 extended: every endpoint they ship implies a product surface an organizer can
*use*. This is the work order — what their API implies, whether our UI has it, and how
much an organizer cares.

Severity: **P0** = an organizer hits this in a normal week and is blocked ·
**P1** = they hit it and have to work around it · **P2** = nice to have.

| # | Capability their API implies | Our UI today | Gap | Sev |
| --- | --- | --- | --- | --- |
| 1 | Session/abstract list + detail, inline edit | ✅ `/app/submissions` — `src/components/submissions/submissions-table.tsx`, `submission-detail-drawer.tsx` (Details/People/Reviews/Files) | — | — |
| 2 | Create a session manually | ✅ `add-submission-drawer.tsx` | — | — |
| 3 | Edit track/format/level/language/tags | ✅ detail drawer, Details tab | — | — |
| 4 | Edit **room / start time / duration** on a session | ⚠️ only from the Agenda (`src/components/agenda/schedule-fields.tsx`); the submission drawer shows them read-only | Organizers who open a session to fix its time must go find it on the board instead. Add the scheduling fields to the drawer. | **P1** |
| 5 | Session **capacity** | ❌ no per-session capacity anywhere; only room capacity (`rooms-card.tsx`) | Our API reports `capacity` from the assigned room. Either add a real per-session capacity field or keep deriving it — decide, don't leave it implicit. | P2 |
| 6 | **Delete a session, and restore it** | ✅ `…` row menu + detail-drawer footer → `delete-submission-dialog.tsx`; Options → Deleted submissions → `deleted-submissions-drawer.tsx`; `submissions.remove` / `restore` | — (closed 2026-08-11; soft delete now filtered out of every organizer/agenda/dashboard/portal/public read too) | — |
| 7 | **Bulk operations** beyond status | ⚠️ `bulk-bar.tsx` does bulk *status* only | No bulk track/format assignment, no bulk delete. The API does all three. | **P1** |
| 8 | **Edit custom-field answers** from the organizer side | ✅ `answers-editor.tsx` — reuses the public form's `QuestionField`, autosaves on blur via `submissions.updateDetails` `answers` patch (merging) | — (closed 2026-08-11) | — |
| 9 | Define custom fields (form builder) | ✅ `/app/forms/$formId`, `question-editor-drawer.tsx` | — | — |
| 10 | Session files: view / upload / download / approve / delete | ✅ `submission-files.tsx`, `file-row.tsx` | — | — |
| 11 | **Rename a file / re-assign it to a participant** | ❌ no rename, no assignment control | The API exposes `PUT .../files/{id}` for exactly this (`title`, `assigned_participant_id`). Speaker deliverables arrive named `Final_v3_REAL.pptx`. | **P1** |
| 12 | **File versions / replace** | ⚠️ versions exist in the data (`uploads.version`) and the API replaces; the UI shows a version number but has no replace action | | P2 |
| 13 | Speakers: list / detail / create / edit | ✅ `/app/speakers`, `speaker-profile-drawer.tsx`, `add-speaker-dialog.tsx` | — | — |
| 14 | **Organizer-side headshot upload** | ❌ organizer can only leave a `headshotNote`; upload is speaker-portal-only | Every conference ends with an organizer pasting in a headshot the speaker emailed. | **P1** |
| 15 | Rooms & tracks CRUD | ✅ `/app/settings/rooms-and-tracks` | — | — |
| 16 | **Manage tags / formats / levels / languages** | ✅ Event settings → **Fields & options** (`/app/settings/fields-and-options`, `value-lists-card.tsx`, `convex/valueLists.ts`) — add / rename (cascades onto sessions) / remove, usage counts, drift flag | — (closed 2026-08-11; writes the same form question the API writes) | — |
| 17 | Agenda views, drag-drop, publish, auto-place | ✅ six views + `publish-agenda-button.tsx` + `auto-place-dialog.tsx` | — | — |
| 18 | Agenda drafts / scenario planning | ❌ NONE (confirmed) | Deliberate non-mirror — see above. | — |
| 19 | Scheduling rules / constraints | ❌ NONE; auto-place params are hardcoded constants in `auto-place-dialog.tsx` | Deliberate non-mirror, but the *auto-place parameters* (day window, length, gap) should at least be organizer-editable in that dialog. | P2 |
| 20 | **Webhooks management** | ✅ Settings → Integrations → `webhooks-card.tsx` + `webhook-deliveries-drawer.tsx`; public wrappers `webhooks.list/eventTypes/create/update/remove/rotate/sendTest/deliveries` | — (closed 2026-08-11) | — |
| 21 | **API key scopes** | ⚠️ `api-keys-card.tsx` creates keys by name only | `apiKeys.create` now accepts `scopes`; the dialog should offer read-only vs full. | **P1** |
| 22 | Integrations surface | ⚠️ Airtable card only (`/app/settings/integrations`) | Webhooks belong here too (#20). | **P1** |
| 23 | Session filters: format / level / language | ⚠️ submissions table filters by status + track + free text | The API filters by all of them. | P2 |
| 24 | Transcriptions / recordings / media | ❌ NONE | Deliberate non-mirror. | — |
| 25 | Insights / report builder | ❌ fixed dashboard (`/app`), CSV export only | Deliberate non-mirror. | — |
| 26 | Events list + settings | ✅ `/app/events`, `/app/settings`, `/app/workspace` | — | — |

**The work order, in order:** #6 (delete + restore/trash), #8 (editable answers), #16
(value-list management), #20 (webhooks UI) were the P0s — **all four shipped 2026-08-11**
(see docs/memory/BUILD-LOG.md; screenshots in `docs/verification/p0-api-parity-ui/`).
Remaining: #4, #7, #11, #14, #21, #22 as P1.

#22 is partly closed by #20 — the Webhooks card lives on Settings → **Integrations**
rather than API & MCP, because that tab is about credentials while Integrations is about
things that talk to other systems.

---

## Verification

`scripts/verify-backend.mjs` → section **API parity**: ~70 live assertions covering every
endpoint above — auth model (both headers, demo-token read-only, scoped-key narrowing),
error envelope, pagination in both spellings, session search/filters/sort, create → read →
update → 409 → soft-delete → 404 → restore, custom-field definitions + values + lossless
`value_raw`, metadata + value-list writes, speakers, both file-upload paths, bulk with
mixed success/failure, agenda, and a **real signed webhook delivery** verified end to end
(the echo sink answers 200 only when the HMAC verifies, and a forged signature is rejected).

`pnpm openapi:verify` probes all 80 documented routes against the live deployment and
fails on any route the server does not serve.
