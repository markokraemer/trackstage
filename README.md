# Sessionboard OSS

An open-source alternative to [Sessionboard](https://www.sessionboard.com) — conference speaker, CFP, and program management. Built for the "$10,000 Kill My SaaS" competition (brief in `$10,0000 Kill My SaaS - Competition Brief/`).

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
