#!/usr/bin/env node
// Post-purchase domain configuration for trackstage.app (rule/history #41).
// Run AFTER the domain is registered on Cloudflare (dashboard-only step):
//   CLOUDFLARE_EMAIL=… CLOUDFLARE_GLOBAL_API_KEY=… RESEND_API_KEY=… \
//     node scripts/configure-domain.mjs [domain]
// Does, idempotently:
//   1. Finds the Cloudflare zone for the domain.
//   2. Creates the domain on Resend (region us-east-1) if missing.
//   3. Writes Resend's required DNS records (SPF/DKIM/MX for sending) into the zone.
//   4. Triggers Resend verification and polls briefly.
//   5. Prints the env changes to apply (EMAIL_FROM, SITE_URL guidance).
const DOMAIN = process.argv[2] ?? "trackstage.app"

const CF_EMAIL = process.env.CLOUDFLARE_EMAIL
const CF_KEY = process.env.CLOUDFLARE_GLOBAL_API_KEY ?? process.env.CLOUDFLARE_API_KEY
const RESEND_KEY = process.env.RESEND_API_KEY
if (!CF_EMAIL || !CF_KEY) throw new Error("CLOUDFLARE_EMAIL / CLOUDFLARE_GLOBAL_API_KEY missing (run `cloudflare-env-global` first)")
if (!RESEND_KEY) throw new Error("RESEND_API_KEY missing")

const cf = async (path, init = {}) => {
  const res = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      "X-Auth-Email": CF_EMAIL,
      "X-Auth-Key": CF_KEY,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  const body = await res.json()
  if (!body.success) throw new Error(`CF ${path}: ${JSON.stringify(body.errors)}`)
  return body.result
}

const resend = async (path, init = {}) => {
  const res = await fetch(`https://api.resend.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${RESEND_KEY}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Resend ${path}: ${res.status} ${JSON.stringify(body)}`)
  return body
}

// 1. Zone
const zones = await cf(`/zones?name=${DOMAIN}`)
if (zones.length === 0) {
  console.error(`✗ No Cloudflare zone for ${DOMAIN} yet — register the domain first (dashboard → Domain Registration).`)
  process.exit(1)
}
const zone = zones[0]
console.log(`✓ zone ${DOMAIN} (${zone.id.slice(0, 8)}…) status=${zone.status}`)

// 2. Resend domain
const existing = (await resend("/domains")).data?.find((d) => d.name === DOMAIN)
const domain = existing ?? (await resend("/domains", { method: "POST", body: JSON.stringify({ name: DOMAIN, region: "us-east-1" }) }))
console.log(`✓ resend domain ${domain.id} status=${domain.status}`)

// 3. DNS records Resend requires
const detail = await resend(`/domains/${domain.id}`)
const wanted = detail.records ?? []
const current = await cf(`/zones/${zone.id}/dns_records?per_page=100`)
for (const record of wanted) {
  const name = record.name === "@" || record.name === DOMAIN ? DOMAIN : `${record.name}.${DOMAIN}`.replace(new RegExp(`\\.${DOMAIN}\\.${DOMAIN}$`), `.${DOMAIN}`)
  const type = record.record ?? record.type // resend uses `record`
  const content = record.value
  const match = current.find((r) => r.type === type && r.name === name)
  const payload = {
    type,
    name,
    content,
    ttl: 300,
    ...(type === "MX" ? { priority: Number(record.priority ?? 10) } : {}),
    proxied: false,
  }
  if (match) {
    if (match.content === content) {
      console.log(`  = ${type} ${name} (already correct)`)
      continue
    }
    await cf(`/zones/${zone.id}/dns_records/${match.id}`, { method: "PUT", body: JSON.stringify(payload) })
    console.log(`  ~ ${type} ${name} updated`)
  } else {
    await cf(`/zones/${zone.id}/dns_records`, { method: "POST", body: JSON.stringify(payload) })
    console.log(`  + ${type} ${name} created`)
  }
}

// 4. Verify
await resend(`/domains/${domain.id}/verify`, { method: "POST" })
for (let i = 0; i < 6; i++) {
  await new Promise((resolve) => setTimeout(resolve, 5000))
  const check = await resend(`/domains/${domain.id}`)
  console.log(`  verify: ${check.status}`)
  if (check.status === "verified") break
}

console.log(`
NEXT (apply manually / at deploy):
  · EMAIL_FROM="Trackstage <hello@${DOMAIN}>"   (convex env set EMAIL_FROM …)
  · SITE_URL=https://${DOMAIN}                   (convex env set SITE_URL … — prod only)
  · wrangler.jsonc: add routes/custom_domain for ${DOMAIN}
  · DNS propagation can take a few minutes; rerun this script to re-verify.
`)
