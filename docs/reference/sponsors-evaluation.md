# Sponsors & contacts — first-principles evaluation (2026-10-10)

Marko, after the first sponsor build: *"it's missing all end-to-end features regarding
setting up a sponsor as a whole, like also all sponsor information … I'm not a big fan
of our contacts also not being centralized … let's first finish a spotless
from-first-principles evaluation."* This is that evaluation. It starts from what an
event team actually does with a sponsor — not from what Sessionboard ships — and checks
every step against the product as it is today. Companion docs:
`sponsors-cross-analysis.md` (Sessionboard's sponsor UI/API) and
`sessionboard-product-map.md` (their whole product).

## 1. The job, from first principles

A sponsor is a **company that paid for visibility and access**. Everything the event
team does with one is one lifecycle:

| # | Stage | What the organizer needs | What the sponsor needs |
|---|---|---|---|
| 1 | **Sign** | Record the company and its package (tier → what's included) | — |
| 2 | **Onboard** | Name the people at the company, get them in | One link, no password, "here's what we owe you and what you owe us" |
| 3 | **Collect** | Logo, description, links, sessions + speakers, booth staff, ad assets — by deadlines | A checklist with due dates; upload/answer in place |
| 4 | **Review** | Approve sessions and files; ask for changes | Know the status of everything they sent |
| 5 | **Communicate** | Email all sponsors / a tier / the stragglers, with templates | Be told when their session is accepted or scheduled |
| 6 | **Publish** | Sponsor wall on the event site by tier; "Presented by" on sessions; embeds | See exactly how they'll appear |
| 7 | **Run the event** | Who's presenting where and when; which deliverables are still missing | Their sessions' times and rooms, in their calendar |
| 8 | **Carry over** | Next year: same sponsors, same contacts, new event | — |

## 2. What exists today

**Built (this week):** `sponsors` table (name, free-text tier, website, session allowance,
notes); contacts as `people.sponsorId`; sessions as `submissions.sponsorId`; organizer
Sponsors page (table, drawer with Details / Contacts / Sessions / History, invites,
portal rules); `/sponsor` portal (Sessions with allowance + deadline, Team, Your
details); "Sponsor: X" in Submissions, a Sponsor field in the submission drawer,
"Presented by X" on public session pages; REST + MCP + webhooks; seed data; tests.

## 3. Gap analysis — organizer side ("setting up a sponsor as a whole")

| Stage | Gap | Severity |
|---|---|---|
| Sign | **No company profile.** No logo, no public description, no social links — the things the event site actually shows. | Must |
| Sign | **Tiers are free text.** No managed list, no order (Platinum above Gold), no defaults — every sponsor's allowance is typed by hand, and "Gold" vs "gold" are two tiers. | Must |
| Sign | **No public-visibility switch per sponsor** (embargoed until the announcement). | Should |
| Onboard | **Primary contact is implicit** (whoever was added first). No way to change it. | Should |
| Onboard | **No bulk setup.** 40 sponsors means 40 drawers: no CSV import, no "copy sponsors from last year's event". | Should |
| Collect | **No sponsor deliverables.** Tasks are per person, and the task tools only list people on the speaker roster — a sponsor contact who isn't presenting can't be assigned anything at all. There is no "upload your logo by Oct 1" for a company. | **Must** |
| Collect | **No company files.** Files a sponsor sends have nowhere to land and no review loop. | Must (comes with deliverables) |
| Review | Sponsor sessions review fine (they're submissions). Deliverable review missing with the above. | — |
| Communicate | **Sponsors aren't an email audience.** Bulk email can target speakers, accepted, incomplete tasks, hand-picked — not "all sponsor contacts" or "Gold sponsors". | **Must** |
| Communicate | **The sponsor isn't told about decisions.** Accept/decline emails go to the session's speakers; a contact who added the session but isn't presenting hears nothing. Same for "your session is scheduled". | Must |
| Publish | **No sponsor wall** on the public event site, no sponsor embed. "Presented by" is plain text with no logo. | Must |
| Run | No sponsor chip on agenda cards; no sponsor filter in Submissions or Agenda. | Should |
| Run | Dashboard says nothing about sponsors ("4 sponsors still owe a logo"). | Should |
| Carry over | Sponsors and contacts are per event, so next year starts from zero. | Later (see §6) |
| Platform | Not in global search (⌘K); not mirrored to Airtable; audit coverage uneven (separate project). | Should |

## 4. Gap analysis — the sponsor portal

| Gap | Severity |
|---|---|
| **No company profile page** — the sponsor can't set the logo / description / links the public site shows, or preview their listing. | Must |
| **No company tasks / deliverables** — the Tasks tab only shows person-level tasks. | Must |
| **No "what's still needed" overview** — the first question a sponsor has ("what do you need from us, by when?") isn't answered anywhere. | Must |
| **Scheduled sessions don't show their time and room** in the list (the card's compact mode hides it) and can't be added to a calendar from there. | Must (bug-class) |
| No notification when the organizer accepts/schedules a session (see §3). | Must |
| Speaker-side stays clean: contacts who present get the speaker portal; others never see speaker tabs. | ✓ done |

## 5. Contacts — why it feels "gigantically spread out"

The *data* is mostly centralized already: one `people` row per person per event holds
speakers, submitters, co-speakers and sponsor contacts. The *product* is not:

| Where a person shows up today | Who you can see there |
|---|---|
| Speakers page | only people on a submission/session or added as speakers |
| Sponsor drawer → Contacts | only that sponsor's contacts |
| Evaluation plan → Evaluators | reviewers — a **separate table**, keyed by email, not linked to the same person |
| Workspace → Members | staff (correctly separate — they're users, not contacts) |
| Communications → recipient picker | anyone in `people`, by search only |

There is **no single place that answers "who is this person to our event?"** — a
sponsor contact who is also a reviewer and co-presents a session exists in three
places that never mention each other, and a sponsor contact who presents nothing is
invisible outside one sponsor drawer.

**Fix, from first principles:** a **Contacts** directory per event — everyone in
`people`, plus reviewers matched by email — each with role chips (Speaker · Submitter ·
Moderator · Chairperson · Sponsor contact (Company) · Reviewer), filterable by role and
company, with ONE person drawer that shows every role, session, sponsor, task, file and
email for that person. Speakers and Sponsors stay as focused *views* (Sessionboard's
model too: "the Speakers module is a derived view, not a table").

Sidebar becomes: **People** → Contacts · Speakers · Sponsors · Files · Communications.

## 6. Cross-event identity (decision for later, flagged now)

Sessionboard keeps one contact record per person across all events in an organization.
Ours is per event. Moving to workspace-level contacts gives returning-speaker history and
"copy last year's sponsors" for free, but it touches every token, roster and email path.
**Recommendation:** ship the event-level Contacts directory and sponsor "copy from
another event" now; do workspace-level identity as its own project once the directory
proves the shape.

## 7. Plan (build order)

**Wave 1 — Sponsor foundation**
1. Managed **tiers** (name, order, default sessions included) under Sponsors → Settings; tier becomes a picker.
2. **Company profile**: logo upload, public description, website, LinkedIn, X; "Show on the event site" switch; explicit primary contact.
3. **Sponsor deliverables**: company-level tasks (confirm / answer / upload) assigned to one sponsor, many, or a whole tier, with due dates; any contact completes; uploads land in Files under the sponsor; "Still needed" counts them.
4. **Sponsor portal**: Overview (what's still needed, deadlines), Company profile (edit + public preview), Tasks (company deliverables), session cards showing time/room + add-to-calendar.

**Wave 2 — Reach**
5. Email audiences: **All sponsor contacts**, **by tier**, **sponsors with open deliverables**; `{{sponsorName}}` in templates.
6. Notify sponsor contacts on decisions and scheduling of their company's sessions.
7. Public **Sponsors page** by tier (logos, descriptions, links, their sessions) + logo on "Presented by" + sponsor embed widget.

**Wave 3 — Contacts & platform**
8. **Contacts directory** + unified person drawer; sidebar regrouped under People.
9. Sponsors in ⌘K search, dashboard card, Airtable mirror, CSV import/export, copy from another event; sponsor filter in Submissions/Agenda; agenda chip.

**Deliberately out:** payments/invoicing (struck by swyx), booth map / booth selection
(Kelsey's separate tool), lead retrieval, exhibitor as a separate record type (a tier
named "Exhibitor" covers it until it doesn't), Accelevents sync.
