# Sessionboard OSS

An open-source alternative to [Sessionboard](https://www.sessionboard.com) — conference speaker, CFP, and program management. Built for the "$10,000 Kill My SaaS" competition (brief in `docs/initial-brief/`).

The flow it covers: **event → call for speakers → submission → review & decision → speaker onboarding → scheduled agenda → published program.**

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) v1 (React 19, Vite 8) | Native Cloudflare Workers target, sub-second builds, type-safe routing |
| Backend | [Convex](https://convex.dev) | Reactive queries, scheduled functions for reminders, built-in file storage |
| UI | [shadcn/ui](https://ui.shadcn.com) on [Base UI](https://base-ui.com) | Base UI is the current shadcn default primitive layer |
| Hosting | Cloudflare Workers via `@cloudflare/vite-plugin` | No adapter — Start compiles straight to a Worker |

## Requirements covered

Per the brief (items 7–9 and AI-assisted review were struck by the organizer):

1. Custom call-for-speakers forms with conditional logic and category-based track routing
2. Self-service speaker portal — bios, headshots, slides, supporting documents
3. Automated templated speaker communications, reminders, and `.ics` calendar invites
4. Submission evaluation and scoring workflows across multiple rounds
5. Drag-and-drop agenda building with conflict detection across rooms and tracks; list, day, week, track, and room views
6. Real-time dashboard of speakers with outstanding onboarding tasks

Bonus targets: Cloudflare deploy, a public API, and speed.

## Getting started

```sh
pnpm install
pnpm dev:setup   # provisions a Convex deployment (interactive login) and writes .env.local
pnpm dev         # http://localhost:3000
```

Run `pnpm dev:convex` alongside `pnpm dev` to push backend function changes as you edit them.

## Deploy

```sh
pnpm deploy      # convex deploy && wrangler deploy
```

Set `VITE_CONVEX_URL` in the Worker environment to the production Convex URL.

## Layout

```
convex/          Convex schema and server functions (queries, mutations, crons, HTTP API)
src/routes/      File-based routes — organizer app, public CFP, speaker portal
src/components/  UI components (shadcn/ui in components/ui)
src/router.tsx   Router + Convex/TanStack Query integration
```

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server |
| `pnpm dev:convex` | Watch and push Convex functions |
| `pnpm build` | Production build |
| `pnpm preview` | Build, then serve the Worker locally via Wrangler |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest |

## MCP

Sessionboard ships a full [Model Context Protocol](https://modelcontextprotocol.io) server,
so you can run your whole event from Claude, ChatGPT, Codex or any MCP client — "how many
talks are still pending?", "accept everything in the queue", "auto-fill the agenda", "which
speakers still owe me slides?".

**Endpoint:** `https://<your-convex-site>.convex.site/mcp` (MCP Streamable HTTP, JSON-RPC
over POST). Your deployment's URL is shown in **Settings → API & MCP**.

**27 tools**, covering everything the organizer app does:

| Area | Tools |
| --- | --- |
| Workspaces & events | `list_workspaces` · `list_events` · `create_event` · `get_event_overview` |
| Forms | `list_forms` · `get_form` · `create_form` · `update_form_settings` · `get_public_form_link` |
| Submissions & decisions | `list_submissions` · `get_submission` · `set_submission_status` · `commit_decision_queue` · `add_manual_session` |
| Agenda | `get_agenda` · `schedule_session` · `unschedule_session` · `auto_place_sessions` |
| Speakers & tasks | `list_speakers` · `get_speaker_portal_link` · `assign_task` · `send_reminders` |
| Communications | `list_templates` · `update_template` · `list_outbox` · `send_test_email` |
| Meta | `get_event_summary` |

Every `event` argument accepts an event id **or** its slug. Decisions stay two-step on
purpose: `set_submission_status` only stages them, and `commit_decision_queue` — which
actually emails speakers — refuses to run without `confirm: true`.

### Connecting

**Claude Code** (or any client that can send a header) — create a key in
**Settings → API & MCP**, then:

```sh
claude mcp add sessionboard --transport http \
  https://<your-convex-site>.convex.site/mcp \
  --header "Authorization: Bearer sb_live_..."
```

**Claude / ChatGPT connectors** — add a custom connector by URL and paste the endpoint.
Sessionboard is a full OAuth 2.1 authorization server (dynamic client registration +
authorization code + PKCE, via Better Auth's MCP plugin), so you just sign in with your
Sessionboard account in the browser. No key to copy.

**Codex** — in `~/.codex/config.toml`:

```toml
[mcp_servers.sessionboard]
url = "https://<your-convex-site>.convex.site/mcp"
http_headers = { Authorization = "Bearer sb_live_..." }
```

**Any other client:**

```json
{
  "mcpServers": {
    "sessionboard": {
      "type": "http",
      "url": "https://<your-convex-site>.convex.site/mcp",
      "headers": { "Authorization": "Bearer sb_live_..." }
    }
  }
}
```

### Authorization

An API key is an *identity*, not a capability: it resolves to your user account, and every
tool call then runs the same workspace-membership checks as the web app
(`convex/lib/auth.ts`). A key can never reach a workspace you're not a member of, and
admin-only actions (like committing a decision queue) still require the admin role. Only a
sha-256 hash of each key is stored — the plaintext is shown once, at creation, and revoking
a key takes effect immediately.

### REST API

The same data is also available over plain HTTP — see `/v1/event/{slug}/sessions`,
`/speakers`, `/submissions` and the no-auth `/schedule.ics` feed in `convex/http.ts`.
