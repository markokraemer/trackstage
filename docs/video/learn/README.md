# learn.sessionboard.com walkthrough videos — Gemini analyses

The official Sessionboard product-education videos (`learn.sessionboard.com/videos/*`), each run
through `google/gemini-3.6-flash` on OpenRouter with a combined **transcript + screen-action +
UI-inventory + requirements** prompt (the same pipeline as `docs/video/master.md`).

Every video is a Guidde playbook embedded from `embed.app.guidde.com/playbooks/<id>`; the direct
`.mp4` asset was resolved by loading the embed in headless Chromium and capturing the media
request, then handed to Gemini as a `video_url` content part.

Each file closes with five analysis sections: **A. Screen inventory · B. Feature/capability list ·
C. Data-model signals · D. Organizer vs participant · E. UX/UI craft notes.**

The synthesis of all of this — plus the 177 crawled help-centre pages and a frame-by-frame visual
pass — lives in **[`docs/reference/sessionboard-product-map.md`](../../reference/sessionboard-product-map.md)**.
Start there; these files are the raw evidence.

| File | Video | Area |
|---|---|---|
| `video-session-submission-form.md` | Session submission form | Forms — the 4-page classic builder, field rules, form settings |
| `video-forms.md` | Forms | **Portal** forms (contacts/groups/sessions) + confirmation-email PDF |
| `video.md` | Fields | Custom fields: 4 scopes, types, event vs global level |
| `video-file-requests.md` | File requests | File-request creation + portal assignment |
| `video-create-a-session.md` | Create a session | Manual session creation |
| `video-session-settings.md` | Session settings | Rooms · Tracks · Tags · Levels · Formats · Languages · Files · **custom statuses** |
| `decline-sessions.md` | Accept/Decline sessions | The 5 statuses, inline + bulk status editing, portal masking |
| `video-agenda-building.md` | Agenda building | 5 views, drag-drop, conflicts, agenda settings |
| `video-ai-agenda-builder.md` | AI agenda builder | Draft → criteria → generate → **review diff → commit** |
| `video-embeds.md` | Embeds | Embed wizard: type · style · filters · fields · get code |
| `video-evaluation-plans.md` | Evaluation plans | 6-step plan wizard, rubric weights, rating icons, evaluation limits |
| `video-tasks.md` | Tasks | Task library, **Use Field** personalisation, portal assignment |
| `video-files.md` | Files | Portal file library (shared downloads) |
| `video-session-files.md` | (Session) files | Session file upload, versions, comments, bulk download |
| `video-custom-portals.md` | Custom portals | Filter-defined portal segmentation + ordering |
| `video-portal-settings-appearance.md` | Portal settings & appearance | Every portal Configuration toggle + Appearance + Manage Fields |
| `wiki-pages.md` | Resources/Wiki pages | Portal resource pages *(struck by swyx — context only)* |
| `video-create-a-contact.md` | Create a contact | Contact creation, org-wide search, Speakers-module derivation |
| `video-creating-sending-emails.md` | Creating & sending emails | Recipient selection, templates, **per-recipient review step** |
| `video-email-templates.md` | Settings — email templates | Template Type scoping and merge tags |
| `video-history.md` | History | Emails · SMS · Audit log |
| `video-reports.md` | Reports | 4 report types, relationships, filters, XLSX/CSV |
| `video-event-settings.md` | Settings — event details | Event details incl. logo/background dimensions |
| `video-settings-record-settings.md` | Settings — record settings | Record settings block |
| `video-event-team.md` | Event team | Invite users, roles, permissions, tags |
| `video-ai-content-remix.md` | AI content remix | Studio → Remix *(out of scope — context only)* |

## Not analysable

| Video | Host | Why |
|---|---|---|
| Portals (Pro) | `youtube.com/embed/6QhdvNAGPco` | YouTube embed with no inline transcript on the page; covered in prose by `/portals/portals-101` |
| AI evaluations | `youtube.com/embed/BXSO-KO35qs` | ditto; covered by `/evaluations/ai-evaluations` (out of scope anyway) |
| Importing data | `loom.com/embed/66d0dd40…` | Loom embed, no transcript; `/settings/importing-data` documents the full contract in more detail |

Every other `/videos/*` page also ships a **verbatim timestamped transcript inside its HTML**
(a `<details>Video transcript</details>` block). All 25 of them are captured in
**[`transcripts.md`](transcripts.md)** — so the narration layer is complete and independently
checkable even for the videos whose Gemini pass timed out.
