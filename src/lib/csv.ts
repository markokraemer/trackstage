/**
 * CSV reading for the speaker import (sbek SPK-03).
 *
 * Hand-rolled on purpose — a spreadsheet export is a 200-line problem, not a
 * dependency: quoted fields containing commas and newlines, doubled quotes,
 * CRLF, a UTF-8 BOM from Excel. That is the whole grammar, and shipping a
 * parser we can read beats another package in the bundle every organizer
 * downloads.
 *
 * The other half of the job is being FORGIVING ABOUT HEADERS. Real files come
 * out of Sessionize, Airtable, Google Sheets and someone's hand-typed list, so
 * columns arrive in any order under any of a dozen names, and a full name may
 * live in one column or two. Anything we can't recognise is ignored rather
 * than fatal: an organizer should never have to rewrite their spreadsheet to
 * get their speakers in.
 */

/** Split raw CSV text into rows of cells. Handles quotes, CRLF and the BOM. */
export function parseCsv(text: string): Array<Array<string>> {
  const input = text.replace(/^\uFEFF/, "")
  const rows: Array<Array<string>> = []
  let row: Array<string> = []
  let cell = ""
  let quoted = false

  for (let i = 0; i < input.length; i++) {
    const char = input[i]

    if (quoted) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          cell += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ",") {
      row.push(cell)
      cell = ""
    } else if (char === "\n" || char === "\r") {
      // Swallow the \n of a \r\n pair.
      if (char === "\r" && input[i + 1] === "\n") i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
    } else {
      cell += char
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }

  // Drop rows that are entirely empty (trailing newline, blank separators).
  return rows.filter((cells) => cells.some((value) => value.trim().length > 0))
}

/** One speaker as the import understands them. */
export interface SpeakerImportRow {
  firstName: string
  lastName: string
  email: string
  jobTitle: string
  company: string
  bio: string
}

type Column = keyof SpeakerImportRow | "fullName"

/**
 * Header synonyms, checked against the header cell with everything but
 * letters and digits stripped ("First Name" → "firstname", "e-mail" → "email").
 */
const HEADER_ALIASES: Record<Column, Array<string>> = {
  firstName: ["firstname", "first", "givenname", "forename", "fname"],
  lastName: ["lastname", "last", "surname", "familyname", "lname"],
  fullName: ["name", "fullname", "speaker", "speakername", "displayname", "participant"],
  email: ["email", "emailaddress", "mail", "contactemail", "speakeremail"],
  jobTitle: ["title", "jobtitle", "job", "position", "role", "headline", "jobrole"],
  company: [
    "company",
    "organisation",
    "organization",
    "org",
    "employer",
    "affiliation",
    "companyname",
  ],
  bio: ["bio", "biography", "about", "biotext", "speakerbio", "description"],
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/** Which column of the file feeds which field. -1 when the file lacks it. */
function mapColumns(header: Array<string>): Record<Column, number> {
  const mapping = {
    firstName: -1,
    lastName: -1,
    fullName: -1,
    email: -1,
    jobTitle: -1,
    company: -1,
    bio: -1,
  } as Record<Column, number>

  header.forEach((raw, index) => {
    const key = normalizeHeader(raw)
    if (!key) return
    for (const column of Object.keys(HEADER_ALIASES) as Array<Column>) {
      if (mapping[column] !== -1) continue
      if (HEADER_ALIASES[column].includes(key)) {
        mapping[column] = index
        return
      }
    }
  })
  return mapping
}

/** "Dana Kowalski" → { firstName: "Dana", lastName: "Kowalski" }. */
export function splitName(value: string): { firstName: string; lastName: string } {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: "", lastName: "" }
  if (parts.length === 1) return { firstName: parts[0], lastName: "" }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  }
}

export interface SpeakerCsvResult {
  /** Header cells as they appeared, for the "we read these columns" hint. */
  header: Array<string>
  /** Which of our fields the file actually provides. */
  recognized: Array<keyof SpeakerImportRow>
  rows: Array<SpeakerImportRow>
  /** Set when the file can't be used at all. */
  error: string | null
}

/**
 * Read a speaker CSV. Requires a header row with something email-shaped in it
 * — without that we'd be guessing which column is which, and silently
 * importing 300 people wrong is far worse than one clear error.
 */
export function parseSpeakerCsv(text: string): SpeakerCsvResult {
  const empty: SpeakerCsvResult = {
    header: [],
    recognized: [],
    rows: [],
    error: null,
  }
  const table = parseCsv(text)
  if (table.length === 0) {
    return { ...empty, error: "That file is empty." }
  }

  const header = table[0].map((cell) => cell.trim())
  const columns = mapColumns(header)
  if (columns.email === -1) {
    return {
      ...empty,
      header,
      error:
        "We couldn't find an email column. Add a header row with an “email” column (plus name, title, company and bio if you have them).",
    }
  }
  if (columns.firstName === -1 && columns.fullName === -1) {
    return {
      ...empty,
      header,
      error:
        "We couldn't find a name column. Add a “name” column, or “first name” and “last name”.",
    }
  }

  const cellAt = (cells: Array<string>, index: number) =>
    index === -1 ? "" : (cells[index] ?? "").trim()

  const rows = table.slice(1).map((cells) => {
    let firstName = cellAt(cells, columns.firstName)
    let lastName = cellAt(cells, columns.lastName)
    if (!firstName && columns.fullName !== -1) {
      const split = splitName(cellAt(cells, columns.fullName))
      firstName = split.firstName
      if (!lastName) lastName = split.lastName
    }
    return {
      firstName,
      lastName,
      email: cellAt(cells, columns.email).toLowerCase(),
      jobTitle: cellAt(cells, columns.jobTitle),
      company: cellAt(cells, columns.company),
      bio: cellAt(cells, columns.bio),
    }
  })

  const recognized = (
    ["firstName", "lastName", "email", "jobTitle", "company", "bio"] as const
  ).filter(
    (field) =>
      columns[field] !== -1 ||
      (columns.fullName !== -1 && (field === "firstName" || field === "lastName")),
  )

  return { header, recognized, rows, error: null }
}

// ——— Validation ————————————————————————————————————————————————————————————

export const CSV_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ImportRowStatus = "new" | "existing" | "duplicate" | "invalid"

export interface CheckedImportRow extends SpeakerImportRow {
  /** 1-based line number in the file, header excluded — what the user sees. */
  line: number
  status: ImportRowStatus
  /** Why this row is flagged, in a sentence an organizer can act on. */
  note: string | null
}

/**
 * Decide what will happen to each row BEFORE anything is written: new person,
 * merge into someone already on the roster, a repeat inside the same file, or
 * unusable. The server re-checks all of it — this exists so the organizer sees
 * the outcome first.
 */
export function checkImportRows(
  rows: Array<SpeakerImportRow>,
  existingEmails: Iterable<string>,
): Array<CheckedImportRow> {
  const roster = new Set(
    Array.from(existingEmails, (email) => email.trim().toLowerCase()),
  )
  const seen = new Set<string>()

  return rows.map((row, index) => {
    const line = index + 1
    const email = row.email.trim().toLowerCase()
    const base = { ...row, email, line }

    if (!email) {
      return { ...base, status: "invalid" as const, note: "No email address" }
    }
    if (!CSV_EMAIL_PATTERN.test(email)) {
      return {
        ...base,
        status: "invalid" as const,
        note: "That email address isn't valid",
      }
    }
    if (!row.firstName.trim()) {
      return { ...base, status: "invalid" as const, note: "No name" }
    }
    if (seen.has(email)) {
      return {
        ...base,
        status: "duplicate" as const,
        note: "Appears earlier in this file",
      }
    }
    seen.add(email)
    if (roster.has(email)) {
      return {
        ...base,
        status: "existing" as const,
        note: "Already on your roster — we'll only fill in blanks",
      }
    }
    return { ...base, status: "new" as const, note: null }
  })
}
