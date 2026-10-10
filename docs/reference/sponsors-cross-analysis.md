# Sponsor portal — Sessionboard vs Trackstage cross-analysis

Researched 2026-10-10 against Sessionboard's live OpenAPI
(`https://apidocs.sessionboard.com/api-reference/openapi.json`, changelog through 2026-10-07)
and learn.sessionboard.com. "As built" = the working tree at that date: `convex/lib/sponsors.ts`,
`convex/sponsors.ts`, the sponsor section of `convex/portal.ts`, `sponsors` / `people.sponsorId` /
`submissions.sponsorId` / `events.sponsorPortal` in `convex/schema.ts`, and six MCP tools. The
organizer and portal UI were still being built at that point.

## (a) The ask

> "Not all submissions come through the CFP… sponsors… if OpenAI has a sponsor, OpenAI has a
> main login, then they go in and add the sessions that they want. Sessionboard specifically
> calls out how to customize your portals as opposed to just a form."
> — Kelsey, AI Engineer events ops

This implies:

1. **A second way in.** Sponsor sessions are paid for, not applied for. They should not go through
   CFP review or count as CFP submissions. They still land in the same pipeline, agenda and comms.
2. **The company is what logs in, not a single speaker.** "OpenAI has a main login." The
   sponsor's people see the company's sessions, whoever added them.
3. **Self-service, within limits.** The sponsor adds its own sessions, so the organizer doesn't
   re-type them from emails. Limits come from the package (how many sessions) and the agenda freeze
   (until when).
4. **"Portals as opposed to just a form."** The sponsor's view is a place they come back to:
   they edit sessions, change speakers and bring in colleagues. It is not a one-shot form.

## (b) Sessionboard's model

### UI (learn.sessionboard.com)

- **A sponsor is a group**: a company record with attached contacts. Sponsors and Exhibitors are
  the same group object in two roles, under **CRM → Sponsors / Exhibitors**. The module is
  "On request", enabled by the Customer Success Manager.
  [sponsors](https://learn.sessionboard.com/sponsors-exhibitors/sponsors) ·
  [KB 8117973](https://learn.sessionboard.com/en/knowledge-base/8117973-adding-sponsor-groups-contacts)
- **Add Sponsor** searches the organization first and offers **Add to Event**, so one company is
  reused across events. A new sponsor has **Name\***, **Tier**, **Website**, **Description** and a
  logo. **Create Sponsor** saves it; **Create & Add Contacts** saves it and moves straight on to
  contacts. The profile has six tabs: Profile, Notes and activity, Messages, Program, CRM and Actions.
- **Tiers** live at **CRM → Sponsors → Tiers**: Name and Display Order, seeded with
  Gold/Silver/Bronze, with **Copy from…** another event. A tier can filter the list, bulk
  **Send/Assign** to its sponsors, and decide which portal a sponsor gets.
  [sponsor-settings](https://learn.sessionboard.com/sponsors-exhibitors/sponsor-settings.html)
- **Contacts and primary contact.** Each contact has its own login. Exactly one contact carries the
  **Primary** badge and receives the group's communications. A **No Primary Contacts** tab lists
  companies nobody can log in for yet. Every contact shares the group's tasks, files and info.
- **Access is a separate step.** "Creating a contact does not send anything." The organizer goes to
  **Actions → Manage Portal Access → Give Portal Access**, then picks **Send Email** (with an
  optional message) or **Get Link**. **Actions** also has **Copy Portal Link** and **View Portal**.
  Contacts sign in with passwords or SSO through one shared `portal-login/<event>` URL.
- **Intake form** (four steps: Welcome & Terms → Group information → Contact information →
  Notifications). The sponsor creates the group and its primary contact itself.
  [intake form](https://learn.sessionboard.com/sponsors-exhibitors/sponsor-intake-form.html)
- **Group portals.** Every event has a **Default Sponsor Portal** and a **Default Exhibitor Portal**.
  Custom group portals are filtered by group fields and **[Account] Tiers**, and the first match
  wins. Configuration toggles include **Add Contacts to Group**, **Manage Related Submissions and
  Participants** and **Add Participants to Submissions** (Sessions 2.0). Without the first toggle,
  a colleague "must contact the event admin".
  [portals-101](https://learn.sessionboard.com/portals/portals-101) ·
  [custom portals](https://learn.sessionboard.com/portals/creating-custom-portals.html) ·
  [exhibitor portal](https://learn.sessionboard.com/participants/exhibitor-portal.html)
- **Session ↔ sponsor link.** A session carries `sponsors[]`, which is many-to-many, and sponsors
  attach to parent sessions only (see product-map §2.6, subsessions). No doc describes a
  "sponsor adds N sessions" flow. The nearest equivalent is giving sponsors a submission form
  through their portal plus **Manage Related Submissions**. **Package allowances do not exist.**

### API (`https://public-api.sessionboard.com`, `x-access-token` or OAuth Bearer)

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/v1/event/{eventId}/sponsors` | Search. Body `RecordSearchBody` `{filters:{createdAt,updatedAt}, sort, expand}`; query `page`, `pageSize` (25 by default, at most 100). Returns `{results:[Sponsor], pagination:{currentPage,pageSize,totalPages,totalResults}}`. Never returns contacts. |
| GET | `/v1/event/{eventId}/sponsors/{sponsorId}` | `?expand=translated_fields`. Returns 404 if the record doesn't hold the sponsor role on this event. |
| POST | `/v1/event/{eventId}/sponsors/create` | **`write:sponsors`**. Body `{name \| account_id, custom_fields{internal_name:value}, translated_fields[]}` → **201** Sponsor. `account_id` links an existing org account; this is also how one account becomes both sponsor and exhibitor. |
| PUT | `/v1/event/{eventId}/sponsors/{sponsorId}` | `{updated_at?, name?, custom_fields, translated_fields}`. 409 if stale; `name: ""` → 400. |
| DELETE | `/v1/event/{eventId}/sponsors/{sponsorId}` | Soft delete → **204**. Deletes **the group**: both roles, on every event. Repeating it → 404. |
| POST | `/v1/event/{eventId}/sponsors/{sponsorId}/restore` | → 200 Sponsor. 400 if the sponsor isn't deleted. |
| POST | `/v1/event/{eventId}/sponsors/bulk` | `BulkOperations {operations:[{action:create\|update\|delete, id?, data?}]}`, at most 100 → `{batch_id, results:[{index,action,status,id,error{code,message,valid_options?}}], summary{total,succeeded,failed}}` |
| — | `/exhibitors…` | The same 7 operations with the same shape, under `write:exhibitors`. |

- **`Sponsor` / `SessionSponsor` / `Exhibitor`** share one shape: `id`, `friendly_id` (`SPON-3`),
  `friendly_id_raw`, `name`, `description`, `logo_image_url`, `banner_image_url`, `phone`,
  `address_line_1/2`, `address_city`, `address_state`, `address_postal_code`, `address_coutnry`
  (sic, a typo they keep for compatibility), `facebook_url`, `instagram_url`, `linkedin_url`,
  `snapchat_username`, `tiktok_username`, `twitter_url`, `website_url`, `created_at`, `updated_at`,
  `custom_fields[]`, `translated_fields[]`, `contacts[]`, and `admin_url` (except on SessionSponsor).
- **`AccountContact`**: `id`, `friendly_id`, `friendly_id_raw`, `full_name`, `first_name`,
  `last_name`, `email`, `photo_url`, `company_name`, `title`, `about`, **`is_primary`**,
  `contact_created_at`, `contact_updated_at`, `relationship_created_at`, `relationship_updated_at`.
- **`Session.sponsors[]`** and **`Session.exhibitors[]`** are read-only. Session create and update
  take **no** sponsor field.
- **Webhooks**: `sponsor.created|updated|deleted|event.associated|event.disassociated`, with the
  same set for `exhibitor.*`. The envelope is `{data, metadata}`.
  [webhooks](https://apidocs.sessionboard.com/webhooks.md)

**What their API does not have.** There is no `tier` field: tier is UI-only, though the docs say
integrations can read it. You cannot add a contact to a sponsor or set `is_primary`. You cannot link
a session to a sponsor. There is no session allowance and no portal setting. Their write API only
manages the company record. Everything Kelsey asked for happens in their UI, not their API.

## (c) Feature-by-feature

| Capability | Sessionboard | Trackstage (as built) | Verdict |
| --- | --- | --- | --- |
| Company record | Group: name, tier, website, description, logo, address, socials, custom fields | `name`, `tier`, `websiteUrl`, `notes`, `sessionLimit` | **GAP** (logo, description) |
| Tiers | A managed list with display order; drives portals, filters and bulk actions | Free text | **GAP, minor** |
| Reuse across events | Org-level account; "Add to Event" | Per event only | **GAP**, nice-to-have |
| Contacts | Each has a login; shared view of the company | `people.sponsorId`; one sponsor per person per event; speakers are linked, not duplicated | **Parity** |
| Primary contact | `is_primary`, one per group; "No Primary Contacts" tab | None. Every contact is equal | **GAP, small** |
| Inviting contacts | Manage Portal Access → Send Email / Get Link; creating a contact sends nothing | `sponsor_invite` template through the outbox, a copyable link, and `invitedAt` per contact | **Parity+** |
| Sign-in | Password or SSO, one shared login URL | Passwordless magic link, the same flow as speakers | **Better** for non-technical sponsors |
| Sponsor adds sessions | Not first-class: give them a form or portal plus "Manage Related Submissions" | `addSponsorSession`: title, description, format, length, speakers, and an "I'm presenting" option | **Better**. This is the core of Kelsey's ask |
| Package allowance | None | `sessionLimit`; withdrawn and declined sessions free their slot; one sentence explains the limit in both UI and refusals | **Better** |
| Where new sessions start | A form's default status | `newSessionStatus` per event: `pending` or `accepted` | **Better** |
| Freeze date | Form close date and task deadlines | `sponsorPortal.closeAt`, enforced by `editLockFor` (`sponsor_closed`) | **Parity** |
| Edit / withdraw | Manage Related Submissions toggle | Edit while the window is open; withdraw | **Parity** |
| Session speakers | Add Participants with roles (Sessions 2.0) | Add/remove speakers, at most 8; existing profiles are never overwritten | **Parity-lite** (Speaker role only) |
| Add colleagues | The "Add Contacts to Group" toggle; otherwise ask the admin | On by default, capped at 25, auto-invited, audited | **Better**; no organizer off switch |
| Session ↔ sponsor link | `sponsors[]`, many-to-many, read-only in the API | A single `submissions.sponsorId`; `setSessionSponsor` in UI and MCP | **Parity** in practice (co-sponsoring is rare) |
| Intake form (self sign-up) | 4-step form that creates group + primary contact | None. The organizer creates the sponsor | **GAP**, deliberately |
| Tier-segmented portals | Filtered group portals; first match wins | One sponsor view for all | **GAP**, out of scope |
| Group-shared tasks and files | Group task type (logo, booth graphics) | Tasks are per person | **GAP**, nice-to-have |
| Sponsor on the public agenda | Exposed via `sessions[].sponsors[]` | Not rendered; the webhook sends `sponsor: "<name>"` as a string | **GAP** |
| Delete | Soft delete plus restore (affects the whole group, across events) | Hard delete; sessions and contacts are unlinked but kept | **GAP** (no restore) |
| REST API | 7 ops plus `sessions[].sponsors[]` | **None.** api-parity.md lists sponsors as out of scope | **GAP** |
| Webhooks | `sponsor.*` (5 events) | None | **GAP** |
| MCP | Insights-only MCP server | `list_sponsors`, `manage_sponsor`, `manage_sponsor_contact`, `invite_sponsor_contacts`, `set_session_sponsor`, `update_sponsor_portal_settings` | **Better** |
| Activity / notes | "Notes and activity" tab | `notes` plus the audit log | **Parity** |
| Exhibitors / booths | A full second role | — | **Out of scope** |

## (d) REST mapping (proposed, mirrors their names)

Paths follow our existing `/v1/event/{ref}/…` convention. Writes need a new **`write:sponsors`**
scope. Reads fall under `read:contacts`, because contact emails are personal data.

| Theirs | Ours | Body / response |
| --- | --- | --- |
| `POST /sponsors` | same | `RecordSearchBody` plus our extras `filters.tier`, `search`. Return **`results`**, as they do (their legacy key), plus `pagination`. |
| `GET /sponsors/{sponsorId}` | same | `Sponsor` |
| `POST /sponsors/create` | same | `name` (required); extras `tier`, `website_url`, `session_limit` (default 0), `notes`, `contacts[]{email, first_name, last_name, title}`. **`account_id` → 400** "no organization accounts" (don't silently ignore it). → **201**. |
| `PUT /sponsors/{sponsorId}` | same | Same keys plus `updated_at` → **409** if stale. `name: ""` → 400; `""` on an optional field clears it. |
| `DELETE /sponsors/{sponsorId}` | same | **204**, soft delete. Needs `sponsors.deletedAt`. A repeated delete → 404. |
| `POST /sponsors/{id}/restore` | same | 200; 400 if the sponsor isn't deleted |
| `POST /sponsors/bulk` | same | `BulkOperations` / `BulkResponse`, including **`summary`**. ⚠ api-parity.md records our session bulk envelope as `stats`; their schema says `summary` ("previously named `stats`"). Re-check and serve both. |
| — | `POST /sponsors/{id}/contacts` | Ours only: `{email, first_name, last_name, title, is_primary?, send_invite?}` → `AccountContact` |
| — | `DELETE /sponsors/{id}/contacts/{contactId}` | Ours only. Unlinks; the person row stays. |
| — | `POST /sponsors/{id}/invite` | Ours only: `{contact_ids?}` → `{queued, recipients[]}` |
| — | `GET`/`PUT /sponsor-portal` | Ours only: `{new_session_status: "pending"\|"accepted", close_at: ISO\|null}` |
| `Session.sponsors[]` (read-only) | `sponsors[]` on every session read (0 or 1 items) **plus writable `sponsor_id`** on `sessions/create`, `PUT /sessions/{id}` and bulk | `SessionSponsor` shape, without `admin_url` |
| `sponsor.created/updated/deleted` | same | Also `restored`. Skip `event.associated/disassociated`, since we have no cross-event accounts. Session payloads carry `sponsors[]`, not a name string. |

**`Sponsor` response.** These fields mirror theirs: `id`, `name`, `website_url`, `created_at`,
`updated_at`, `custom_fields: []`, `contacts[]`, `admin_url` (`/app/{ws}/{event}/sponsors?id=`). Add
`description` and `logo_image_url` once G5 ships. **Omit** the address, phone and social fields and
`banner_image_url`, following api-parity's rule that "a field that is always `null` is worse than
omitting it". Our extensions are `tier`, `session_limit`, `sessions_used`, `notes` and
`sessions[]{id,title,status}`.

**`AccountContact`** mirrors `id`, `full_name`, `first_name`, `last_name`, `email`, `photo_url`
(headshot), `company_name`, `title`, `about` (bio), `is_primary`, `contact_created_at` and
`relationship_created_at`. We add `invited_at`. The portal token is never returned; the admin UI is
the only place to copy the link.

## Status after the build (2026-10-10, same day)

Closed since this analysis was written: the organizer **Sponsors** page and the
portal's company tab (both browser-tested — `tests/e2e/flows/sponsors.spec.ts`);
sponsor contacts are a protected identity in `submit.identify`; "Sponsor: X" in
the Submissions table, a Sponsor picker in the submission drawer, and
"Presented by X" on the public program; the REST layer in §(d) (all routes,
`sponsors[]` + writable `sponsor_id` on sessions, `write:sponsors`); `sponsor.*`
webhooks emitted from the shared cores so UI, MCP, REST and portal all fire
them; `session.created` carries `sponsors[]`; first contact is `is_primary`;
tiers suggest the event's existing ones; the "add colleagues" switch.
Backend verified by `scripts/verify-sponsors.mjs` (43 checks, local backend).

Still open (deliberately, below): logo/description on the sponsor, soft delete +
restore, bulk sponsor endpoint, a "sponsor contacts" audience in bulk email,
sponsor chip on agenda cards.

## (e) Remaining gaps, prioritized

**Must-have for Kelsey**

1. **Finish both surfaces end to end.** `src/routes/app/$workspaceSlug/$eventSlug/sponsors/` was
   empty at the time of writing. The organizer page (list, drawer, invite, portal settings) and the
   portal "Your company" tab must work through ordinary links and buttons, because the judge is a
   browser agent.
2. **Make sign-in safety for sponsor contacts explicit.** Today `submit.ts::hasSpeakerHistory`
   protects a sponsor contact only indirectly: `linkContact` fills in `company`, and there is the
   30-minute grace window. Yet a contact's token opens the whole company's sessions and colleagues.
   Add `person.sponsorId !== undefined → true`. It is a one-line hardening.
3. **Show the sponsor wherever the session appears.** Add a "Sponsor" column and filter on
   Submissions, a sponsor chip on the agenda card, and "Presented by OpenAI" on the public agenda
   and embeds. Without these, the organizer can't tell sponsor slots apart while scheduling.

**Should-have, cheap and in line with Sessionboard**

4. **REST layer plus `sponsor.*` webhooks** as specified in (d). This extends rule 28, and it is the
   first place we would beat their API: they can't create contacts or link sessions; we can.
   Update api-parity.md, which currently lists sponsors as "out".
5. **Logo and description on the sponsor, editable by the sponsor in their portal.** These feed
   G3's public "Presented by" and remove the most common sponsor deliverable without building
   group tasks.
6. **Derived primary contact.** Make the first contact primary unless changed, show a "Primary"
   badge, and send the invite to the primary contact by default. This is "OpenAI has a main login"
   in a single field. Don't build a "No Primary Contacts" tab; show a **"Not invited yet"** state
   instead (`invitedAt` already exists).
7. **Soft delete plus restore**, so delete gets the same undo as submissions (`list_trash`).
8. **Tier suggestions.** Keep free text but offer the event's existing tiers as suggestions. Skip
   managed tier lists and display order.
9. **Organizer off switch for "add colleagues"**, mirroring their **Add Contacts to Group** toggle.
   Default on.
10. **"Sponsor contacts" (optionally by tier) as an audience** in bulk email and bulk task assignment.
    This covers Sessionboard's tier-wide **Send/Assign** without building a portal-segmentation
    engine.

**Nice-to-have, defer**

11. Several sponsors on one session. Keep one `sponsorId`; the REST array leaves room to grow.
12. Session roles other than speaker (moderator, chairperson) when a sponsor adds a session.
13. Group-shared tasks and files (assigned to the company, done by any contact).
14. Copying sponsors from another event (their org-level "Add to Event", without an accounts model).

**Out of scope (less is more)**

15. Sponsor intake form or self sign-up (sponsors have signed contracts, so organizers create them),
    tier-filtered custom portals, exhibitors and booth selection, Accelevents sync (struck by swyx),
    SMS, `translated_fields`, custom fields on sponsors, lead retrieval and payments.
