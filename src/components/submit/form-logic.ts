import type {
  AnswerValue,
  Answers,
  ParticipantConfig,
  ParticipantDraft,
  ParticipantFieldConfig,
  SubmitQuestion,
} from "@/components/submit/types"

/**
 * Pure logic for the public submission flow — conditional visibility,
 * validation, and display formatting. Kept free of React so the same rules can
 * be unit-tested and so they read exactly like `convex/submit.ts`, which is the
 * server-side authority (docs/SPEC.md §4.3).
 */

export const STEPS = [
  { id: "welcome", label: "Welcome!" },
  { id: "account", label: "Account" },
  { id: "submission", label: "Submission" },
  { id: "participants", label: "Participants" },
  { id: "review", label: "Review" },
] as const

export type StepId = (typeof STEPS)[number]["id"]

export const STEP_INDEX: Record<StepId, number> = {
  welcome: 0,
  account: 1,
  submission: 2,
  participants: 3,
  review: 4,
}

/** The system question that carries the submission title. */
export const TITLE_QUESTION_ID = "title"

/** Question types we render as a note rather than an input. */
export const FILE_PLACEHOLDER = "Will be uploaded in the speaker portal"

/** Conditional logic: mirrors `visibleQuestions` in `convex/submit.ts`. */
export function isQuestionVisible(
  question: SubmitQuestion,
  answers: Answers,
): boolean {
  if (!question.showIf) return true
  return answers[question.showIf.questionId] === question.showIf.equals
}

export function visibleQuestions(
  questions: Array<SubmitQuestion>,
  answers: Answers,
): Array<SubmitQuestion> {
  return questions.filter((question) => isQuestionVisible(question, answers))
}

export function isAnswerEmpty(value: AnswerValue): boolean {
  if (value === undefined) return true
  if (typeof value === "string") return value.trim() === ""
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "boolean") return value === false
  return false
}

/** Ids of visible, required questions with no answer. */
export function missingQuestionIds(
  questions: Array<SubmitQuestion>,
  answers: Answers,
): Array<string> {
  return visibleQuestions(questions, answers)
    .filter((question) => question.required && isAnswerEmpty(answers[question.id]))
    .map((question) => question.id)
}

/**
 * Answers stripped of anything a hidden question left behind, plus the
 * placeholder we store for required file questions (uploads happen in the
 * portal after acceptance — see `QuestionField`).
 */
export function answersForSubmit(
  questions: Array<SubmitQuestion>,
  answers: Answers,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const question of visibleQuestions(questions, answers)) {
    const value = answers[question.id]
    if (question.type === "file") {
      result[question.id] = question.required
        ? FILE_PLACEHOLDER
        : (value ?? "")
      continue
    }
    if (value === undefined) continue
    result[question.id] = value
  }
  return result
}

export function titleFromAnswers(answers: Answers): string {
  const value = answers[TITLE_QUESTION_ID]
  return typeof value === "string" ? value.trim() : ""
}

/**
 * The submission title. Normally the locked `title` question, but a form built
 * from scratch might not have one — fall back to the first short answer so a
 * submission is never rejected for a field the speaker was never shown.
 */
export function resolveTitle(
  questions: Array<SubmitQuestion>,
  answers: Answers,
): string {
  const direct = titleFromAnswers(answers)
  if (direct) return direct
  for (const question of visibleQuestions(questions, answers)) {
    if (question.type !== "short_text") continue
    const value = answers[question.id]
    if (typeof value === "string" && value.trim() !== "") return value.trim()
  }
  return ""
}

export const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim())
}

/** Participant fields we can actually collect on this step. */
export const UNSUPPORTED_PARTICIPANT_FIELDS = new Set(["headshot"])

export function collectableParticipantFields(
  config: ParticipantConfig,
): Array<ParticipantFieldConfig> {
  return config.fields.filter(
    (field) => !UNSUPPORTED_PARTICIPANT_FIELDS.has(field.id),
  )
}

export function participantFieldValue(
  participant: ParticipantDraft,
  fieldId: string,
): string {
  const value = (participant as unknown as Record<string, unknown>)[fieldId]
  return typeof value === "string" ? value : ""
}

/** `"2-firstName"` — the key used to flag one invalid participant field. */
export function participantFieldKey(index: number, fieldId: string): string {
  return `${index}-${fieldId}`
}

export interface ParticipantIssues {
  /** `${index}-${fieldId}` keys to outline in red. */
  fieldKeys: Array<string>
  /** Plain-English problems that aren't tied to a single field. */
  messages: Array<string>
}

/** Mirrors `validateSubmission` in `convex/submit.ts`, minus the server bits. */
export function validateParticipants(
  config: ParticipantConfig,
  participants: Array<ParticipantDraft>,
): ParticipantIssues {
  const fieldKeys: Array<string> = []
  const messages: Array<string> = []

  const required = collectableParticipantFields(config).filter(
    (field) => field.required,
  )

  participants.forEach((participant, index) => {
    for (const field of required) {
      const value = participantFieldValue(participant, field.id)
      if (value.trim() === "") fieldKeys.push(participantFieldKey(index, field.id))
    }
    const email = participant.email.trim()
    if (email !== "" && !isValidEmail(email)) {
      fieldKeys.push(participantFieldKey(index, "email"))
      messages.push(
        `${participant.firstName.trim() || `Participant ${index + 1}`} needs a valid email address.`,
      )
    }
  })

  const speakers = participants.filter((p) => p.role === "speaker")
  if (speakers.length < config.speakerMin) {
    messages.push(
      `This form needs at least ${config.speakerMin} speaker${
        config.speakerMin === 1 ? "" : "s"
      }.`,
    )
  }
  if (speakers.length > config.speakerMax) {
    messages.push(
      `This form allows at most ${config.speakerMax} speaker${
        config.speakerMax === 1 ? "" : "s"
      }.`,
    )
  }

  return { fieldKeys: [...new Set(fieldKeys)], messages }
}

export function participantName(
  participant: ParticipantDraft,
  index: number,
): string {
  const name = `${participant.firstName} ${participant.lastName}`.trim()
  return name || participant.email.trim() || `Participant ${index + 1}`
}

// ——— Display helpers ———————————————————————————————————————————————————

function safeFormat(
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone })
  } catch {
    return new Intl.DateTimeFormat("en-US", options)
  }
}

/** "September 15, 2026 at 11:59 PM PDT" — deadlines always show their zone. */
export function formatDeadline(
  timestamp: number,
  timeZone?: string,
): string {
  const date = safeFormat(timeZone, {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(timestamp)
  const time = safeFormat(timeZone, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(timestamp)
  return `${date} at ${time}`
}

/** "October 12 – 14, 2026", or a single date when there's no end. */
export function formatEventDates(
  startsAt?: number,
  endsAt?: number,
  timeZone?: string,
): string | null {
  if (startsAt === undefined) return null
  const formatter = safeFormat(timeZone, {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  if (endsAt === undefined || endsAt === startsAt) {
    return formatter.format(startsAt)
  }
  try {
    return formatter.formatRange(startsAt, endsAt)
  } catch {
    return `${formatter.format(startsAt)} – ${formatter.format(endsAt)}`
  }
}

/** Human-readable answer for the Review step and summary cards. */
export function displayAnswer(
  question: SubmitQuestion,
  value: AnswerValue,
): string {
  if (question.type === "checkbox") return value === true ? "Yes" : "No"
  if (Array.isArray(value)) return value.length ? value.join(", ") : ""
  if (typeof value === "string") return value.trim()
  return ""
}
