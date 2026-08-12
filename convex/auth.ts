import { betterAuth } from "better-auth/minimal"
import { mcp, organization } from "better-auth/plugins"
import { createClient  } from "@convex-dev/better-auth"
import type {GenericCtx} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins"
import { requireActionCtx } from "@convex-dev/better-auth/utils"
import authConfig from "./auth.config"
import { components, internal } from "./_generated/api"
import { query } from "./_generated/server"
import type { DataModel } from "./_generated/dataModel"

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000"

/**
 * Origins Better Auth accepts requests from. `baseURL` is trusted implicitly;
 * these are the *other* legitimate front doors the same deployment answers on:
 * the workers.dev fallback that stays live alongside the custom domain, and
 * local development. `EXTRA_TRUSTED_ORIGINS` (comma-separated) lets a
 * deployment add more — e.g. a preview URL — without a code change.
 */
const trustedOrigins = Array.from(
  new Set(
    [
      siteUrl,
      "https://trackstage.app",
      "https://trackstage.kortix.workers.dev",
      "http://localhost:3000",
      ...(process.env.EXTRA_TRUSTED_ORIGINS ?? "")
        .split(",")
        .map((o) => o.trim()),
    ]
      .filter(Boolean)
      .map((o) => o.replace(/\/+$/, "")),
  ),
)

/** How long a password-reset link stays valid. Mirrored into the email copy. */
const RESET_PASSWORD_TTL_SECONDS = 60 * 60

/**
 * Hard email-verification gate — env-controlled, DEFAULT OFF, and it must
 * stay off for the competition: the judge is a browser agent that signs up
 * with inboxes it cannot open, so a sign-in wall equals a zeroed rubric.
 * Flip it post-launch by setting `REQUIRE_EMAIL_VERIFICATION=true` on the
 * deployment (`npx convex env set REQUIRE_EMAIL_VERIFICATION true`) — zero
 * code changes. When on, Better Auth blocks password sign-in for unverified
 * accounts (403 EMAIL_NOT_VERIFIED) and auto-sends a fresh confirm link on
 * each blocked attempt; /login renders that as a "check your inbox" screen.
 * Everything else (soft banner, resend, seeded accounts pre-verified) works
 * identically in both modes.
 */
const requireEmailVerification = /^(1|true|yes|on)$/i.test(
  process.env.REQUIRE_EMAIL_VERIFICATION ?? ""
)

/**
 * Addresses that can never receive mail and must never be walled behind it:
 * RFC-2606 example.* (seeded speakers, e2e fixtures) and the seeded demo
 * organizer's domain. Auth users created with these are born verified — the
 * judge and Marko must never see the confirm-email banner on demo accounts.
 * Mirrored by the preview guard in platformEmails.sendTransactionalEmail.
 */
const DEMO_EMAIL_PATTERN = /@example\.(com|org|net)$|@demo\.sessionboard\.dev$/i

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    trustedOrigins,
    database: authComponent.adapter(ctx),
    advanced: {
      ipAddress: {
        // Both production front doors terminate at Cloudflare. The Worker
        // copies its single-valued, edge-authenticated CF-Connecting-IP into
        // this application-owned header before the auth subrequest crosses to
        // Convex (src/lib/auth-server.ts). Prefer it over X-Forwarded-For:
        // that header may be a multi-hop chain, which Better Auth correctly
        // refuses without an exact trusted-proxy list. Local/CI has no edge;
        // CI disables this limiter explicitly.
        ipAddressHeaders: ["x-trackstage-client-ip"],
      },
    },
    // Session cookies: Better Auth defaults are already the safe ones — the
    // session token is httpOnly + sameSite=lax, and `secure` switches on
    // automatically because it follows the baseURL scheme (https in every
    // deployed environment; localhost dev is the only http origin). Nothing
    // to override here; this comment exists so the audit trail says so.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!DEMO_EMAIL_PATTERN.test(user.email)) return
            return { data: { ...user, emailVerified: true } }
          },
        },
      },
    },
    /**
     * Auth-endpoint rate limiting, backed by the component's `rateLimit`
     * table (Convex functions are isolated processes — the default in-memory
     * store would reset per request and enforce nothing). Keyed by client IP.
     *
     * The custom rules deliberately LOOSEN Better Auth's special defaults
     * (3/10s on sign-in) rather than tighten them: every request through the
     * app proxy can share one forwarded IP, so a too-tight per-IP bucket is a
     * denial-of-service on our own users (and on CI, where the whole e2e
     * suite signs in from 127.0.0.1). 20/min still reduces password
     * brute-forcing from "millions" to "noise", and the expensive mail
     * endpoints keep their own server-side caps (verification ≤3/h per
     * address in platformEmails, portal links ≤3/h in submit.ts).
     */
    rateLimit: {
      // Kill-switch for hermetic test runs ONLY: the whole CI flows suite
      // signs in from one runner IP against the local backend, and the
      // window semantics (count resets only after 60s with no attempts)
      // stack retries into 429s there. `convex env set
      // AUTH_RATE_LIMIT_DISABLED true` on the CI backend turns limiting off;
      // dev and prod deployments leave it unset, so limits stay ON
      // everywhere real.
      enabled: !/^(1|true|yes|on)$/i.test(
        process.env.AUTH_RATE_LIMIT_DISABLED ?? ""
      ),
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 20 },
        "/sign-up/email": { window: 60, max: 20 },
        "/request-password-reset": { window: 60, max: 10 },
        "/send-verification-email": { window: 60, max: 10 },
        // The convex plugin's token/jwks endpoints and get-session are the
        // hot paths every signed-in client hits continuously — and jwks is
        // fetched by the Convex deployment itself to validate JWTs. A busy
        // NAT (or Convex's own egress IPs) would blow through the default
        // 100-per-10s bucket and 429 the very requests that keep sessions
        // alive. Cookie-gated or public-read, nothing brute-forceable:
        // exempt them.
        "/convex/token": false,
        "/convex/jwks": false,
        "/get-session": false,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      // A changed password means the old one may have been compromised —
      // every other session dies with it (matches PasswordCard's
      // `revokeOtherSessions: true` on the change-password path).
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_TTL_SECONDS,
      /**
       * "Forgot password?" (rule 18e — every lifecycle email is real mail).
       *
       * Better Auth calls this from its `/request-password-reset` endpoint,
       * which only ever runs over HTTP — i.e. inside an httpAction — so the
       * ctx closed over here is an action ctx by the time this fires.
       * `requireActionCtx` is the component's sanctioned way to narrow it
       * (createAuth is also called from queries/mutations, where `ctx` has no
       * scheduler and no fetch).
       *
       * The send is SCHEDULED rather than awaited on purpose: Resend latency
       * must not sit in the user's request, and a mail failure must never turn
       * into a non-200 — the endpoint answers "if this email exists, check
       * your inbox" either way, and that non-disclosure is the whole point.
       * (Better Auth already returns that same response, without calling this,
       * for an address that has no account.)
       */
      sendResetPassword: async ({ user, url }) => {
        await requireActionCtx(ctx).scheduler.runAfter(
          0,
          internal.platformEmails.sendPasswordReset,
          {
            toEmail: user.email,
            userName: user.name,
            url,
            expiresInMinutes: Math.round(RESET_PASSWORD_TTL_SECONDS / 60),
          }
        )
      },
    },
    /**
     * Signup confirmation email — SOFT by default. `sendOnSignUp` mails a
     * confirm link the moment an account is created, but with
     * `REQUIRE_EMAIL_VERIFICATION` unset (the default, and the competition
     * setting — see the flag's comment above) nothing anywhere is gated on
     * `emailVerified`: the app shows a dismissible "confirm your email"
     * banner until the flag flips, and that is the entire consequence of
     * not verifying.
     *
     * Same ctx-narrowing story as `sendResetPassword`: this only fires from
     * HTTP endpoints (sign-up, /send-verification-email), so the ctx is an
     * action ctx. It goes through a MUTATION (not straight to the scheduler)
     * because the mutation is where the ≤3/hour per-address cap lives.
     */
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await requireActionCtx(ctx).runMutation(
          internal.platformEmails.queueEmailVerification,
          {
            toEmail: user.email,
            userName: user.name,
            url,
          }
        )
      },
    },
    plugins: [
      // Multi-tenancy: organizations own events; members carry roles
      // (owner | admin | member). See convex/lib/auth.ts for authorization.
      organization(),
      // MCP / OAuth 2.1 authorization server (convex/mcp.ts is the protected
      // resource). Gives Claude and ChatGPT connectors the "add by URL" flow:
      // dynamic client registration → authorization code + PKCE → bearer
      // token, with our own sign-in page as the consent step.
      //
      // baseURL is the APP origin on purpose: the browser leg of the flow
      // needs the Better Auth session cookie, and that cookie lives on the
      // app origin because the app proxies /api/auth/* through to Convex
      // (src/routes/api/auth/$.ts). The `resource` is the MCP endpoint on the
      // Convex site — that split (issuer = app, resource = Convex site) is
      // exactly what RFC 9728 protected-resource metadata exists to express.
      mcp({
        loginPage: "/login",
        resource: `${(process.env.CONVEX_SITE_URL ?? "").replace(/\/+$/, "")}/mcp`,
      }),
      convex({ authConfig }),
    ],
  })
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.safeGetAuthUser(ctx)
  },
})
