# MCP live-fire test — all 27 tools, driven by a real Claude client

**Run:** 2026-08-11 · **Target:** `https://neat-sparrow-926.eu-west-1.convex.site/mcp`
(dev deployment) · **Client:** Claude Code `claude -p`, model
`claude-haiku-4-5-20251001`, MCP added exactly the way the README tells a user to:

```sh
claude mcp add sessionboard --transport http \
  https://neat-sparrow-926.eu-west-1.convex.site/mcp \
  --header "Authorization: Bearer sb_live_…"
# → claude mcp list: sessionboard … ✔ Connected
```

**Method.** Two personal API keys were minted through the real
`apiKeys.create` mutation (Better Auth REST sign-in as
`organizer@demo.sessionboard.dev` → `convex_jwt` → `ConvexHttpClient.setAuth`).
Eight non-interactive `claude -p` sessions, each a plain-English operator ask with
`--allowedTools "mcp__sessionboard__*"`, ran the full surface unattended; the
model was never told a tool name, argument name or id. Full stream-json
transcripts were captured per session. Raw JSON-RPC probes over `curl` covered
the negative paths a well-behaved model never produces on its own.

**Headline: 27/27 tools reachable and functionally correct. No tool was broken.**
Every capability the organizer app exposes was driven end to end from a chat
prompt — discovery, forms, decisions, agenda, speakers, comms — including the
guard rails (two-step decisions, conflict reporting, reminder de-duplication).
Three real defects were found in the *edges* (argument validation, error
formatting, template-key freedom); all three were fixed in this pass and
re-verified live.

---

## Verdict table

| # | Tool | Verdict | Notes |
| --- | --- | --- | --- |
| 1 | `list_workspaces` | ✅ works | Role + event count; correct entry point, model reached for it unprompted. |
| 2 | `list_events` | ✅ works | ids **and** slugs returned — every later call used the slug. |
| 3 | `create_event` | ✅ works | Created from a sentence ("Nov 3–4, Berlin, Europe/Berlin"); slug derived, single-workspace `organizationId` inference worked. |
| 4 | `get_event_overview` | ✅ works | Dashboard numbers in one call. Only reached correctly when the ask said "dashboard overview" — see fumble #2. |
| 5 | `get_event_summary` | ✅ works | Best tool in the set. `needsAttention` + `upcomingDeadlines` gave the model a to-do list with no extra calls. |
| 6 | `list_forms` | ✅ works | Status, close date, public URL, submission/draft counts. |
| 7 | `get_form` | ✅ works | Full question set; model summarised the CFP accurately from one call. |
| 8 | `create_form` | ✅ works | Standard question set pre-filled, public URL returned. Response omits `name` — minor (fix #7). |
| 9 | `update_form_settings` | ✅ works | `status: "closed"` on a slug; echoed the whole resulting settings object. |
| 10 | `get_public_form_link` | ✅ works | `acceptingSubmissions` boolean is exactly the field a model needs. |
| 11 | `list_submissions` | ✅ works | Status/track/search/limit filters all correct. |
| 12 | `get_submission` | ✅ works | Answers, participants, review scores + evaluator comments — enough to actually make a decision. |
| 13 | `set_submission_status` | ✅ works | Returns `previousStatus` **and** the "Staged only — no email has been sent" note. Model repeated the note to the user unprompted. |
| 14 | `commit_decision_queue` | ✅ works | Correctly **refused** without `confirm: true`. Refusal text is the best in the server (see highlights). |
| 15 | `add_manual_session` | ✅ works | Speaker matched/created by email; defaults to `accepted`/`session` so it lands in the tray immediately. |
| 16 | `get_agenda` | ✅ works | Scheduled + unscheduled tray + rooms + conflicts, one call. |
| 17 | `schedule_session` | ✅ works | Room by **name**; deliberate double-booking was written *and* reported back (`conflicts: ["Both booked in Main Stage at the same time"]`) — matches the drag-a-card semantics the description promises. |
| 18 | `unschedule_session` | ✅ works | Back to the tray, stays accepted. |
| 19 | `auto_place_sessions` | ✅ works | `placed: 1, couldNotFit: 0, conflictsAfterwards: 0` + note that existing placements were untouched. |
| 20 | `list_speakers` | 🟡 works-but-rough | Data is right; `onlyWithOutstandingWork` conflates *open tasks* with *incomplete profile*, and the model mis-reported the count (fumble #3). |
| 21 | `get_speaker_portal_link` | ✅ works | Returns the magic link with a "treat as a credential" note the model surfaced verbatim. |
| 22 | `assign_task` | ✅ works | Bare date `"2026-09-01"` accepted and normalised; note points at `send_reminders`. |
| 23 | `send_reminders` | ✅ works | `queued: 0, skipped: 8` — the 20h dedupe fired, and the note explained why so the model didn't read it as a failure. |
| 24 | `list_templates` | ✅ works | Subject + body + `customized` flag. |
| 25 | `update_template` | 🟡 → ✅ **fixed** | Used to accept **any** key and silently create a dead template. Now enum-locked (fix #1c). |
| 26 | `list_outbox` | ✅ works | Counts by status + rows; `preview` status explained in the description, so the model correctly reported "rendered, not delivered". |
| 27 | `send_test_email` | ✅ works | Renders against real event data and returns subject+body inline — the model proofed the copy without another call. |

**Counts: 25 works · 2 works-but-rough · 0 broken.** (Of the two rough ones, one —
`update_template` — is fixed in this pass; `list_speakers` needs a small shape
change, listed below.)

### Protocol & auth

| Check | Result |
| --- | --- |
| `initialize` | ✅ `2025-06-18`, `serverInfo`, and a genuinely useful `instructions` string ("Decisions are two-step on purpose…"). |
| `tools/list` | ✅ 27 tools, each with `title`, `annotations.readOnlyHint/destructiveHint/openWorldHint`. |
| No `Authorization` header | ✅ `401` + `WWW-Authenticate: Bearer realm="sessionboard", resource_metadata="…/.well-known/oauth-protected-resource"` (RFC 9728) + a JSON-RPC error explaining both auth options. |
| Bogus `sb_live_…` key | ✅ identical `401` — no oracle for key probing. |
| **Key revoked mid-session** | ✅ **immediate.** Key B was revoked while a live `claude -p` session was between tool calls; every subsequent call failed. No caching, no grace window. |
| Unknown tool name | ✅ `-32602 Unknown tool "delete_event". Call tools/list to see what's available.` |
| Unknown method | ✅ `-32601`. |
| `GET /mcp` | ✅ `405` with a body that tells a human exactly how to connect (incl. the `claude mcp add` line). |

---

## Transcript highlights

### The good

**The two-step decision guard held, and explained itself well.** Asked to commit
the accept queue without confirming:

> `commit_decision_queue({event: "ai-summit-2026", queue: "accept_queue"})`
> → `isError: true` — *"Refusing to send decision emails without confirm: true.
> Review the queue with list_submissions first, then call again with confirm: true."*

That message does the three things an agent-facing refusal must: says what was
refused, says why, and names the exact next call. The model reported it verbatim
and did not retry.

**Conflicts are reported, not enforced — and the model understood the difference.**
Scheduling a panel on top of an existing Main Stage talk succeeded *and* returned
the conflict; the model wrote "Scheduled successfully, but with conflict noted"
and then confirmed it via `get_agenda`, which listed the conflict with both
titles and both submission ids.

**Slug-or-id everywhere paid for itself.** Across eight sessions the model used
`"ai-summit-2026"`, `"cfp"` and `"mcp-test-form"` as arguments and never once
had to round-trip for an id.

**Notes-as-affordances work.** Nearly every mutation returns a `note` naming the
next tool (`"Use send_reminders to nudge them"`, `"Preview it with send_test_email"`,
`"Check list_outbox for the final status"`). In the transcripts the model
followed those pointers instead of guessing.

**Revocation is genuinely immediate.** Mid-session revoke → 8/8 subsequent calls
failed, first one within seconds. The `by_keyHash` lookup story in the README
holds up under a live client.

### Every fumble

1. **Claude Code defers a 27-tool server, so the model picks tools by *name*, not
   description.** In all eight sessions the client presented the tools lazily and
   the model had to `ToolSearch` for them; in session 3 it burned **seven**
   consecutive schema-fetch calls (~2 turns of pure overhead) before its first
   real call. The consequence matters: *the carefully written descriptions are not
   what drives selection at first contact — the names are.* The names survive that
   test well (they are verb_noun and unambiguous), but it means the one-line
   `title` and the tool **name** carry more weight than the paragraph below them.

2. **`get_event_overview` lost a head-to-head with `get_agenda`.** Asked to "pull
   the dashboard stats", the model fetched `get_agenda` instead. Only when the ask
   explicitly said "the dashboard overview — not the agenda, not the summary" did
   it call the right tool. `get_event_overview` and `get_event_summary` overlap
   heavily (both return status counts, conflict counts, forms with links), and
   from names alone "overview vs summary vs agenda" is a coin flip.

3. **`list_speakers(onlyWithOutstandingWork: true)` returned 11 rows; the model
   reported 8.** The three it dropped had `outstandingTasks: []` but
   `missingProfileItems: ["slides"]`. The flag means "open tasks **or** an
   incomplete profile", the model read it as "open tasks", and silently
   under-reported the chase list — the exact failure mode this tool exists to
   prevent.

4. **`send_test_email` guessed a recipient.** The description says *"Defaults to
   your own address"*, but the model passed `to: "marko@kortix.ai"` — an address
   it had from its own environment, not from Sessionboard. Harmless here, but a
   model inventing a recipient for an email-sending tool is the wrong instinct;
   the parameter should tell it to omit the field.

5. **Verbose payloads get summarised lossily.** `get_form`, `get_agenda` and
   `list_templates` each return several KB; in every case the model's prose
   summary was directionally right but dropped rows. Nothing is wrong with the
   data — but tools that return >2KB routinely get compressed by the model before
   the user sees them.

6. **All public URLs came back as `http://localhost:3000/…`** (form links, portal
   magic links). Correct for this dev deployment (`SITE_URL` unset), but it means
   an MCP client is handed unusable links unless the deployment sets `SITE_URL`.
   Worth a warning in the returned payload when the site URL is a loopback host.

---

## Bugs found — three fixed in this pass

All three were fixed in `convex/mcp.ts`, `pnpm typecheck` is clean (0 errors), and
each was re-verified against the live deployment.

### 1. FIXED — tool arguments were never validated against `inputSchema`

A missing required argument fell all the way through to Convex's own validator,
and the model got back:

```
ArgumentValidationError: Object is missing the required field `event`. …
Object: {userId: "k17d0g641wcxs1xq15gawmmh3h8c89g0"}
Validator: v.object({event: v.string(), userId: v.string()})
```

Two problems: it is not actionable for an LLM (it describes an *internal*
validator that includes a `userId` argument the caller cannot even send), and it
leaks the Better Auth user id into the client. Declared `enum`s were not enforced
either, and unknown/misspelled argument names were silently ignored.

**Fix:** a `validateArgs()` pass against the tool's own `inputSchema` before
dispatch — required fields, types, enums, and unknown keys — returning JSON-RPC
`-32602`:

```
Missing required argument `event` for list_forms.
Invalid value "approved" for `status`. One of: draft, pending, accept_queue, …
Unknown argument `eventSlug` for list_submissions. Accepted: event, status, track, search, limit.
Argument `limit` of list_submissions must be a number, got string.
```

Verified with a real client: told to "list submissions whose status is
*approved*", the model received the enum error and **self-corrected to
`accepted` on the next call** — which is the whole point.

### 2. FIXED — tool errors carried Convex stack traces

Every thrown error reached the model as
`Uncaught Error: No event matches "nope-2030". … \n at resolveEvent (../../convex/mcp.ts:110:6)`.
The useful sentence was there, wrapped in noise that costs tokens and exposes
source layout. **Fix:** `toolErrorMessage()` strips the `Uncaught Error:` prefix
and every stack frame. Now: `No event matches "nope-2030". Call list_events to
see the available event ids and slugs.`

### 3. FIXED — `update_template` accepted any key and created dead templates

`update_template({key: "nudge", subject: "x"})` **succeeded**, inserting a new
`emailTemplates` row with a near-empty default body. It then showed up in
`list_templates` marked `customized: true`, and `send_test_email({key: "nudge"})`
happily rendered and queued it — while the Communications screen (which renders
only the five keys in `TEMPLATE_KEYS`) would never show it and nothing would ever
send it. A single typo from a model created an invisible, permanently dead
template. **Fix:** `enum: TEMPLATE_KEYS` on both `update_template.key` and
`send_test_email.key`, plus a server-side guard in each handler (defence in depth
for the copilot path). Verified: bogus keys now rejected; a prompt that said
*'use the template key "nudge"'* made the model correctly pick `reminder` instead.

---

## Ranked fix list for the MCP agent

Ordered by how much each one moves the "an agent can run my conference" needle.

1. **Separate `get_event_overview` from `get_event_summary`, or merge them.**
   They overlap ~80% and the model cannot tell them apart from names. Either fold
   `get_event_overview` into `get_event_summary` (26 tools, one obvious entry
   point) or rename it to something mechanically distinct
   (`get_event_counts`) and strip the narrative fields from it.

2. **Fix `list_speakers` semantics.** Add a per-row `outstandingReason:
   ["open_tasks" | "incomplete_profile"]`, and return
   `{withOpenTasks, withIncompleteProfile}` alongside `speakerCount`. Rename the
   flag to `onlyNeedingChasing` and say in the description that it includes
   speakers whose *profile* is incomplete even with zero tasks. This is the one
   place a model silently gave the operator a wrong number.

3. **Warn when the deployment's site URL is a loopback host.** Every
   `publicUrl` / `portalUrl` returned `http://localhost:3000/…`. Add a
   `warning: "SITE_URL is not configured — these links only work locally"` to the
   payloads that return links, so an agent never hands a user a dead URL.

4. **Add the missing destructive half of the CRUD surface.** An MCP-only
   operator can `create_event` and `create_form` but can never remove either —
   cleaning up this test required a direct `events.remove` call outside MCP.
   `delete_event` and `delete_form` (both `confirm: true`-guarded, exactly like
   `commit_decision_queue`) would close the "do everything from the chat" gap.
   Same for `complete_task` / `remove_task` — tasks can be assigned but never
   retracted.

5. **Cap or paginate verbose payloads.** `get_form`, `get_agenda`, `list_speakers`
   and `list_templates` return several KB and the model compresses them lossily.
   Either add a `verbosity: "compact" | "full"` argument or truncate long bodies
   (template `body`, submission `description`) with an explicit
   `"…truncated, call get_form for the full text"` marker.

6. **`send_test_email.to`: change the description to "Omit to send to yourself.
   Only set this if the user named a specific address."** The current wording
   ("Defaults to your own address") invited the model to fill in an address from
   its own context.

7. **Return the created object's display fields on create.** `create_form`
   returns `{formId, slug, publicUrl, status}` but not `name`, so a model that
   creates two forms in one turn cannot tell them apart without another call.
   Same for `add_manual_session` (no `format`/`track` echo).

8. **Normalise field names across tools.** `list_forms`/`get_form` use `closeAt`;
   `get_event_summary` uses `closesAt` for the same value. `get_event_overview`
   uses `acceptedNotYetScheduled`, `get_event_summary` uses `acceptedNotScheduled`.
   Small, but it makes a model hedge.

9. **Consider trimming the tool count below the client's deferral threshold.**
   27 tools makes Claude Code defer schemas, costing 1–7 wasted round trips per
   session before any real work happens. Folding the overlapping pairs (#1) and
   collapsing `get_public_form_link` into `list_forms`/`get_form` (both already
   return `publicUrl`) would get the surface to ~24 and make first contact
   cheaper.

10. **Document the API-key-vs-OAuth 401 nuance.** Because the server always
    answers 401 with the RFC 9728 `WWW-Authenticate` OAuth pointer, Claude Code
    renders a revoked *API key* as `MCP server "sessionboard" requires
    re-authorization (token expired)` — the server's much better message
    ("Missing or invalid credentials. Send `Authorization: Bearer <your
    Sessionboard API key>`…") never reaches the model. This is spec-correct and
    probably shouldn't change, but the README's Authorization section should say
    that a revoked key surfaces as a re-auth prompt in Claude Code.

---

## Does the "do everything via MCP" promise hold?

**Yes, with one asterisk.** A conference was discovered, inspected, extended
(new event, new CFP form, new manual session), triaged (submission staged, queue
guarded), scheduled (placed, conflicted, unscheduled, auto-filled), chased
(portal link, task assigned, reminders queued) and communicated (template edited,
outbox read, test mail proofed) — entirely from eight plain-English prompts to a
stock Claude Code client, with zero UI. The asterisk is **deletion**: MCP can
create events, forms and tasks but cannot remove any of them (fix #4), so a
"manage everything" session eventually needs the web app or a direct Convex call.

---

## Test hygiene

- Throwaway artifacts (`MCP Test Event`, `MCP Test Form`, `MCP Test Panel`, the
  `MCP test task`, the probe `nudge` template) were removed: the event via
  `events.remove`, the rest by `pnpm exec convex run seed:setup`. Verified clean
  afterwards through the MCP endpoint itself.
- Both test API keys were revoked (one mid-session as part of the negative path).
- The scratch `claude mcp add` registration was local-scope only and removed with
  `claude mcp remove sessionboard`.
- **Caveat on the transcripts:** the shared dev deployment was reseeded several
  times *by other concurrent agents* during the run, which changed event/room ids
  between sessions and caused one session (agenda) to lose the manual session
  another had just created. That session was re-run self-contained; no MCP tool
  misbehaved as a result.
