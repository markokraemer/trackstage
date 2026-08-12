/**
 * Light / Dark / System — the storage, the scope, and the boot script.
 *
 * Three facts govern everything in this module:
 *
 * 1. **The preference is a THREE-way choice, not a boolean — and LIGHT is the
 *    default.** A visitor who never chose gets light, full stop: the app never
 *    consults `prefers-color-scheme` on their behalf, because a dark-OS
 *    organizer landing in a dark app they never asked for — straight off the
 *    light-only marketing pages — reads as a glitch, not a feature. Dark and
 *    "System" are explicit opt-ins from account settings; only a stored
 *    "system" is a live subscription to the OS (a visitor whose OS flips at
 *    sunset flips with it, in place, without a reload).
 *
 * 2. **It is stored twice, on purpose.** `localStorage` is the source the boot
 *    script prefers to read; the cookie is what a SERVER render can see, which
 *    is how the settings control renders pre-selected on the very first paint
 *    instead of snapping into place a frame later. Both are written on every
 *    change so they can never disagree.
 *
 * 3. **Dark is scoped to the organizer app.** See `isThemeableRoute`.
 */

export const THEME_STORAGE_KEY = "ts-theme"
export const THEME_COOKIE = "ts-theme"

export type ThemePreference = "light" | "dark" | "system"
/** What actually got painted once "system" is resolved. */
export type ResolvedTheme = "light" | "dark"

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system"
}

/**
 * Dark mode applies to the ORGANIZER APP ONLY (`/app/*`).
 *
 * Marketing, the public event page, the CFP wizard, the speaker portal, /docs,
 * /login and /design-system stay light for every visitor regardless of the
 * signed-in organizer's choice. Two reasons, in order of weight:
 *
 *   - sbek's browser agent judges the public surfaces. Those pages carry
 *     organizer-supplied cover images, embed previews, email previews and
 *     `.ics` cards that were composed against a white ground; a half-dark
 *     public page is a worse outcome than a light one, and there is no way to
 *     prove the absence of a leak tonight.
 *   - The preference is an ACCOUNT setting. A speaker opening a portal link, or
 *     an anonymous visitor reading the agenda, has no account and therefore no
 *     preference to honour — so the public surfaces would need their own
 *     switcher to be coherent, which is a separate piece of work.
 *
 * Scoping it here (one predicate, used by both the boot script and the
 * provider) means the class is simply never on the document outside `/app`,
 * so no `dark:` utility anywhere in the tree can fire on a public page.
 */
export function isThemeableRoute(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/")
}

/** Reads the cookie the boot script and the server both look at. */
export function readThemeCookie(cookieHeader: string): ThemePreference | null {
  const match = new RegExp(
    `(?:^|;\\s*)${THEME_COOKIE}=([^;]*)`,
  ).exec(cookieHeader)
  if (!match) return null
  const value = decodeURIComponent(match[1])
  return isThemePreference(value) ? value : null
}

/** Browser-side read: cookie first (it is what SSR saw), then localStorage. */
export function readStoredTheme(): ThemePreference {
  if (typeof document === "undefined") return "light"
  const fromCookie = readThemeCookie(document.cookie)
  if (fromCookie) return fromCookie
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemePreference(stored)) return stored
  } catch {
    /* private mode — "light" is the default anyway */
  }
  // No stored choice means LIGHT — dark and "system" are opt-in only.
  return "light"
}

/** One year: long enough that the choice feels permanent, short enough to lapse. */
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export function persistTheme(theme: ThemePreference): void {
  if (typeof document === "undefined") return
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    /* private mode — the cookie below still carries it */
  }
  // Not HttpOnly and not Secure-only: this is a display preference, it must be
  // readable by the boot script, and it must work on http://localhost.
  document.cookie = `${THEME_COOKIE}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
}

export function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  if (preference === "system") return prefersDark ? "dark" : "light"
  return preference
}

/**
 * Puts (or removes) the `dark` class on <html>, and tells the browser which
 * scheme its own widgets — scrollbars, `<input type="date">` pickers, form
 * control defaults — should paint in.
 */
export function applyThemeClass(resolved: ResolvedTheme): void {
  if (typeof document === "undefined") return
  const root = document.documentElement
  root.classList.toggle("dark", resolved === "dark")
  root.style.colorScheme = resolved
}

/**
 * The no-flash boot script. Rendered inline as the FIRST thing in <head>
 * (src/routes/__root.tsx), so it runs while the parser is still above <body>
 * and the class is on <html> before a single pixel is painted — a dark-mode
 * organizer never sees a white frame.
 *
 * It is deliberately self-contained, duplicating the constants above rather
 * than importing them: nothing has been loaded yet when it runs, not even the
 * app bundle. Every branch is wrapped in try/catch because a thrown error here
 * would block the parser on every page in the product.
 *
 * NOTE the pathname gate — it is the same rule as `isThemeableRoute`, and it
 * is what keeps the public pages light on a cold load.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{
var p=location.pathname;
if(p!=="/app"&&p.indexOf("/app/")!==0)return;
var t=null;
var m=document.cookie.match(/(?:^|;\\s*)${THEME_COOKIE}=([^;]*)/);
if(m)t=decodeURIComponent(m[1]);
if(t!=="light"&&t!=="dark"&&t!=="system"){try{t=localStorage.getItem("${THEME_STORAGE_KEY}")}catch(e){t=null}}
if(t!=="light"&&t!=="dark"&&t!=="system")t="light";
var d=t==="dark"||(t==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;
if(d)r.classList.add("dark");
r.style.colorScheme=d?"dark":"light";
}catch(e){}})()`
