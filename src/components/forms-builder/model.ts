import {
  RiArticleLine,
  RiAttachment2,
  RiCheckboxLine,
  RiCheckboxMultipleLine,
  RiLinkM,
  RiListCheck,
  RiMailLine,
  RiParagraph,
  RiPhoneLine,
  RiPresentationLine,
  RiFileTextLine,
  RiText,
} from "@remixicon/react"
import type { RemixiconComponentType } from "@remixicon/react"
import type { Doc } from "@convex/_generated/dataModel"

/**
 * Form-builder domain model (docs/SPEC.md §4.2, docs/ux/02-form-builder.md).
 *
 * The Convex document is the source of truth — every type here is derived from
 * `Doc<"forms">` so the builder can never drift from `convex/schema.ts`.
 */

export type FormDoc = Doc<"forms">
export type FormQuestion = FormDoc["questions"][number]
export type ParticipantConfig = FormDoc["participantConfig"]
export type ParticipantField = ParticipantConfig["fields"][number]
export type FormSettings = FormDoc["settings"]
export type QuestionCondition = NonNullable<FormQuestion["showIf"]>

/* ------------------------------------------------------------------ kinds */

export type FormKind = "abstract" | "session"

export interface FormKindMeta {
  value: FormKind
  /** Plural noun used on cards and badges. */
  label: string
  /** One plain-English line for the chooser card. */
  description: string
  icon: RemixiconComponentType
}

export const FORM_KINDS: Array<FormKindMeta> = [
  {
    value: "abstract",
    label: "Abstracts",
    description:
      "Collect talk proposals you'll review and decide on before the programme is final.",
    icon: RiFileTextLine,
  },
  {
    value: "session",
    label: "Sessions",
    description:
      "Collect confirmed sessions — sponsor talks, keynotes — that go straight onto the agenda.",
    icon: RiPresentationLine,
  },
]

export function formKindMeta(kind: string): FormKindMeta {
  return FORM_KINDS.find((entry) => entry.value === kind) ?? FORM_KINDS[0]
}

/* -------------------------------------------------------- question types */

export type QuestionType =
  | "short_text"
  | "long_text"
  | "rich_text"
  | "dropdown"
  | "multi_select"
  | "email"
  | "url"
  | "phone"
  | "checkbox"
  | "file"

export interface QuestionTypeMeta {
  value: QuestionType
  /** What an organizer calls it. Never jargon. */
  label: string
  /** One line explaining when to pick it. */
  description: string
  icon: RemixiconComponentType
  /** Needs an answer-options editor. */
  hasOptions: boolean
  /** Supports a character limit. */
  hasMaxChars: boolean
  /** Supports placeholder ("grey example text"). */
  hasPlaceholder: boolean
  /** Other questions can branch on this answer (single, known values). */
  canDriveConditions: boolean
  defaultMaxChars?: number
}

export const QUESTION_TYPES: Array<QuestionTypeMeta> = [
  {
    value: "short_text",
    label: "Short text",
    description: "One line — a title, a job title, a URL slug.",
    icon: RiText,
    hasOptions: false,
    hasMaxChars: true,
    hasPlaceholder: true,
    canDriveConditions: false,
    defaultMaxChars: 200,
  },
  {
    value: "long_text",
    label: "Long text",
    description: "A few paragraphs of plain text.",
    icon: RiParagraph,
    hasOptions: false,
    hasMaxChars: true,
    hasPlaceholder: true,
    canDriveConditions: false,
    defaultMaxChars: 2000,
  },
  {
    value: "rich_text",
    label: "Formatted text",
    description: "Long text where submitters can use bold, italics and links.",
    icon: RiArticleLine,
    hasOptions: false,
    hasMaxChars: true,
    hasPlaceholder: false,
    canDriveConditions: false,
    defaultMaxChars: 5000,
  },
  {
    value: "dropdown",
    label: "Dropdown",
    description: "Pick one answer from a list you write.",
    icon: RiListCheck,
    hasOptions: true,
    hasMaxChars: false,
    hasPlaceholder: false,
    canDriveConditions: true,
  },
  {
    value: "multi_select",
    label: "Multi-select",
    description: "Pick as many answers as apply from your list.",
    icon: RiCheckboxMultipleLine,
    hasOptions: true,
    hasMaxChars: false,
    hasPlaceholder: false,
    canDriveConditions: false,
  },
  {
    value: "email",
    label: "Email address",
    description: "Checked for a valid email address.",
    icon: RiMailLine,
    hasOptions: false,
    hasMaxChars: false,
    hasPlaceholder: true,
    canDriveConditions: false,
  },
  {
    value: "url",
    label: "Website link",
    description: "A link — slides, a demo, a personal site.",
    icon: RiLinkM,
    hasOptions: false,
    hasMaxChars: false,
    hasPlaceholder: true,
    canDriveConditions: false,
  },
  {
    value: "phone",
    label: "Phone number",
    description: "A contact number, international format allowed.",
    icon: RiPhoneLine,
    hasOptions: false,
    hasMaxChars: false,
    hasPlaceholder: true,
    canDriveConditions: false,
  },
  {
    value: "checkbox",
    label: "Yes / no checkbox",
    description: "A single tick box — agreements, opt-ins.",
    icon: RiCheckboxLine,
    hasOptions: false,
    hasMaxChars: false,
    hasPlaceholder: false,
    canDriveConditions: true,
  },
  {
    value: "file",
    label: "File upload",
    description: "Ask for a slide deck, a headshot or a PDF.",
    icon: RiAttachment2,
    hasOptions: false,
    hasMaxChars: false,
    hasPlaceholder: false,
    canDriveConditions: false,
  },
]

export function questionTypeMeta(type: string): QuestionTypeMeta {
  return (
    QUESTION_TYPES.find((entry) => entry.value === type) ?? QUESTION_TYPES[0]
  )
}

/** "Dropdown · 5 answer options" / "Short text · Max 200 characters". */
export function questionSublabel(question: FormQuestion): string {
  const meta = questionTypeMeta(question.type)
  const parts: Array<string> = [meta.label]
  if (meta.hasOptions) {
    const count = question.options?.length ?? 0
    parts.push(
      count === 0
        ? "No answer options yet"
        : `${count} answer option${count === 1 ? "" : "s"}`,
    )
  }
  if (meta.hasMaxChars && question.maxChars) {
    parts.push(`Max ${question.maxChars.toLocaleString()} characters`)
  }
  return parts.join(" · ")
}

/** Values a condition can test against (checkbox answers are Yes / No). */
export function conditionValues(question: FormQuestion): Array<string> {
  if (question.type === "checkbox") return ["Yes", "No"]
  return question.options ?? []
}

/** Questions that can appear on the left of a "Show only when…" rule. */
export function conditionSources(
  questions: Array<FormQuestion>,
  targetId: string,
): Array<FormQuestion> {
  const index = questions.findIndex((question) => question.id === targetId)
  return questions
    .slice(0, index === -1 ? questions.length : index)
    .filter(
      (question) =>
        question.enabled &&
        questionTypeMeta(question.type).canDriveConditions &&
        conditionValues(question).length > 0,
    )
}

/** Plain-English summary of a condition, for the row hint. */
export function conditionSummary(
  questions: Array<FormQuestion>,
  condition: QuestionCondition,
): string {
  const source = questions.find(
    (question) => question.id === condition.questionId,
  )
  return `Shows only when “${source?.label ?? "a deleted question"}” is “${condition.equals}”`
}

/* -------------------------------------------------------------- id helper */

/** Stable, readable question id derived from the label (`why-attend-2`). */
export function makeQuestionId(
  label: string,
  taken: Array<string>,
): string {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "question"
  if (!taken.includes(base)) return base
  for (let index = 2; ; index++) {
    const candidate = `${base}-${index}`
    if (!taken.includes(candidate)) return candidate
  }
}

/** A brand-new question of the given type, ready to append. */
export function makeQuestion(
  type: QuestionType,
  taken: Array<string>,
): FormQuestion {
  const meta = questionTypeMeta(type)
  const label = `New ${meta.label.toLowerCase()} question`
  return {
    id: makeQuestionId(label, taken),
    label,
    type,
    required: false,
    enabled: true,
    locked: false,
    ...(meta.hasOptions ? { options: ["Option 1", "Option 2"] } : {}),
    ...(meta.defaultMaxChars ? { maxChars: meta.defaultMaxChars } : {}),
  }
}

/* ------------------------------------------------------------ misc helpers */

/** Convex throws `Error: [CONVEX ...] Uncaught Error: message` — show the message. */
export function friendlyError(error: unknown, fallback: string): string {
  const raw = error instanceof Error ? error.message : String(error ?? "")
  const match = raw.match(/Uncaught Error:\s*([^\n]+)/)
  const message = (match?.[1] ?? raw).replace(/\s+at handler.*$/s, "").trim()
  return message.length > 0 && message.length < 240 ? message : fallback
}

/** Public submission URL for a form slug. */
export function publicFormPath(slug: string): string {
  return `/submit/${slug}`
}

export function publicFormUrl(slug: string): string {
  if (typeof window === "undefined") return publicFormPath(slug)
  return `${window.location.origin}${publicFormPath(slug)}`
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
