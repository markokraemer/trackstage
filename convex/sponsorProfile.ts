import { v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { mutation } from "./_generated/server"
import type { AuditActor } from "./lib/audit"
import { record as recordAudit } from "./lib/audit"
import {
  cleanDescription,
  cleanWebsiteUrl,
  mergeFieldValues,
  requireSponsorContact,
  sponsorFieldsFor,
} from "./lib/sponsors"
import { emitSponsorUpdated, setSponsorLogoCore } from "./sponsors"

// ————————————————————————————————————————————————————————————————————————
// The company profile, from the SPONSOR's side (portal → Company). The
// sponsor maintains its public face — logo, website, description and the
// event's own company fields; name, tier and allowance stay with the
// organizers.
// ————————————————————————————————————————————————————————————————————————

function portalActor(person: Doc<"people">): AuditActor {
  return { type: "speaker", label: `${person.firstName} ${person.lastName}`.trim() || person.email }
}

export const updateCompanyProfile = mutation({
  args: {
    portalToken: v.string(),
    description: v.optional(v.string()),
    websiteUrl: v.optional(v.string()),
    /** `{fieldId → value}` — merged; an empty string clears one value. */
    fields: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { person, sponsor } = await requireSponsorContact(ctx, args.portalToken)
    const patch: Partial<Doc<"sponsors">> = {}
    if (args.description !== undefined) patch.description = cleanDescription(args.description)
    if (args.websiteUrl !== undefined) patch.websiteUrl = cleanWebsiteUrl(args.websiteUrl)
    if (args.fields !== undefined && Object.keys(args.fields).length > 0) {
      patch.fields = mergeFieldValues(
        sponsor.fields,
        await sponsorFieldsFor(ctx, sponsor.eventId),
        args.fields,
      )
    }
    if (Object.keys(patch).length === 0) return null
    await ctx.db.patch(sponsor._id, { ...patch, updatedAt: Date.now() })
    await recordAudit(ctx, {
      eventId: sponsor.eventId,
      entity: "sponsor",
      entityId: sponsor._id,
      action: "updated",
      summary: `${portalActor(person).label} updated the company profile`,
      meta: { fields: Object.keys(patch) },
      actor: portalActor(person),
    })
    await emitSponsorUpdated(ctx, sponsor._id)
    return null
  },
})

export const setCompanyLogo = mutation({
  args: {
    portalToken: v.string(),
    storageId: v.union(v.id("_storage"), v.null()),
    filename: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { person, sponsor } = await requireSponsorContact(ctx, args.portalToken)
    await setSponsorLogoCore(ctx, sponsor, args.storageId, args.filename, portalActor(person))
    return null
  },
})
