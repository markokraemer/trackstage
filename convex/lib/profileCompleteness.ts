/**
 * What "a complete speaker profile" means — ONE definition, server and client.
 *
 * The speaker already reads this on their portal meter ("Profile 75%
 * complete", four items). The server needs the identical verdict to tick the
 * organizer's "Update your profile" task off by itself, and a second, subtly
 * different rule would be worse than no rule at all: the meter would say
 * complete while the task stayed open, or the other way round. So the four
 * items live here, in `convex/lib` (the project's home for logic both sides
 * share — see `formWindow.ts`, `email.ts`), and both sides call in.
 *
 * NOTE this is deliberately not the organizer's chase list
 * (`convex/dashboard.ts::missingBits`, which counts slides too): that answers
 * "who do I need to chase?" across the whole roster, and slides are an upload,
 * not profile data.
 */

export interface ProfileFields {
  bio?: string
  jobTitle?: string
  company?: string
  links?: { linkedin?: string; twitter?: string; website?: string }
  /** The image itself lives in storage — pass whether one is attached. */
  hasHeadshot: boolean
}

export type CompletenessKey = "bio" | "headshot" | "details" | "links"

export interface CompletenessItem {
  key: CompletenessKey
  label: string
  done: boolean
}

export interface Completeness {
  items: Array<CompletenessItem>
  done: number
  total: number
  percent: number
}

function filled(value: string | undefined): boolean {
  return Boolean(value && value.trim().length > 0)
}

/** The four things a speaker profile needs, in the order the meter lists them. */
export function profileCompletenessOf(fields: ProfileFields): Completeness {
  const links = fields.links ?? {}
  const items: Array<CompletenessItem> = [
    { key: "bio", label: "Biography", done: filled(fields.bio) },
    { key: "headshot", label: "Headshot", done: fields.hasHeadshot },
    {
      key: "details",
      label: "Job title & company",
      done: filled(fields.jobTitle) && filled(fields.company),
    },
    {
      key: "links",
      label: "A link",
      done: filled(links.linkedin) || filled(links.twitter) || filled(links.website),
    },
  ]
  const done = items.filter((item) => item.done).length
  return {
    items,
    done,
    total: items.length,
    percent: Math.round((done / items.length) * 100),
  }
}

export function isProfileComplete(fields: ProfileFields): boolean {
  return profileCompletenessOf(fields).items.every((item) => item.done)
}
