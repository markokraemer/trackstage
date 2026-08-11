import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  RiAddLine,
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiDownloadLine,
  RiCalendarScheduleLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiFileList3Line,
  RiFilter3Line,
  RiInformationLine,
  RiSettings3Line,
  RiSurveyLine,
  RiUserVoiceLine,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import { cn } from "@/lib/utils"
import { Logo, LogoMark, Wordmark } from "@/components/brand/logo"
import { InteractionsCatalog } from "@/components/interactions/catalog"
import { DesignExplorations } from "@/components/brand/explorations"
import {
  BRAND_PRIMARY,
  brandSvg,
  downloadBrandPng,
  downloadFaviconPng,
  downloadOgImagePng,
  downloadSocialAvatarPng,
  downloadSvg,
  markBoxedSvg,
  ogImageSvg,
  socialAvatarSvg,
} from "@/components/brand/assets"
import type { BrandTone, BrandVariant } from "@/components/brand/assets"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/page-header"
import { EmptyState } from "@/components/shared/empty-state"
import { DataToolbar } from "@/components/shared/data-toolbar"
import { DrawerShell } from "@/components/shared/drawer-shell"
import { WizardShell } from "@/components/shared/wizard-shell"
import {
  GENERIC_STATUSES,
  StatusPill,
  SUBMISSION_STATUSES,
} from "@/components/shared/status-pill"

export const Route = createFileRoute("/design-system")({
  component: DesignSystemPage,
})

const SECTIONS = [
  { id: "brand", label: "Brand & assets" },
  { id: "color", label: "Color" },
  { id: "typography", label: "Typography" },
  { id: "layout", label: "Layout & width" },
  { id: "shape", label: "Shape & elevation" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Form controls" },
  { id: "status", label: "Status pills" },
  { id: "data", label: "Data display" },
  { id: "feedback", label: "Feedback" },
  { id: "overlays", label: "Overlays" },
  { id: "patterns", label: "App patterns" },
  { id: "interactions", label: "Interactions" },
  { id: "explorations", label: "Explorations" },
] as const

/** The one container system — mirrors the `--container-*` tokens in styles.css. */
const CONTAINERS: Array<{
  utility: string
  token: string
  width: string
  use: string
}> = [
  {
    utility: "container-app",
    token: "--container-app",
    width: "100% − gutter",
    use: "Organizer app content and its top bar. Full-bleed inside the shell so tables get every pixel.",
  },
  {
    utility: "container-page",
    token: "--container-page",
    width: "72rem",
    use: "Every public surface: marketing bands, event pages, speaker portal, review queue.",
  },
  {
    utility: "container-narrow",
    token: "--container-narrow",
    width: "42rem",
    use: "Single-column forms — the public submit flow, create-form screens.",
  },
  {
    utility: "container-card",
    token: "--container-card",
    width: "25rem",
    use: "Centred entry cards: sign in, portal magic-link, invalid-link states.",
  },
  {
    utility: "container-reading",
    token: "--container-reading",
    width: "65ch",
    use: "Prose measure. Width only — no gutter, no centring — so it caps a paragraph in place.",
  },
]

type SurfaceKey = "light" | "dark" | "primary"

const SURFACES: Record<SurfaceKey, { className: string; tone: BrandTone }> = {
  light: { className: "bg-white", tone: "color" },
  dark: { className: "bg-[#12141A]", tone: "inverse" },
  primary: { className: "bg-primary", tone: "inverse" },
}

const LOGO_VARIANTS: Array<{
  id: BrandVariant
  label: string
  svgSize: number
  preview: (tone: BrandTone) => React.ReactNode
}> = [
  {
    id: "mark-boxed",
    label: "Mark — boxed (app icon)",
    svgSize: 512,
    preview: (tone) => (
      <LogoMark
        size={56}
        variant="boxed"
        className={tone === "inverse" ? "bg-white text-primary" : undefined}
      />
    ),
  },
  {
    id: "mark-plain",
    label: "Mark — plain (mono, currentColor)",
    svgSize: 512,
    preview: (tone) => (
      <LogoMark
        size={56}
        variant="plain"
        className={tone === "inverse" ? "text-white" : undefined}
      />
    ),
  },
  {
    id: "lockup",
    label: "Full lockup — mark + wordmark",
    svgSize: 512,
    preview: (tone) => (
      <span className="inline-flex items-center gap-3">
        <LogoMark
          size={44}
          variant="plain"
          className={tone === "inverse" ? "text-white" : undefined}
        />
        <Wordmark
          size="xl"
          className={cn("text-2xl", tone === "inverse" && "text-white")}
        />
      </span>
    ),
  },
  {
    id: "wordmark",
    label: "Wordmark only",
    svgSize: 512,
    preview: (tone) => (
      <Wordmark
        size="xl"
        className={cn("text-3xl", tone === "inverse" && "text-white")}
      />
    ),
  },
]

interface Swatch {
  name: string
  token: string
  hex: string
  fg?: string
}

const SURFACE_COLORS: Array<Swatch> = [
  { name: "Page background", token: "--background", hex: "#FAFAFA" },
  { name: "Card", token: "--card", hex: "#FFFFFF" },
  { name: "Sidebar", token: "--sidebar", hex: "#FAFAFA" },
  { name: "Muted", token: "--muted", hex: "#F7F7F8" },
  { name: "Accent (hover/selected)", token: "--accent", hex: "#F4F4F5" },
  { name: "Border", token: "--border", hex: "#EAEAEC" },
]

const BRAND_COLORS: Array<Swatch> = [
  { name: "Primary", token: "--primary", hex: "#2F5CE0", fg: "#FFFFFF" },
  {
    name: "Primary hover",
    token: "--primary-hover",
    hex: "#2950C0",
    fg: "#FFFFFF",
  },
  { name: "Text (ink)", token: "--foreground", hex: "#17171A", fg: "#FFFFFF" },
  {
    name: "Muted text",
    token: "--muted-foreground",
    hex: "#6E6E76",
    fg: "#FFFFFF",
  },
  {
    name: "Accent text",
    token: "--accent-foreground",
    hex: "#17171A",
    fg: "#FFFFFF",
  },
  {
    name: "Destructive",
    token: "--destructive",
    hex: "#DC2626",
    fg: "#FFFFFF",
  },
]

const STATUS_COLORS: Array<Swatch> = [
  { name: "Green fill", token: "--status-green-bg", hex: "#D1FAE5" },
  {
    name: "Green text",
    token: "--status-green-fg",
    hex: "#065F46",
    fg: "#FFFFFF",
  },
  { name: "Amber fill", token: "--status-amber-bg", hex: "#FEF3C7" },
  {
    name: "Amber text",
    token: "--status-amber-fg",
    hex: "#92400E",
    fg: "#FFFFFF",
  },
  { name: "Red fill", token: "--status-red-bg", hex: "#FEE2E2" },
  { name: "Red text", token: "--status-red-fg", hex: "#991B1B", fg: "#FFFFFF" },
  { name: "Gray fill", token: "--status-gray-bg", hex: "#F4F4F5" },
  { name: "Neutral fill", token: "--status-blue-bg", hex: "#F4F4F5" },
]

/**
 * Categorical tints — the ONE place a soft colour is allowed outside the status
 * ramp. Track, format, level, language, free tags. Never state.
 */
const TAG_COLORS: Array<Swatch> = [
  { name: "Tag · blue", token: "--tag-blue-bg", hex: "#E6F0FB" },
  { name: "Tag · green", token: "--tag-green-bg", hex: "#E7F4EC" },
  { name: "Tag · amber", token: "--tag-amber-bg", hex: "#FBF0DC" },
  { name: "Tag · purple", token: "--tag-purple-bg", hex: "#F3EAFB" },
  { name: "Tag · gray", token: "--tag-gray-bg", hex: "#F4F4F5" },
]

const TYPE_SCALE = [
  {
    label: "Page title",
    className: "font-heading text-xl font-semibold",
    note: "20px / 600",
  },
  {
    label: "Section title",
    className: "font-heading text-base font-semibold",
    note: "16px / 600",
  },
  { label: "Body", className: "text-sm", note: "14px / 400" },
  { label: "Label", className: "text-sm font-medium", note: "14px / 500" },
  {
    label: "Helper text",
    className: "text-sm text-muted-foreground",
    note: "14px / muted",
  },
  {
    label: "Meta / pill",
    className: "text-xs text-muted-foreground",
    note: "12px / muted",
  },
  {
    label: "Group label",
    className:
      "text-[11px] font-semibold tracking-wider uppercase text-muted-foreground",
    note: "11px / 600 / uppercase",
  },
]

const WIZARD_STEPS = [
  { id: "setup", title: "Setup", description: "Abstracts or sessions" },
  {
    id: "welcome",
    title: "Welcome screen",
    description: "What speakers read first",
  },
  { id: "questions", title: "Questions", description: "Fields on the form" },
  {
    id: "settings",
    title: "Form settings",
    description: "Deadline and limits",
  },
]

function DesignSystemPage() {
  const [search, setSearch] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [stepId, setStepId] = useState("welcome")
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)
  const [surface, setSurface] = useState<SurfaceKey>("light")

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background">
        <header className="container-app sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card">
          <Link
            to="/"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo size="sm" />
          </Link>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <span className="text-sm text-muted-foreground">Design system</span>
          <div className="ml-auto">
            <Link to="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Organizer demo
            </Link>
          </div>
        </header>

        <div className="container-page flex gap-10 py-10">
          <nav
            aria-label="Sections"
            className="sticky top-24 hidden h-fit w-48 shrink-0 lg:block"
          >
            <p className="mb-2 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              Contents
            </p>
            <ul className="flex flex-col gap-0.5">
              {SECTIONS.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0 flex-1 space-y-14">
            <div>
              <h1 className="font-heading text-3xl font-semibold tracking-tight">
                Trackstage design system
              </h1>
              <p className="container-reading mt-2 text-sm text-muted-foreground">
                Every token, primitive, and app pattern in one place. Light mode
                only. The chrome is neutral — every grey is chroma ≤ 2, so
                nothing but the data carries colour — and Trackstage blue{" "}
                <code className="font-mono">#2F5CE0</code> is permitted in
                exactly five places: primary buttons, links, focus rings, the
                active nav item, and{" "}
                <code className="font-mono">--chart-1</code>. Controls are 40px
                (<code className="font-mono">--control-h</code>), compact
                controls 36px, table rows 44px; 8px radii on controls, 12px on
                cards. Components are shadcn on Base UI — always extend these
                rather than hand-rolling new ones.
              </p>
            </div>

            {/* ------------------------------------------- BRAND & ASSETS */}
            <Section
              id="brand"
              title="Brand & assets"
              description="The logomark is an abstract agenda: a time rail plus three session blocks, four rounded rectangles and nothing else. Geometry lives in src/components/brand/assets.ts, so this page, the app chrome, and every download below are generated from one source. Everything here is produced client-side — no asset files to keep in sync."
            >
              <Sample label="Logo variants — on every surface, with downloads">
                <Tabs
                  value={surface}
                  onValueChange={(value) => setSurface(value as SurfaceKey)}
                >
                  <TabsList>
                    <TabsTrigger value="light">Light</TabsTrigger>
                    <TabsTrigger value="dark">Dark</TabsTrigger>
                    <TabsTrigger value="primary">Primary</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {LOGO_VARIANTS.map((variant) => (
                    <div
                      key={variant.id}
                      className="overflow-hidden rounded-xl ring-1 ring-foreground/10"
                    >
                      <div
                        className={cn(
                          "flex min-h-32 items-center justify-center px-5 py-8",
                          SURFACES[surface].className
                        )}
                      >
                        {variant.preview(SURFACES[surface].tone)}
                      </div>
                      <div className="border-t border-border bg-card px-3 py-2.5">
                        <p className="mb-2 text-xs font-medium">
                          {variant.label}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() =>
                              downloadSvg(
                                brandSvg(
                                  variant.id,
                                  SURFACES[surface].tone,
                                  variant.svgSize
                                ),
                                `trackstage-${variant.id}-${SURFACES[surface].tone}.svg`
                              )
                            }
                          >
                            <RiDownloadLine aria-hidden />
                            SVG
                          </Button>
                          {[512, 1024].map((px) => (
                            <Button
                              key={px}
                              size="xs"
                              variant="outline"
                              onClick={() =>
                                void downloadBrandPng(
                                  variant.id,
                                  SURFACES[surface].tone,
                                  px,
                                  `trackstage-${variant.id}-${SURFACES[surface].tone}-${px}.png`
                                )
                              }
                            >
                              <RiDownloadLine aria-hidden />
                              PNG {px}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Inverse assets are the same geometry painted white — the mark
                  is drawn with <code className="font-mono">currentColor</code>,
                  so it is monochrome-safe on any surface.
                </p>
              </Sample>

              <Row>
                <Sample label="Social profile picture — 1:1">
                  <div className="flex items-center gap-5">
                    <span
                      className="flex size-24 items-center justify-center rounded-full"
                      style={{ background: BRAND_PRIMARY }}
                    >
                      <LogoMark
                        size={50}
                        variant="plain"
                        className="text-white"
                      />
                    </span>
                    <span
                      className="flex size-16 items-center justify-center rounded-xl"
                      style={{ background: BRAND_PRIMARY }}
                    >
                      <LogoMark
                        size={34}
                        variant="plain"
                        className="text-white"
                      />
                    </span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        downloadSvg(
                          socialAvatarSvg(1024),
                          "trackstage-social-1024.svg"
                        )
                      }
                    >
                      <RiDownloadLine aria-hidden />
                      SVG
                    </Button>
                    {[400, 1024].map((px) => (
                      <Button
                        key={px}
                        size="xs"
                        variant="outline"
                        onClick={() => void downloadSocialAvatarPng(px)}
                      >
                        <RiDownloadLine aria-hidden />
                        PNG {px}×{px}
                      </Button>
                    ))}
                  </div>
                </Sample>

                <Sample label="Favicon & app icon">
                  <div className="flex items-end gap-5">
                    {[16, 32, 48].map((px) => (
                      <span
                        key={px}
                        className="flex flex-col items-center gap-2"
                      >
                        <LogoMark size={px} variant="boxed" />
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {px}px
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() =>
                        downloadSvg(
                          markBoxedSvg(64, "color", 0.18),
                          "favicon.svg"
                        )
                      }
                    >
                      <RiDownloadLine aria-hidden />
                      favicon.svg
                    </Button>
                    {[32, 180, 512].map((px) => (
                      <Button
                        key={px}
                        size="xs"
                        variant="outline"
                        onClick={() => void downloadFaviconPng(px)}
                      >
                        <RiDownloadLine aria-hidden />
                        PNG {px}
                      </Button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Shipped as <code className="font-mono">/favicon.svg</code>{" "}
                    plus <code className="font-mono">/icon-192.png</code> and{" "}
                    <code className="font-mono">/icon-512.png</code> in the
                    manifest.
                  </p>
                </Sample>
              </Row>

              <Sample label="Open Graph / social banner — 1200×630">
                <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
                  <img
                    src="/og-image.png"
                    alt="Trackstage — open-source speaker and program management"
                    width={1200}
                    height={630}
                    className="block w-full"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() =>
                      downloadSvg(ogImageSvg(), "trackstage-og-1200x630.svg")
                    }
                  >
                    <RiDownloadLine aria-hidden />
                    SVG
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => void downloadOgImagePng()}
                  >
                    <RiDownloadLine aria-hidden />
                    PNG 1200×630
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Wired in the root head as{" "}
                  <code className="font-mono">og:image</code> and{" "}
                  <code className="font-mono">twitter:image</code>.
                </p>
              </Sample>

              <Row>
                <Sample label="Clearspace & minimum size">
                  <div className="flex flex-wrap items-end gap-8">
                    <span className="flex flex-col items-center gap-2">
                      <span className="rounded-lg border border-dashed border-primary/40 p-5">
                        <LogoMark size={40} variant="plain" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Clearspace = ½ the mark height on all sides
                      </span>
                    </span>
                    <span className="flex flex-col items-center gap-2">
                      <span className="flex h-[70px] items-center">
                        <LogoMark size={16} variant="boxed" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        16px minimum — below that, drop the wordmark
                      </span>
                    </span>
                  </div>
                </Sample>

                <Sample label="Do / don't">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <UsageTile ok label="Boxed mark on light surfaces">
                      <LogoMark size={36} variant="boxed" />
                    </UsageTile>
                    <UsageTile ok label="Plain mark inherits the text color">
                      <span className="flex items-center gap-2 rounded-md bg-primary px-3 py-2">
                        <LogoMark
                          size={24}
                          variant="plain"
                          className="text-white"
                        />
                        <Wordmark size="sm" className="text-white" />
                      </span>
                    </UsageTile>
                    <UsageTile label="Never recolor the mark off-brand">
                      <LogoMark
                        size={36}
                        variant="plain"
                        className="text-orange-500"
                      />
                    </UsageTile>
                    <UsageTile label="Never stretch or squash it">
                      <span className="inline-block scale-x-150">
                        <LogoMark size={36} variant="plain" />
                      </span>
                    </UsageTile>
                  </div>
                </Sample>
              </Row>
            </Section>

            {/* ---------------------------------------------------- COLOR */}
            <Section
              id="color"
              title="Color"
              description="All colors come from CSS custom properties in src/styles.css. Never hardcode a hex in a component. The policy, borrowed verbatim from Stripe: colour is reserved for status signals. Chrome is neutral — every grey below is chroma ≤ 2 — and the accent is permitted in exactly five places: primary buttons, links, focus rings, the active nav item, and --chart-1. If you are reaching for a colour anywhere else, the answer is a hairline or a muted label."
            >
              <SubTitle>Surfaces</SubTitle>
              <SwatchGrid swatches={SURFACE_COLORS} />
              <SubTitle>Brand & text</SubTitle>
              <SwatchGrid swatches={BRAND_COLORS} />
              <SubTitle>Status</SubTitle>
              <SwatchGrid swatches={STATUS_COLORS} />
              <SubTitle>Categorical tags</SubTitle>
              <SwatchGrid swatches={TAG_COLORS} />
            </Section>

            {/* ----------------------------------------------- TYPOGRAPHY */}
            <Section
              id="typography"
              title="Typography"
              description="Inter Variable, deliberately — the boring font. It is the most legible, least fashionable interface typeface there is, which is exactly what a tool for non-technical event producers needs. Character comes from tighter tracking on headings, not from a second family."
            >
              <Sample label="Specimen">
                <p className="font-heading text-5xl font-semibold tracking-tight">
                  Trackstage
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Inter Variable · headings at{" "}
                  <code className="font-mono">font-heading tracking-tight</code>
                </p>
                <Separator className="my-5" />
                <div className="space-y-3">
                  {[
                    { weight: "font-normal", note: "400 Regular — body copy" },
                    { weight: "font-medium", note: "500 Medium — labels, nav" },
                    {
                      weight: "font-semibold",
                      note: "600 Semibold — headings",
                    },
                    { weight: "font-bold", note: "700 Bold — rare emphasis" },
                  ].map((row) => (
                    <div
                      key={row.note}
                      className="flex flex-wrap items-baseline justify-between gap-3"
                    >
                      <span
                        className={cn("text-lg tracking-tight", row.weight)}
                      >
                        The quick brown fox jumps over 12 lazy speakers
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {row.note}
                      </span>
                    </div>
                  ))}
                </div>
              </Sample>

              <Row>
                <Sample label="Tabular figures — every number in a table">
                  <div className="space-y-1.5 tabular-nums">
                    {[
                      ["09:00 – 09:45", "Room A", "128"],
                      ["11:15 – 12:00", "Room B", "94"],
                      ["14:30 – 15:15", "Main Hall", "1,024"],
                    ].map((row) => (
                      <div
                        key={row[0]}
                        className="flex items-baseline justify-between gap-4 text-sm"
                      >
                        <span className="font-medium">{row[0]}</span>
                        <span className="text-muted-foreground">{row[1]}</span>
                        <span className="font-medium">{row[2]} seats</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Use <code className="font-mono">tabular-nums</code> anywhere
                    numbers stack: agenda times, counts, scores.
                  </p>
                </Sample>

                <Sample label="Type scale">
                  <div className="divide-y divide-border">
                    {TYPE_SCALE.map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-wrap items-baseline justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className={item.className}>{item.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {item.note}
                        </span>
                      </div>
                    ))}
                  </div>
                </Sample>
              </Row>
            </Section>

            {/* --------------------------------------------------- LAYOUT */}
            <Section
              id="layout"
              title="Layout & width"
              description="One width system for the whole product. Five tokens in src/styles.css, four container utilities, no page-level max-w-* anywhere else. A page-level wrapper picks exactly one container; anything inside it that needs a cap uses the token directly so it does not pick up a second gutter."
            >
              <Sample label="The tokens">
                <div className="divide-y divide-border">
                  {CONTAINERS.map((container) => (
                    <div
                      key={container.token}
                      className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3 first:pt-0 last:pb-0"
                    >
                      <code className="font-mono text-sm font-medium text-foreground">
                        .{container.utility}
                      </code>
                      <code className="font-mono text-xs text-muted-foreground">
                        {container.token}
                      </code>
                      <span className="ml-auto font-mono text-xs text-foreground tabular-nums">
                        {container.width}
                      </span>
                      <p className="w-full text-sm text-muted-foreground">
                        {container.use}
                      </p>
                    </div>
                  ))}
                </div>
              </Sample>

              <Sample label="Relative widths — the same viewport, four containers">
                <div className="space-y-2.5">
                  {[
                    { label: "container-app", pct: "100%" },
                    { label: "container-page", pct: "90%" },
                    { label: "container-narrow", pct: "52%" },
                    { label: "container-card", pct: "31%" },
                  ].map((bar) => (
                    <div key={bar.label} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 font-mono text-xs text-muted-foreground">
                        {bar.label}
                      </span>
                      <span className="h-7 flex-1 rounded-md bg-muted">
                        <span
                          className="block h-full rounded-md bg-primary/15 ring-1 ring-primary/25"
                          style={{ width: bar.pct }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Illustrative proportions at a wide viewport. Every container
                  centres itself and carries the page gutter —{" "}
                  <code className="font-mono">1rem</code>, stepping up to{" "}
                  <code className="font-mono">1.5rem</code> at{" "}
                  <code className="font-mono">sm</code>. The token values are
                  content widths: the gutter is added on top, so the readable
                  column is identical on every route.
                </p>
              </Sample>

              <Row>
                <Sample label="Do — one container per page wrapper">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
                    {`<main className="container-page py-8">
  <h1>…</h1>
  <p className="container-reading">…</p>
</main>`}
                  </pre>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Width, centring, and gutter come from one class. Prose caps
                    itself with the reading measure, in place.
                  </p>
                </Sample>

                <Sample label="Don't — bespoke widths per route">
                  <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed">
                    {`<main className="mx-auto w-full max-w-5xl px-4 sm:px-6">
<main className="mx-auto max-w-6xl px-4">
<main className="mx-auto max-w-7xl px-6">`}
                  </pre>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Three routes, three widths, three gutters — and because some
                    put the padding on the container and some on the parent, the
                    content column differed even where the max-width matched.
                  </p>
                </Sample>
              </Row>

              <Sample label="Exceptions — what the system does not govern">
                <p className="text-sm text-muted-foreground">
                  Component-internal widths stay with their component: dialog
                  and drawer sizes (
                  <code className="font-mono">sm:max-w-lg</code>), table-cell
                  truncation caps, toolbar search fields, and chart columns.
                  They size to their content, not to the page.
                </p>
              </Sample>
            </Section>

            {/* ---------------------------------------------------- SHAPE */}
            <Section
              id="shape"
              title="Shape & elevation"
              description="8px on controls, 12px on cards, full round on pills and avatars. One shadow level — cards use a hairline ring plus shadow-xs."
            >
              <Row>
                {[
                  { label: "rounded-md — 8px", cls: "rounded-md" },
                  { label: "rounded-lg — 10px", cls: "rounded-lg" },
                  { label: "rounded-xl — 12px", cls: "rounded-xl" },
                  { label: "rounded-full", cls: "rounded-full" },
                ].map((shape) => (
                  <Sample key={shape.cls} label={shape.label}>
                    <div
                      className={cn(
                        "size-16 bg-primary/15 ring-1 ring-primary/30",
                        shape.cls
                      )}
                    />
                  </Sample>
                ))}
              </Row>
            </Section>

            {/* -------------------------------------------------- BUTTONS */}
            <Section
              id="buttons"
              title="Buttons"
              description="Primary blue for the one action that matters on a screen; outline for secondary; ghost inside tables and toolbars."
            >
              <Sample label="Variants">
                <div className="flex flex-wrap items-center gap-2">
                  <Button>Default</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
              </Sample>
              <Sample label="Sizes">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="xs">Extra small</Button>
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" aria-label="Add">
                    <RiAddLine />
                  </Button>
                  <Button size="icon-sm" variant="outline" aria-label="Delete">
                    <RiDeleteBinLine />
                  </Button>
                </div>
              </Sample>
              <Sample label="With icons & states">
                <div className="flex flex-wrap items-center gap-2">
                  <Button>
                    <RiAddLine aria-hidden />
                    Add submission
                  </Button>
                  <Button variant="outline">
                    <RiFilter3Line aria-hidden />
                    Filter
                  </Button>
                  <Button disabled>Disabled</Button>
                  <Button variant="outline" disabled>
                    Disabled outline
                  </Button>
                </div>
              </Sample>
            </Section>

            {/* ---------------------------------------------------- FORMS */}
            <Section
              id="forms"
              title="Form controls"
              description="Labels sit above inputs, required fields get a red asterisk, helper text lives under the label. Structured values always use a real picker."
            >
              <Row>
                <Sample label="Text, select, textarea">
                  <FieldGroup className="max-w-sm gap-5">
                    <Field>
                      <FieldLabel htmlFor="ds-title">
                        Session title
                        <span className="required-asterisk">*</span>
                      </FieldLabel>
                      <FieldDescription>
                        Shown on the public agenda.
                      </FieldDescription>
                      <Input
                        id="ds-title"
                        placeholder="How we scaled the CFP"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ds-track">Track</FieldLabel>
                      <Select>
                        <SelectTrigger id="ds-track" className="w-full">
                          <SelectValue placeholder="Select a track…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ai">AI Engineering</SelectItem>
                          <SelectItem value="infra">Infrastructure</SelectItem>
                          <SelectItem value="product">Product</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ds-abstract">Abstract</FieldLabel>
                      <Textarea
                        id="ds-abstract"
                        rows={3}
                        placeholder="What will attendees learn?"
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="ds-invalid">
                        Invalid state
                      </FieldLabel>
                      <Input
                        id="ds-invalid"
                        aria-invalid
                        defaultValue="Not an email"
                      />
                    </Field>
                  </FieldGroup>
                </Sample>

                <Sample label="Toggles & choices">
                  <div className="flex flex-col gap-5">
                    <label className="flex items-center gap-2.5 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => setChecked(value === true)}
                      />
                      Send confirmation email
                    </label>
                    <label className="flex items-center gap-2.5 text-sm">
                      <Switch
                        checked={switched}
                        onCheckedChange={(value) => setSwitched(value)}
                      />
                      Form is open for submissions
                    </label>
                    <RadioGroup defaultValue="abstracts" className="gap-2">
                      <label className="flex items-center gap-2.5 text-sm">
                        <RadioGroupItem value="abstracts" />
                        Abstracts
                      </label>
                      <label className="flex items-center gap-2.5 text-sm">
                        <RadioGroupItem value="sessions" />
                        Sessions
                      </label>
                    </RadioGroup>
                  </div>
                </Sample>
              </Row>

              <Row>
                <Sample label="Date picker (never a raw text field)">
                  <Calendar mode="single" className="rounded-lg border" />
                </Sample>
                <Sample label="Search toolbar (DataToolbar)">
                  <DataToolbar
                    value={search}
                    onValueChange={setSearch}
                    placeholder="Search submissions…"
                    filters={
                      <Button variant="outline" size="sm">
                        <RiFilter3Line aria-hidden />
                        Filter
                      </Button>
                    }
                    actions={
                      <Button size="sm">
                        <RiAddLine aria-hidden />
                        Add submission
                      </Button>
                    }
                  />
                </Sample>
              </Row>
            </Section>

            {/* --------------------------------------------------- STATUS */}
            <Section
              id="status"
              title="Status pills"
              description="Identical wording organizer-side and speaker-side. Green = will speak, amber = undecided, red = declined, gray = draft/withdrawn — and Active/Scheduled are neutral, because blue means clickable now. The DEFAULT is variant=&quot;dot&quot;: a coloured dot plus a plain ink label, which is what tables and detail panes render. variant=&quot;pill&quot; is the filled version, kept for the places where emphasis is the message — queue banners and drawer headers — where queue states also carry a ring because they are staged, not committed."
            >
              <Sample label="Submission pipeline">
                <div className="flex flex-wrap items-center gap-2">
                  {SUBMISSION_STATUSES.map((status) => (
                    <StatusPill key={status} status={status} />
                  ))}
                </div>
              </Sample>
              <Sample label="Generic lifecycle">
                <div className="flex flex-wrap items-center gap-2">
                  {GENERIC_STATUSES.map((status) => (
                    <StatusPill key={status} status={status} />
                  ))}
                </div>
              </Sample>
              <Sample label="Small size / no dot">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status="accepted" size="sm" />
                  <StatusPill status="pending" size="sm" />
                  <StatusPill status="declined" dot={false} />
                  <StatusPill status="accept_queue" dot={false} />
                </div>
              </Sample>
              <Sample label="variant=&quot;pill&quot; — emphasis only">
                <div className="flex flex-wrap items-center gap-2">
                  {SUBMISSION_STATUSES.map((status) => (
                    <StatusPill key={status} status={status} variant="pill" />
                  ))}
                </div>
              </Sample>
            </Section>

            {/* ----------------------------------------------------- DATA */}
            <Section
              id="data"
              title="Data display"
              description="Tables are compact with a sticky header, hover highlight, status pill column, and a row action menu."
            >
              <Sample label="Table">
                <Card className="p-0 py-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox aria-label="Select all" />
                        </TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Track</TableHead>
                        <TableHead>Speakers</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        {
                          status: "accepted",
                          title: "Agents in production",
                          track: "AI Engineering",
                          speaker: "Ada Lovelace",
                        },
                        {
                          status: "pending",
                          title: "Cutting CFP busywork",
                          track: "Product",
                          speaker: "Grace Hopper",
                        },
                        {
                          status: "decline_queue",
                          title: "Yet another framework",
                          track: "Infrastructure",
                          speaker: "Alan Turing",
                        },
                      ].map((row) => (
                        <TableRow key={row.title}>
                          <TableCell>
                            <Checkbox aria-label={`Select ${row.title}`} />
                          </TableCell>
                          <TableCell>
                            <StatusPill status={row.status} size="sm" />
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.track}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {row.speaker}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </Sample>

              <Row>
                <Sample label="Badges">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                  </div>
                </Sample>
                <Sample label="Avatars">
                  <div className="flex items-center gap-2">
                    <Avatar>
                      <AvatarFallback>AL</AvatarFallback>
                    </Avatar>
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">GH</AvatarFallback>
                    </Avatar>
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">
                        AT
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </Sample>
                <Sample label="Progress">
                  <Progress value={64} className="w-56" />
                </Sample>
                <Sample label="Skeleton">
                  <div className="flex w-56 flex-col gap-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </Sample>
              </Row>

              <Row>
                <Sample label="Tabs">
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList>
                      <TabsTrigger value="all">All</TabsTrigger>
                      <TabsTrigger value="accepted">Accepted</TabsTrigger>
                      <TabsTrigger value="pending">Pending</TabsTrigger>
                    </TabsList>
                    <TabsContent
                      value="all"
                      className="pt-3 text-muted-foreground"
                    >
                      Every submission, whatever its status.
                    </TabsContent>
                    <TabsContent
                      value="accepted"
                      className="pt-3 text-muted-foreground"
                    >
                      Committed acceptances only.
                    </TabsContent>
                    <TabsContent
                      value="pending"
                      className="pt-3 text-muted-foreground"
                    >
                      Waiting on a decision.
                    </TabsContent>
                  </Tabs>
                </Sample>
                <Sample label="Breadcrumb">
                  <Breadcrumb>
                    <BreadcrumbList>
                      <BreadcrumbItem>
                        <BreadcrumbLink href="#data">Program</BreadcrumbLink>
                      </BreadcrumbItem>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <BreadcrumbPage>Submissions</BreadcrumbPage>
                      </BreadcrumbItem>
                    </BreadcrumbList>
                  </Breadcrumb>
                </Sample>
              </Row>

              <Sample label="Accordion">
                <Accordion className="w-full">
                  <AccordionItem value="a">
                    <AccordionTrigger>What is an abstract?</AccordionTrigger>
                    <AccordionContent>
                      An application to speak that arrived through a form.
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="b">
                    <AccordionTrigger>What is a session?</AccordionTrigger>
                    <AccordionContent>
                      A confirmed program item — added manually or promoted from
                      an accepted abstract.
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </Sample>
            </Section>

            {/* ------------------------------------------------- FEEDBACK */}
            <Section
              id="feedback"
              title="Feedback"
              description="Alerts explain what happened and what to do next. Toasts confirm background work without stealing focus."
            >
              <Row>
                <Sample label="Alert — default">
                  <Alert className="max-w-md">
                    <RiInformationLine aria-hidden />
                    <AlertTitle>3 speakers are missing a bio</AlertTitle>
                    <AlertDescription>
                      Send them a reminder from Communications.
                    </AlertDescription>
                  </Alert>
                </Sample>
                <Sample label="Alert — destructive">
                  <Alert variant="destructive" className="max-w-md">
                    <AlertTitle>Two sessions clash in Room A</AlertTitle>
                    <AlertDescription>
                      Open the Conflicts view to resolve them.
                    </AlertDescription>
                  </Alert>
                </Sample>
              </Row>
              <Row>
                <Sample label="Toast">
                  <Button
                    variant="outline"
                    onClick={() =>
                      toast.success("Decisions sent to 12 speakers")
                    }
                  >
                    Show toast
                  </Button>
                </Sample>
                <Sample label="Tooltip">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="outline"
                          size="icon-sm"
                          aria-label="More info"
                        />
                      }
                    >
                      <RiInformationLine aria-hidden />
                    </TooltipTrigger>
                    <TooltipContent>
                      Used on every non-obvious field.
                    </TooltipContent>
                  </Tooltip>
                </Sample>
              </Row>
            </Section>

            {/* ------------------------------------------------- OVERLAYS */}
            <Section
              id="overlays"
              title="Overlays"
              description="Create and detail flows use the right slide-over (~480px) so the table underneath never loses its state. Dialogs are reserved for short confirmations."
            >
              <Row>
                <Sample label="Drawer (DrawerShell)">
                  <Button variant="outline" onClick={() => setDrawerOpen(true)}>
                    Open drawer
                  </Button>
                  <DrawerShell
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    title="Add submission"
                    description="Manually add a session to the program."
                    footer={
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setDrawerOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={() => setDrawerOpen(false)}>
                          Save submission
                        </Button>
                      </>
                    }
                  >
                    <FieldGroup className="gap-5">
                      <Field>
                        <FieldLabel htmlFor="ds-drawer-title">
                          Title<span className="required-asterisk">*</span>
                        </FieldLabel>
                        <Input
                          id="ds-drawer-title"
                          placeholder="Opening keynote"
                        />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="ds-drawer-status">
                          Status
                        </FieldLabel>
                        <Select defaultValue="pending">
                          <SelectTrigger
                            id="ds-drawer-status"
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="accepted">Accepted</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    </FieldGroup>
                  </DrawerShell>
                </Sample>

                <Sample label="Dialog">
                  <Dialog>
                    <DialogTrigger render={<Button variant="outline" />}>
                      Open dialog
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Send decisions?</DialogTitle>
                        <DialogDescription>
                          12 speakers in the Accept Queue will be emailed and
                          their portal tasks created.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose render={<Button variant="outline" />}>
                          Cancel
                        </DialogClose>
                        <DialogClose render={<Button />}>
                          <RiCheckLine aria-hidden />
                          Send decisions
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Sample>

                <Sample label="Popover (inline status edit)">
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" />}>
                      Open popover
                    </PopoverTrigger>
                    <PopoverContent className="w-56">
                      <PopoverHeader>
                        <PopoverTitle>Status</PopoverTitle>
                        <PopoverDescription>
                          Pick a new status, then save.
                        </PopoverDescription>
                      </PopoverHeader>
                      <div className="mt-3 flex flex-col items-start gap-2">
                        {SUBMISSION_STATUSES.slice(1, 5).map((status) => (
                          <StatusPill key={status} status={status} size="sm" />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </Sample>

                <Sample label="Alert dialog">
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="destructive" />}
                    >
                      Delete form
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this form?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Submissions already collected stay, but the public
                          link stops working immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction>Delete form</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </Sample>
              </Row>
            </Section>

            {/* ------------------------------------------------- PATTERNS */}
            <Section
              id="patterns"
              title="App patterns"
              description="Composed primitives that every organizer screen reuses."
            >
              <Sample label="PageHeader — banner (organizer default)">
                <PageHeader
                  title="Submissions"
                  description="Everything submitted to this event, in one table."
                  actions={
                    <>
                      <Button variant="outline" size="sm">
                        Export CSV
                      </Button>
                      <Button size="sm">
                        <RiAddLine aria-hidden />
                        Add submission
                      </Button>
                    </>
                  }
                />
              </Sample>

              <Sample label="PageHeader — plain">
                <PageHeader
                  variant="plain"
                  title="Speaker profile"
                  description="What the speaker sees in their portal."
                />
              </Sample>

              <Sample label="EmptyState">
                <EmptyState
                  icon={RiFileList3Line}
                  title="No submissions yet"
                  description="Submissions are talks people apply with through your call for speakers form. Share your form link and they'll land here."
                  action={
                    <Button>
                      <RiAddLine aria-hidden />
                      Add submission
                    </Button>
                  }
                  secondaryAction={
                    <Button variant="outline">Copy public link</Button>
                  }
                />
              </Sample>

              <Sample label="WizardShell">
                <WizardShell
                  steps={WIZARD_STEPS}
                  currentStepId={stepId}
                  onStepSelect={setStepId}
                  railTitle="Form setup"
                  onBack={() => {
                    const index = WIZARD_STEPS.findIndex((s) => s.id === stepId)
                    if (index > 0) setStepId(WIZARD_STEPS[index - 1].id)
                  }}
                  onNext={() => {
                    const index = WIZARD_STEPS.findIndex((s) => s.id === stepId)
                    if (index < WIZARD_STEPS.length - 1)
                      setStepId(WIZARD_STEPS[index + 1].id)
                  }}
                  onSave={() => toast.success("Form saved")}
                  footerLeft="All changes saved"
                >
                  <div className="space-y-1">
                    <h2 className="font-heading text-base font-semibold">
                      {WIZARD_STEPS.find((s) => s.id === stepId)?.title}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Step content goes here. The rail shows checkmarks for
                      completed steps and a dark card for the active one.
                    </p>
                  </div>
                </WizardShell>
              </Sample>

              <Sample label="Sidebar navigation item states">
                <div className="w-60 rounded-xl border border-sidebar-border bg-sidebar p-3">
                  <p className="mb-1 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Program
                  </p>
                  <div className="flex flex-col gap-0.5">
                    <NavSample
                      icon={RiFileList3Line}
                      label="Submissions"
                      active
                    />
                    <NavSample icon={RiSurveyLine} label="Forms" />
                    <NavSample icon={RiCalendarScheduleLine} label="Agenda" />
                    <NavSample icon={RiUserVoiceLine} label="Speakers" />
                    <NavSample icon={RiSettings3Line} label="Settings" />
                  </div>
                </div>
              </Sample>
            </Section>

            {/* --------------------------------------------- INTERACTIONS */}
            <Section
              id="interactions"
              title="Interactions"
              description="The interior.dev micro-interaction library, adopted end to end and restyled onto our tokens — same motion, our design language. Every tile below is live; the caption says where it belongs in the product. Import from @/components/interactions; the full map lives in docs/memory/INTERACTIONS.md."
            >
              <InteractionsCatalog />
            </Section>

            {/* --------------------------------------------- EXPLORATIONS */}
            <Section
              id="explorations"
              title="Explorations — decided"
              description="Candidate E, “De-blued”, is SHIPPED (Marko, 2026-08-11): neutral chrome everywhere, Trackstage blue #2F5CE0 kept and confined to primary buttons, links, focus rings, the active nav item and --chart-1. The teal/petrol accent family was reviewed and rejected; type stays on Inter for now. The other candidates and their live panels have been removed — this section is the record of the decision, not a chooser."
            >
              <DesignExplorations />
            </Section>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

/* --------------------------------------------------------------- helpers */

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-heading text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description ? (
        <p className="container-reading mt-1 text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  )
}

function SubTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="pt-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>
}

function Sample({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <Card className="gap-0 p-0 py-0">
      <p className="border-b border-border px-5 py-2.5 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      <div className="p-5">{children}</div>
    </Card>
  )
}

function UsageTile({
  ok = false,
  label,
  children,
}: {
  ok?: boolean
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-foreground/10">
      <div className="flex h-24 items-center justify-center bg-white px-3">
        {children}
      </div>
      <p className="flex items-start gap-1.5 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        {ok ? (
          <RiCheckboxCircleFill
            size={14}
            aria-hidden
            className="mt-px shrink-0 text-status-green-dot"
          />
        ) : (
          <RiCloseCircleFill
            size={14}
            aria-hidden
            className="mt-px shrink-0 text-status-red-dot"
          />
        )}
        {label}
      </p>
    </div>
  )
}

function SwatchGrid({ swatches }: { swatches: Array<Swatch> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {swatches.map((swatch) => (
        <Card key={swatch.token} className="flex-row items-center gap-3 p-3">
          <span
            className="size-11 shrink-0 rounded-lg ring-1 ring-foreground/10"
            style={{ background: swatch.hex }}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {swatch.name}
            </span>
            <span className="block truncate font-mono text-xs text-muted-foreground">
              {swatch.token} · {swatch.hex}
            </span>
          </span>
        </Card>
      ))}
    </div>
  )
}

function NavSample({
  icon: Icon,
  label,
  active = false,
}: {
  icon: RemixiconComponentType
  label: string
  active?: boolean
}) {
  return (
    <span
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "text-foreground/80"
      )}
    >
      <Icon size={17} aria-hidden />
      {label}
    </span>
  )
}
