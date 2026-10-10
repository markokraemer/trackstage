import { RiEyeLine, RiEyeOffLine, RiGlobalLine, RiLinkM } from "@remixicon/react"

import { Tag, tagTone } from "@/components/shared/tag"
import { PanelCard } from "@/components/portal/panel-card"
import { usePortal } from "@/components/portal/portal-context"
import { initialsOf } from "@/components/portal/portal-utils"

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "")
}

/**
 * "How you'll appear on the event site" — a live preview of the sponsor-wall
 * card, built from exactly what is saved, so a sponsor never has to guess
 * what attendees will see. Reacts to every autosave.
 */
export function SponsorPreviewCard() {
  const { home } = usePortal()
  const sponsor = home.sponsor
  if (!sponsor) return null

  const links = [
    sponsor.websiteUrl
      ? { href: sponsor.websiteUrl, label: hostOf(sponsor.websiteUrl), icon: RiGlobalLine }
      : null,
    // Public link fields the organizers defined (LinkedIn, X, …).
    ...sponsor.fields
      .filter((f) => f.public && f.kind === "url" && f.value)
      .map((f) => ({ href: f.value as string, label: f.label, icon: RiLinkM })),
  ].filter((link) => link !== null)
  // Public text fields read as "Label: value" under the description.
  const facts = sponsor.fields.filter((f) => f.public && f.kind !== "url" && f.value)

  return (
    <PanelCard
      icon={sponsor.publicVisible ? RiEyeLine : RiEyeOffLine}
      title="How you'll appear on the event site"
      description={
        sponsor.publicVisible
          ? undefined
          : "The organizers haven't published sponsors yet — this is what attendees will see once they do."
      }
    >
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card">
            {sponsor.logoUrl ? (
              <img src={sponsor.logoUrl} alt="" className="size-full object-contain p-1.5" />
            ) : (
              <span className="text-base font-semibold text-muted-foreground">
                {initialsOf(...sponsor.name.split(" "))}
              </span>
            )}
          </span>
          <div className="min-w-0">
            <p className="font-heading truncate text-base font-semibold text-foreground">{sponsor.name}</p>
            {sponsor.tier ? (
              <Tag tone={tagTone(sponsor.tier)} className="mt-1">
                {sponsor.tier}
              </Tag>
            ) : null}
          </div>
        </div>
        {sponsor.description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{sponsor.description}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Add a description and it appears here.
          </p>
        )}
        {facts.length > 0 ? (
          <dl className="flex flex-col gap-1 text-sm">
            {facts.map((f) => (
              <div key={f.id} className="flex gap-1.5">
                <dt className="text-muted-foreground">{f.label}:</dt>
                <dd className="min-w-0 text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {links.length > 0 ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline-offset-4 hover:underline"
              >
                <link.icon size={14} aria-hidden />
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </PanelCard>
  )
}
