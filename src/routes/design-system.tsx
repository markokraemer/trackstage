import { useState } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  RiAddLine,
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
import { Logo, LogoMark } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
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
  { id: "brand", label: "Brand" },
  { id: "color", label: "Color" },
  { id: "typography", label: "Typography" },
  { id: "shape", label: "Shape & elevation" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Form controls" },
  { id: "status", label: "Status pills" },
  { id: "data", label: "Data display" },
  { id: "feedback", label: "Feedback" },
  { id: "overlays", label: "Overlays" },
  { id: "patterns", label: "App patterns" },
] as const

interface Swatch {
  name: string
  token: string
  hex: string
  fg?: string
}

const SURFACE_COLORS: Array<Swatch> = [
  { name: "Page background", token: "--background", hex: "#F8FAFC" },
  { name: "Card", token: "--card", hex: "#FFFFFF" },
  { name: "Sidebar", token: "--sidebar", hex: "#F1F5F9" },
  { name: "Muted", token: "--muted", hex: "#F1F5F9" },
  { name: "Accent (tint)", token: "--accent", hex: "#EEF1FC" },
  { name: "Border", token: "--border", hex: "#E5E7EB" },
]

const BRAND_COLORS: Array<Swatch> = [
  { name: "Primary", token: "--primary", hex: "#2F5CE0", fg: "#FFFFFF" },
  { name: "Text (navy)", token: "--foreground", hex: "#1B1E27", fg: "#FFFFFF" },
  { name: "Muted text", token: "--muted-foreground", hex: "#64748B", fg: "#FFFFFF" },
  { name: "Accent text", token: "--accent-foreground", hex: "#1E3FA8", fg: "#FFFFFF" },
  { name: "Destructive", token: "--destructive", hex: "#DC2626", fg: "#FFFFFF" },
]

const STATUS_COLORS: Array<Swatch> = [
  { name: "Green fill", token: "--status-green-bg", hex: "#D1FAE5" },
  { name: "Green text", token: "--status-green-fg", hex: "#065F46", fg: "#FFFFFF" },
  { name: "Amber fill", token: "--status-amber-bg", hex: "#FEF3C7" },
  { name: "Amber text", token: "--status-amber-fg", hex: "#92400E", fg: "#FFFFFF" },
  { name: "Red fill", token: "--status-red-bg", hex: "#FEE2E2" },
  { name: "Red text", token: "--status-red-fg", hex: "#991B1B", fg: "#FFFFFF" },
  { name: "Gray fill", token: "--status-gray-bg", hex: "#F1F5F9" },
  { name: "Blue fill", token: "--status-blue-bg", hex: "#E4EBFC" },
]

const TYPE_SCALE = [
  { label: "Page title", className: "font-heading text-xl font-semibold", note: "20px / 600" },
  { label: "Section title", className: "font-heading text-base font-semibold", note: "16px / 600" },
  { label: "Body", className: "text-sm", note: "14px / 400" },
  { label: "Label", className: "text-sm font-medium", note: "14px / 500" },
  { label: "Helper text", className: "text-sm text-muted-foreground", note: "14px / muted" },
  { label: "Meta / pill", className: "text-xs text-muted-foreground", note: "12px / muted" },
  {
    label: "Group label",
    className: "text-[11px] font-semibold tracking-wider uppercase text-muted-foreground",
    note: "11px / 600 / uppercase",
  },
]

const WIZARD_STEPS = [
  { id: "setup", title: "Setup", description: "Abstracts or sessions" },
  { id: "welcome", title: "Welcome screen", description: "What speakers read first" },
  { id: "questions", title: "Questions", description: "Fields on the form" },
  { id: "settings", title: "Form settings", description: "Deadline and limits" },
]

function DesignSystemPage() {
  const [search, setSearch] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [stepId, setStepId] = useState("welcome")
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-border bg-card px-6">
          <Link
            to="/"
            className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Logo size="sm" />
          </Link>
          <Separator orientation="vertical" className="mx-1 h-5" />
          <span className="text-sm text-muted-foreground">Design system</span>
          <div className="ml-auto">
            <Button variant="outline" size="sm" render={<Link to="/login" />}>
              Organizer demo
            </Button>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-7xl gap-10 px-6 py-10">
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
                Sessionboard design system
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Every token, primitive, and app pattern in one place. Light mode
                only, primary blue <code className="font-mono">#2F5CE0</code>,
                8px controls and 12px cards. Components are shadcn on Base UI —
                always extend these rather than hand-rolling new ones.
              </p>
            </div>

            {/* ---------------------------------------------------- BRAND */}
            <Section
              id="brand"
              title="Brand"
              description="The logomark is an abstract agenda: a time rail plus three session blocks. It paints in currentColor and stays legible at 16px."
            >
              <Row>
                <Sample label="Logo — boxed (default)">
                  <Logo size="md" />
                </Sample>
                <Sample label="Logo — plain">
                  <Logo size="md" variant="plain" />
                </Sample>
                <Sample label="Logo — large">
                  <Logo size="lg" />
                </Sample>
                <Sample label="Mark only">
                  <Logo size="md" markOnly />
                </Sample>
              </Row>
              <Row>
                <Sample label="Mark sizes">
                  <div className="flex items-end gap-4">
                    <LogoMark size={16} />
                    <LogoMark size={24} />
                    <LogoMark size={32} />
                    <LogoMark size={48} />
                  </div>
                </Sample>
                <Sample label="Mark on blue">
                  <div className="flex items-center gap-4 rounded-lg bg-primary px-5 py-4">
                    <LogoMark size={32} variant="plain" className="text-primary-foreground" />
                    <span className="font-heading font-semibold text-primary-foreground">
                      Sessionboard
                    </span>
                  </div>
                </Sample>
              </Row>
            </Section>

            {/* ---------------------------------------------------- COLOR */}
            <Section
              id="color"
              title="Color"
              description="All colors come from CSS custom properties in src/styles.css. Never hardcode a hex in a component."
            >
              <SubTitle>Surfaces</SubTitle>
              <SwatchGrid swatches={SURFACE_COLORS} />
              <SubTitle>Brand & text</SubTitle>
              <SwatchGrid swatches={BRAND_COLORS} />
              <SubTitle>Status</SubTitle>
              <SwatchGrid swatches={STATUS_COLORS} />
            </Section>

            {/* ----------------------------------------------- TYPOGRAPHY */}
            <Section
              id="typography"
              title="Typography"
              description="Inter Variable throughout. Medium weight for labels, semibold for headings."
            >
              <Card className="gap-0 divide-y divide-border p-0 py-0">
                {TYPE_SCALE.map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-wrap items-baseline justify-between gap-3 px-5 py-4"
                  >
                    <span className={item.className}>{item.label}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {item.note}
                    </span>
                  </div>
                ))}
              </Card>
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
                        shape.cls,
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
                      <Input id="ds-title" placeholder="How we scaled the CFP" />
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
                      <FieldLabel htmlFor="ds-invalid">Invalid state</FieldLabel>
                      <Input id="ds-invalid" aria-invalid defaultValue="Not an email" />
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
              description="Identical wording organizer-side and speaker-side. Green = will speak, amber = undecided, red = declined, gray = draft/withdrawn. Queue states carry a ring because they are staged, not committed."
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
                        { status: "accepted", title: "Agents in production", track: "AI Engineering", speaker: "Ada Lovelace" },
                        { status: "pending", title: "Cutting CFP busywork", track: "Product", speaker: "Grace Hopper" },
                        { status: "decline_queue", title: "Yet another framework", track: "Infrastructure", speaker: "Alan Turing" },
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
                      <AvatarFallback className="text-[10px]">AT</AvatarFallback>
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
                    <TabsContent value="all" className="pt-3 text-muted-foreground">
                      Every submission, whatever its status.
                    </TabsContent>
                    <TabsContent value="accepted" className="pt-3 text-muted-foreground">
                      Committed acceptances only.
                    </TabsContent>
                    <TabsContent value="pending" className="pt-3 text-muted-foreground">
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
                    onClick={() => toast.success("Decisions sent to 12 speakers")}
                  >
                    Show toast
                  </Button>
                </Sample>
                <Sample label="Tooltip">
                  <Tooltip>
                    <TooltipTrigger
                      render={<Button variant="outline" size="icon-sm" aria-label="More info" />}
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
                        <Input id="ds-drawer-title" placeholder="Opening keynote" />
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="ds-drawer-status">Status</FieldLabel>
                        <Select defaultValue="pending">
                          <SelectTrigger id="ds-drawer-status" className="w-full">
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
                    <AlertDialogTrigger render={<Button variant="destructive" />}>
                      Delete form
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this form?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Submissions already collected stay, but the public link
                          stops working immediately.
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
                    <NavSample icon={RiFileList3Line} label="Submissions" active />
                    <NavSample icon={RiSurveyLine} label="Forms" />
                    <NavSample icon={RiCalendarScheduleLine} label="Agenda" />
                    <NavSample icon={RiUserVoiceLine} label="Speakers" />
                    <NavSample icon={RiSettings3Line} label="Settings" />
                  </div>
                </div>
              </Sample>
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
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
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
          : "text-foreground/80",
      )}
    >
      <Icon size={17} aria-hidden />
      {label}
    </span>
  )
}
