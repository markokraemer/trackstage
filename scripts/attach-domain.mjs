#!/usr/bin/env node
/**
 * One command to put a domain in front of the production deployment.
 *
 * `scripts/configure-domain.mjs` handles the *email* half (Resend domain +
 * SPF/DKIM/MX records). This handles the *app* half and then rebinds every
 * origin-dependent setting, in the order that keeps the app working while it
 * changes hands:
 *
 *   1. Attach the domain to the Cloudflare Worker as a custom domain
 *      (Cloudflare provisions the DNS record and the certificate).
 *   2. Wait for the domain to actually serve a 200.
 *   3. Point the production Convex deployment at it — SITE_URL drives Better
 *      Auth's baseURL (login, password-reset links, the MCP OAuth issuer) and
 *      every portal/email link the backend generates.
 *   4. Move EMAIL_FROM onto the domain, but only once Resend says it is
 *      verified — sending from an unverified domain bounces.
 *
 * Everything is idempotent: re-running it on an already-attached domain
 * re-checks and re-applies, and reports "already correct" instead of failing.
 *
 * Usage:
 *   source ~/.zshrc && cloudflare-env-global   # CLOUDFLARE_EMAIL + _GLOBAL_API_KEY
 *   RESEND_API_KEY=$(pnpm exec convex env get RESEND_API_KEY --prod) \
 *     node scripts/attach-domain.mjs [domain] [worker-name]
 *
 * A scoped CLOUDFLARE_API_TOKEN (Workers Scripts Write + Zone DNS/Routes
 * Write) works too and is preferred — it is what CI uses.
 */
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const DOMAIN = (process.argv[2] ?? "trackstage.app").replace(/^https?:\/\//, "").replace(/\/+$/, "")
const WORKER = process.argv[3] ?? "trackstage"
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url))

const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
const CF_KEY = process.env.CLOUDFLARE_GLOBAL_API_KEY ?? process.env.CLOUDFLARE_API_KEY
const RESEND_KEY = process.env.RESEND_API_KEY
if (!CF_TOKEN && !(CF_EMAIL && CF_KEY)) {
  throw new Error(
    "Cloudflare credentials missing: set CLOUDFLARE_API_TOKEN, or CLOUDFLARE_EMAIL + CLOUDFLARE_GLOBAL_API_KEY (`cloudflare-env-global`).",
  )
}

const cfHeaders = CF_TOKEN
  ? { Authorization: `Bearer ${CF_TOKEN}` }
  : { "X-Auth-Email": CF_EMAIL, "X-Auth-Key": CF_KEY }

async function cf(path, init = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { ...cfHeaders, "Content-Type": "application/json", ...init.headers },
  })
  const body = await res.json()
  if (!body.success) throw new Error(`CF ${path}: ${JSON.stringify(body.errors)}`)
  return body.result
}

/** `convex env set … --prod`, through the repo's own CLI. */
function convexEnv(args) {
  return execFileSync("pnpm", ["exec", "convex", ...args], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim()
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ——— 1. Zone + Worker custom domain ————————————————————————————————————
const zones = await cf(`/zones?name=${DOMAIN}`)
if (zones.length === 0) {
  console.error(
    `✗ No Cloudflare zone for ${DOMAIN}. Register the domain (or add the zone) first, then re-run.`,
  )
  process.exit(1)
}
const zone = zones[0]
console.log(`✓ zone ${DOMAIN} (${zone.id.slice(0, 8)}…) status=${zone.status}`)

const accountId = zone.account?.id
if (!accountId) throw new Error("Zone response carried no account id")

const domains = await cf(`/accounts/${accountId}/workers/domains`)
const attached = domains.find((d) => d.hostname === DOMAIN)
if (attached && attached.service === WORKER) {
  console.log(`  = ${DOMAIN} → worker "${WORKER}" (already attached)`)
} else {
  await cf(`/accounts/${accountId}/workers/domains`, {
    method: "PUT",
    body: JSON.stringify({
      environment: "production",
      hostname: DOMAIN,
      service: WORKER,
      zone_id: zone.id,
    }),
  })
  console.log(`  + ${DOMAIN} → worker "${WORKER}" attached`)
}
console.log(
  `  ℹ wrangler.jsonc should carry the same declaration so deploys keep it:\n` +
    `    "routes": [{ "pattern": "${DOMAIN}", "custom_domain": true }]`,
)

// ——— 2. Wait for the origin to serve ——————————————————————————————————
process.stdout.write(`\n· waiting for https://${DOMAIN} to answer 200 `)
let serving = false
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const res = await fetch(`https://${DOMAIN}/`, { redirect: "follow" })
    if (res.status === 200) {
      serving = true
      break
    }
  } catch {
    // DNS/cert still provisioning — keep waiting.
  }
  process.stdout.write(".")
  await sleep(10_000)
}
console.log(serving ? " ✓" : " ✗ (still not serving)")
if (!serving) {
  console.error(
    `✗ ${DOMAIN} is not serving yet. DNS + certificate provisioning can take a few minutes;\n` +
      `  re-run this script — steps 3 and 4 are skipped until the origin is live so the\n` +
      `  deployment never points at a domain that does not answer.`,
  )
  process.exit(1)
}

// ——— 3. Rebind the backend's notion of "where the app lives" ——————————
const siteUrl = `https://${DOMAIN}`
const currentSiteUrl = convexEnv(["env", "get", "SITE_URL", "--prod"]).split("\n").pop()
if (currentSiteUrl === siteUrl) {
  console.log(`  = SITE_URL already ${siteUrl}`)
} else {
  convexEnv(["env", "set", "SITE_URL", siteUrl, "--prod"])
  console.log(`  ~ SITE_URL ${currentSiteUrl || "(unset)"} → ${siteUrl}`)
}
console.log(
  `  ℹ .env.production: set VITE_SITE_URL=${siteUrl} and redeploy so the client bundle agrees.`,
)
console.log(
  `  ℹ convex/auth.ts trustedOrigins already includes ${siteUrl}; add EXTRA_TRUSTED_ORIGINS\n` +
    `    on the deployment for any additional origin (preview URLs etc.).`,
)

// ——— 4. Email sender, once Resend has verified the domain ————————————
if (!RESEND_KEY) {
  console.log(
    `\n· RESEND_API_KEY not set — skipping the email step.\n` +
      `  Run scripts/configure-domain.mjs first, then re-run with RESEND_API_KEY to move EMAIL_FROM.`,
  )
} else {
  const res = await fetch("https://api.resend.com/domains", {
    headers: { Authorization: `Bearer ${RESEND_KEY}` },
  })
  const list = await res.json()
  const rd = (list.data ?? []).find((d) => d.name === DOMAIN)
  if (!rd) {
    console.log(
      `\n· ${DOMAIN} is not registered on Resend yet — run:\n` +
        `    node scripts/configure-domain.mjs ${DOMAIN}`,
    )
  } else if (rd.status !== "verified") {
    console.log(
      `\n· Resend domain status=${rd.status} — leaving EMAIL_FROM alone.\n` +
        `  Re-run once verification completes (DNS propagation), or force it with:\n` +
        `    pnpm exec convex env set EMAIL_FROM "Trackstage <hello@${DOMAIN}>" --prod`,
    )
  } else {
    const from = `Trackstage <hello@${DOMAIN}>`
    const currentFrom = convexEnv(["env", "get", "EMAIL_FROM", "--prod"]).split("\n").pop()
    if (currentFrom === from) {
      console.log(`  = EMAIL_FROM already ${from}`)
    } else {
      convexEnv(["env", "set", "EMAIL_FROM", from, "--prod"])
      console.log(`  ~ EMAIL_FROM ${currentFrom || "(unset)"} → ${from}`)
    }
  }
}

console.log(`
✔ ${DOMAIN} is attached.
  Verify end-to-end:  APP_URL=https://${DOMAIN} node scripts/smoke-production.mjs
`)
