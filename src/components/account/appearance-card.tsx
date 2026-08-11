import { RiComputerLine, RiMoonLine, RiSunLine } from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useTheme } from "@/components/theme/theme-provider"
import { isThemePreference } from "@/lib/theme"
import type { ThemePreference } from "@/lib/theme"
import { cn } from "@/lib/utils"

/**
 * Appearance — account level, like the rest of this page: the choice follows
 * your login into every workspace and event, on this device and any other
 * (it rides a cookie, not a database column, so it survives a reload but is
 * genuinely per-browser — which is what people expect from a theme).
 *
 * The control is a three-up segmented picker with a real MINIATURE of each
 * theme rather than a bare icon. A conference organizer is not scanning for a
 * moon glyph; showing them a small picture of the app in each skin is the
 * fastest way to answer "what am I choosing?". "System" shows both halves,
 * which is exactly what it does.
 */
export function AppearanceCard() {
  const { preference, systemResolved, setPreference } = useTheme()

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiMoonLine size={18} aria-hidden className="text-primary" />
          Appearance
        </CardTitle>
        <CardDescription>
          How Trackstage looks while you work. This applies to your organizer
          screens — the public pages your speakers and attendees see always stay
          light.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <RadioGroup
          aria-label="Theme"
          value={preference}
          onValueChange={(next) => {
            if (isThemePreference(next)) setPreference(next)
          }}
          className="grid gap-3 sm:grid-cols-3"
        >
          {THEME_OPTIONS.map((option) => (
            <ThemeOption
              key={option.value}
              option={option}
              selected={preference === option.value}
              hint={
                option.value === "system"
                  ? `Currently ${systemResolved}`
                  : option.hint
              }
            />
          ))}
        </RadioGroup>
      </CardContent>
    </Card>
  )
}

interface ThemeOptionSpec {
  value: ThemePreference
  label: string
  hint: string
  icon: RemixiconComponentType
}

const THEME_OPTIONS: readonly ThemeOptionSpec[] = [
  {
    value: "light",
    label: "Light",
    hint: "The default",
    icon: RiSunLine,
  },
  {
    value: "dark",
    label: "Dark",
    hint: "Easier at night",
    icon: RiMoonLine,
  },
  {
    value: "system",
    label: "System",
    hint: "Follows your device",
    icon: RiComputerLine,
  },
]

function ThemeOption({
  option,
  selected,
  hint,
}: {
  option: ThemeOptionSpec
  selected: boolean
  hint: string
}) {
  const Icon = option.icon
  return (
    /*
      A <label> wrapper, not an onClick div: Base UI's Radio renders a real
      (visually hidden) `input[type=radio]` inside its button, so the whole
      tile becomes the radio's hit area for free — mouse, touch, and a browser
      agent clicking the visible text all land on the same control.
    */
    <label
      className={cn(
        "group/theme-option flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-3 text-left transition-colors",
        "has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
        selected
          ? "border-primary bg-primary-surface/60"
          : "border-border hover:border-input hover:bg-muted/60",
      )}
    >
      <ThemeMiniature preference={option.value} />
      <span className="flex items-center gap-2">
        <RadioGroupItem value={option.value} />
        <span className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Icon size={15} aria-hidden className="text-muted-foreground" />
            {option.label}
          </span>
          <span className="truncate text-xs text-muted-foreground">{hint}</span>
        </span>
      </span>
    </label>
  )
}

/**
 * The miniatures paint in LITERAL hexes on purpose — each tile has to show its
 * own theme no matter which theme the page is currently wearing, so it cannot
 * speak in tokens. Values mirror `:root` / `.dark` in src/styles.css; if the
 * palette moves, move these with it.
 */
const MINIATURE = {
  light: {
    page: "#fafafa",
    card: "#ffffff",
    line: "#eaeaec",
    ink: "#d4d4d8",
    accent: "#2f5ce0",
  },
  dark: {
    page: "#0b0d12",
    card: "#12141a",
    line: "#23262e",
    ink: "#2c303a",
    accent: "#3d6be5",
  },
} as const

function ThemeMiniature({ preference }: { preference: ThemePreference }) {
  if (preference === "system") {
    return (
      <span className="relative block h-20 overflow-hidden rounded-lg border border-border">
        <MiniatureFrame scheme="light" />
        {/* The dark half is laid over the light one and clipped down the
            middle — "System" is literally both, and looks it. */}
        <span className="absolute inset-y-0 right-0 block w-1/2 overflow-hidden">
          <span className="absolute inset-y-0 right-0 block w-[200%]">
            <MiniatureFrame scheme="dark" />
          </span>
        </span>
      </span>
    )
  }

  return (
    <span className="block h-20 overflow-hidden rounded-lg border border-border">
      <MiniatureFrame scheme={preference} />
    </span>
  )
}

/** A 20px-tall app: sidebar rail, top bar, a couple of rows, one blue action. */
function MiniatureFrame({ scheme }: { scheme: "light" | "dark" }) {
  const palette = MINIATURE[scheme]
  return (
    <span
      aria-hidden
      className="flex h-20 w-full"
      style={{ backgroundColor: palette.page }}
    >
      <span
        className="flex h-full w-1/4 shrink-0 flex-col gap-1 p-1.5"
        style={{ borderRight: `1px solid ${palette.line}` }}
      >
        <span
          className="block h-1.5 w-full rounded-full"
          style={{ backgroundColor: palette.accent }}
        />
        <span
          className="block h-1 w-4/5 rounded-full"
          style={{ backgroundColor: palette.ink }}
        />
        <span
          className="block h-1 w-3/5 rounded-full"
          style={{ backgroundColor: palette.ink }}
        />
      </span>

      <span className="flex h-full min-w-0 flex-1 flex-col gap-1.5 p-1.5">
        <span className="flex items-center gap-1">
          <span
            className="block h-1.5 w-1/3 rounded-full"
            style={{ backgroundColor: palette.ink }}
          />
          <span
            className="ml-auto block h-2 w-1/4 rounded-[3px]"
            style={{ backgroundColor: palette.accent }}
          />
        </span>
        <span
          className="flex min-h-0 flex-1 flex-col gap-1 rounded-[4px] p-1"
          style={{
            backgroundColor: palette.card,
            border: `1px solid ${palette.line}`,
          }}
        >
          <span
            className="block h-1 w-full rounded-full"
            style={{ backgroundColor: palette.ink }}
          />
          <span
            className="block h-1 w-5/6 rounded-full"
            style={{ backgroundColor: palette.line }}
          />
          <span
            className="block h-1 w-2/3 rounded-full"
            style={{ backgroundColor: palette.line }}
          />
        </span>
      </span>
    </span>
  )
}
