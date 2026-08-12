/**
 * Whether this build advertises the seeded demo world: the demo organizer
 * credentials on /login, the demo entry points on the marketing page, the
 * demo speaker shortcut on /portal, and the demo links in the feature tour.
 *
 * Off by default in production builds, so a self-hosted deployment never
 * shows credentials for an account that was never seeded — and whose
 * password is public. Our own hosted deployments opt in with
 * `VITE_DEMO_MODE=1` (committed in .env.production / .env.staging). Local
 * dev counts as demo mode: `pnpm dev` talks to a seeded playground.
 */
export const DEMO_MODE =
  import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "1"
