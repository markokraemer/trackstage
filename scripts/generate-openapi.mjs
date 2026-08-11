/**
 * Generates public/docs/api/openapi.json — the spec the /docs/api reference
 * renders — straight from the API's own route manifest, so the published
 * documentation cannot drift from what the server serves.
 *
 *   node scripts/generate-openapi.mjs              # rewrite the spec
 *   node scripts/generate-openapi.mjs --check      # fail if it is out of date (CI)
 *   node scripts/generate-openapi.mjs --live       # additionally probe every
 *                                                  # documented route against the
 *                                                  # dev deployment
 *   node scripts/generate-openapi.mjs --check --live
 *
 * Three sources of truth, checked against each other:
 *
 *   1. `API_ROUTES` in convex/apiRoutes.ts — the manifest. Parsed out of the
 *      source rather than imported, because importing anything under convex/
 *      drags in the generated API surface that plain node cannot load. The
 *      literal is pure data on purpose, so the parse is exact.
 *   2. convex/apiHttp.ts — the dispatcher. `--check` greps it for the guard of
 *      every manifest route, so deleting a route from the dispatcher without
 *      deleting it from the manifest fails the check.
 *   3. The running deployment — `--live` sends a real request per route and
 *      fails on any route that answers "unknown endpoint" or 405. This is the
 *      only check that can prove the three agree.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MANIFEST = resolve(root, "convex/apiRoutes.ts")
const DISPATCHER = resolve(root, "convex/apiHttp.ts")
const OUT = resolve(root, "public/docs/api/openapi.json")

// ——— Manifest parsing ————————————————————————————————————————————————————

/** Extracts a top-level `export const NAME = <literal>` as real JS data. */
function extractLiteral(source, name) {
  const marker = new RegExp(`export const ${name}(?::[^=]+)? = `)
  const match = marker.exec(source)
  if (!match) throw new Error(`${name} not found in convex/apiRoutes.ts`)
  const start = match.index + match[0].length
  const open = source[start]
  const close = open === "[" ? "]" : "}"
  let depth = 0
  let inString = null
  let escaped = false
  for (let i = start; i < source.length; i++) {
    const char = source[i]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === inString) inString = null
      continue
    }
    if (char === '"' || char === "'" || char === "`") inString = char
    else if (char === open) depth++
    else if (char === close) {
      depth--
      if (depth === 0) {
        const literal = source.slice(start, i + 1).replace(/\s+as const$/, "")
        // Pure data by construction — see the header of convex/apiRoutes.ts.
        return new Function(`return ${literal}`)()
      }
    }
  }
  throw new Error(`Unbalanced literal for ${name}`)
}

/**
 * The nine settings resources and the seven writable ones share one handler,
 * so the manifest keeps them as lists and they are expanded into real routes
 * here — exactly the expansion the dispatcher performs at runtime.
 */
function expandSettingsRoutes(readResources, writeResources, labels) {
  const routes = []
  for (const resource of readResources) {
    const label = labels[resource] ?? resource
    const plural = resource === "session-statuses" ? "session statuses" : resource
    const camel = resource
      .split("-")
      .map((part, index) => (index === 0 ? part : part[0].toUpperCase() + part.slice(1)))
      .join("")
    const isFields = resource === "fields"
    const isStatuses = resource === "statuses" || resource === "session-statuses"
    const pageSchema = isFields
      ? "FieldsPage"
      : isStatuses
        ? "StatusesPage"
        : "MetadataPage"
    const readDescription = isFields
      ? "Every field definition on the event — the CFP form's questions plus its participant fields. These are the `internal_name`s you write through `PUT /sessions/{id}/fields`."
      : isStatuses
        ? "Every status a session can be in: the seven built-ins every event ships with, plus any custom labels this event added. `id` is the pipeline value for a built-in and the row id for a custom status; `pipeline_status` is always the value `?status=` filters on. Pass `include_deleted=true` to see archived ones."
        : `Every ${label} configured on the event.`
    routes.push({
      method: "GET",
      path: `/v1/event/{eventRef}/${resource}`,
      operationId: `list${camel[0].toUpperCase()}${camel.slice(1)}`,
      tag: "Event Settings",
      summary: `List ${plural}`,
      description: readDescription,
      scope: "read:events",
      bucket: "entity_reads",
      requestBody: null,
      responses: [[200, pageSchema]],
      errors: [429],
      query: isStatuses
        ? ["page", "pageSize", "search", "include_deleted"]
        : ["page", "pageSize", "search"],
      open: false,
      bodyKind: "none",
    })
    routes.push({
      method: "POST",
      path: `/v1/event/{eventRef}/${resource}`,
      operationId: `search${camel[0].toUpperCase()}${camel.slice(1)}`,
      tag: "Event Settings",
      summary: `Search ${plural}`,
      description: `Same data as the list form, with the search body Sessionboard clients send.`,
      scope: "read:events",
      bucket: "entity_reads",
      requestBody: "MetadataSearchBody",
      responses: [[200, pageSchema]],
      errors: [400, 429],
      query: ["page", "pageSize"],
      open: false,
      bodyKind: "json",
    })
  }

  // Custom-field definitions are writable: they are the CFP form's questions.
  routes.push(
    {
      method: "POST",
      path: "/v1/event/{eventRef}/fields/create",
      operationId: "createField",
      tag: "Field Writes",
      summary: "Create a custom field",
      description:
        "Appends a question to the event's CFP form. Custom fields and form questions are the same thing here, so a field created through the API shows up in the form builder and on the public submission form.",
      scope: "write:fields",
      bucket: "field_writes",
      requestBody: "FieldWriteBody",
      responses: [[201, "FieldEnvelope"]],
      errors: [400, 429],
      query: [],
      open: false,
      bodyKind: "json",
    },
    {
      method: "PUT",
      path: "/v1/event/{eventRef}/fields/{fieldId}",
      operationId: "updateField",
      tag: "Field Writes",
      summary: "Update a custom field",
      description:
        "Renames a field or changes its type, options, help text or required flag. System fields (Title, Description) refuse the edit with a 400.",
      scope: "write:fields",
      bucket: "field_writes",
      requestBody: "FieldWriteBody",
      responses: [[200, "FieldEnvelope"]],
      errors: [400, 429],
      query: [],
      open: false,
      bodyKind: "json",
    },
    {
      method: "DELETE",
      path: "/v1/event/{eventRef}/fields/{fieldId}",
      operationId: "deleteField",
      tag: "Field Writes",
      summary: "Delete a custom field",
      description:
        "Removes the question from every form on the event. Answers already collected are preserved on their sessions and keep coming back in `custom_fields`.",
      scope: "write:fields",
      bucket: "field_writes",
      requestBody: null,
      responses: [[204, null]],
      errors: [400, 429],
      query: [],
      open: false,
      bodyKind: "none",
    },
  )

  for (const resource of writeResources) {
    const label = labels[resource] ?? resource
    const camel = resource[0].toUpperCase() + resource.slice(1, -1)
    const isStatuses = resource === "statuses"
    const envelopeName = isStatuses ? "StatusEnvelope" : "MetadataEnvelope"
    const note = isStatuses
      ? " A custom status is a LABEL bound to one of the five pipeline categories (`category`), so “Waitlist” can be the word an organizer sees while the accept/decline machinery, the decision emails and the speaker portal all keep running on `pending`. The seven built-ins can be renamed, recoloured and reordered but never deleted or re-categorised."
      : ["formats", "levels", "languages", "tags"].includes(resource)
        ? ` ${label[0].toUpperCase()}${label.slice(1)}s have no table of their own: they are the options on the CFP form's \`${resource === "formats" ? "format" : resource === "levels" ? "level" : resource === "languages" ? "language" : "tags"}\` question, so this edits that question and the form builder shows the change immediately.`
        : ""
    routes.push(
      {
        method: "POST",
        path: `/v1/event/{eventRef}/${resource}/create`,
        operationId: `create${camel}`,
        tag: "Metadata Writes",
        summary: `Create a ${label}`,
        description: `Adds a ${label} to the event.${note}`,
        scope: "write:metadata",
        bucket: "metadata_writes",
        requestBody: "MetadataWriteBody",
        responses: [[201, envelopeName]],
        errors: [400, 429],
        query: [],
        open: false,
        bodyKind: "json",
      },
      {
        method: "PUT",
        path: `/v1/event/{eventRef}/${resource}/{id}`,
        operationId: `update${camel}`,
        tag: "Metadata Writes",
        summary: `Update a ${label}`,
        description: `Renames or reorders a ${label}.${note}`,
        scope: "write:metadata",
        bucket: "metadata_writes",
        requestBody: "MetadataWriteBody",
        responses: [[200, envelopeName]],
        errors: [400, 429],
        query: [],
        open: false,
        bodyKind: "json",
      },
      {
        method: "DELETE",
        path: `/v1/event/{eventRef}/${resource}/{id}`,
        operationId: `delete${camel}`,
        tag: "Metadata Writes",
        summary: `Delete a ${label}`,
        description:
          resource === "rooms"
            ? "Deletes the room and unschedules anything standing in it, so the agenda never points at a room that no longer exists."
            : resource === "tracks"
              ? "Deletes the track and clears it from every session that referenced it."
              : isStatuses
                ? "Archives a custom status — soft, so `POST /statuses/{id}/restore` brings it back. Submissions still carrying the label must be sent somewhere with `reassign_to`, or the call answers 400 with how many. Built-in statuses refuse deletion."
                : `Removes the ${label}.${note}`,
        scope: "write:metadata",
        bucket: "metadata_writes",
        requestBody: isStatuses ? "MetadataWriteBody" : null,
        responses: [[204, null]],
        errors: [400, 429],
        query: [],
        open: false,
        bodyKind: isStatuses ? "json" : "none",
      },
    )
  }
  return routes
}

export async function loadRoutes() {
  const source = await readFile(MANIFEST, "utf8")
  const base = extractLiteral(source, "API_ROUTES")
  const readResources = extractLiteral(source, "SETTINGS_READ_RESOURCES")
  const writeResources = extractLiteral(source, "METADATA_WRITE_RESOURCES")
  const labels = extractLiteral(source, "RESOURCE_LABELS")
  const routes = [...base, ...expandSettingsRoutes(readResources, writeResources, labels)]
  routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method))
  return { routes, settingsResources: [...readResources, ...writeResources] }
}

// ——— Schemas ——————————————————————————————————————————————————————————————

const ts = (description) => ({
  type: "string",
  format: "date-time",
  nullable: true,
  description,
})

const SCHEMAS = {
  Error: {
    type: "object",
    description:
      "Every failure uses this shape. `error` and `message` are the same human sentence — `error` is where this API has always put it, `message` is where Sessionboard clients look. `code` is the machine-readable name.",
    required: ["error", "code", "message", "status"],
    properties: {
      error: { type: "string", examples: ["Session not found."] },
      code: { type: "string", examples: ["NotFoundError"] },
      message: { type: "string", examples: ["Session not found."] },
      status: { type: "integer", examples: [404] },
    },
  },
  Pagination: {
    type: "object",
    description:
      "Carries both spellings: camelCase (what this API has always returned) and snake_case (what Sessionboard's CRUD proxy returns). They always hold the same values.",
    properties: {
      currentPage: { type: "integer", examples: [1] },
      pageSize: { type: "integer", examples: [25] },
      totalPages: { type: "integer", examples: [4] },
      totalResults: { type: "integer", examples: [97] },
      current_page: { type: "integer", examples: [1] },
      page_size: { type: "integer", examples: [25] },
      total_pages: { type: "integer", examples: [4] },
      total_results: { type: "integer", examples: [97] },
    },
  },
  CustomFieldValue: {
    type: "object",
    description:
      "One answer to one CFP question. `value` is the flattened string Sessionboard clients expect; `value_raw` is the untouched JSON, so multi-selects and structured answers are never lossy.",
    properties: {
      id: { type: "string", examples: ["parity_notes"] },
      internal_name: { type: "string", examples: ["parity_notes"] },
      name: { type: "string", examples: ["Parity Notes"] },
      type: { type: "string", examples: ["long_text"] },
      value: { type: "string" },
      value_raw: { description: "Any JSON value." },
      created_at: ts("When the answer's submission was created."),
    },
  },
  ParticipantRole: {
    type: "object",
    nullable: true,
    properties: {
      slug: { type: "string", examples: ["speaker"] },
      name: { type: "string", examples: ["Speaker"] },
      name_plural: { type: "string", examples: ["Speakers"] },
      core_role: {
        type: "string",
        enum: ["speaker", "chairperson", "moderator"],
      },
    },
  },
  Speaker: {
    type: "object",
    description:
      "A person on the event. Carries the snake_case contact profile plus the camelCase aliases this API returned before the parity work.",
    properties: {
      id: { type: "string" },
      friendly_id: { type: "string", examples: ["SPK-20431"] },
      friendly_id_raw: { type: "integer", examples: [20431] },
      full_name: { type: "string" },
      first_name: { type: "string" },
      last_name: { type: "string" },
      email: { type: "string", format: "email" },
      title: { type: "string", nullable: true },
      company_name: { type: "string", nullable: true },
      about: { type: "string", nullable: true },
      phone_mobile: { type: "string", nullable: true },
      pronouns: { type: "string", nullable: true },
      salutation: { type: "string", nullable: true },
      photo_url: { type: "string", format: "uri", nullable: true },
      website_url: { type: "string", nullable: true },
      linkedin_url: { type: "string", nullable: true },
      twitter_url: { type: "string", nullable: true },
      workflow_status: {
        type: "string",
        nullable: true,
        enum: ["invited", "confirmed", "dropped", null],
      },
      created_at: ts("Creation time."),
      updated_at: ts("Last write."),
      participant_role: { $ref: "#/components/schemas/ParticipantRole" },
      name: { type: "string", description: "Legacy alias of `full_name`." },
      firstName: { type: "string", description: "Legacy alias of `first_name`." },
      lastName: { type: "string", description: "Legacy alias of `last_name`." },
      jobTitle: { type: "string", nullable: true, description: "Legacy alias of `title`." },
      company: { type: "string", nullable: true, description: "Legacy alias of `company_name`." },
      bio: { type: "string", nullable: true, description: "Legacy alias of `about`." },
      headshotUrl: { type: "string", nullable: true, description: "Legacy alias of `photo_url`." },
    },
  },
  NamedMetadata: {
    type: "object",
    nullable: true,
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      color: { type: "string", examples: ["#0F6E70"] },
      order: { type: "integer" },
      capacity: { type: "integer", nullable: true },
      event_id: { type: "string" },
      created_at: ts("Creation time."),
      updated_at: ts("Last write."),
    },
  },
  SessionStatus: {
    type: "object",
    description:
      "A status an organizer can put a session in. The seven built-ins ship with every event and cannot be deleted or re-categorised; custom ones are labels bound to a pipeline value, so the accept/decline machinery and the wording the speaker sees never disagree.",
    properties: {
      id: {
        type: "string",
        description:
          "The pipeline value for a built-in (`accepted`, `pending`, …), the row id for a custom status. This is what has always been returned here.",
        examples: ["accepted"],
      },
      status_id: {
        type: "string",
        nullable: true,
        description:
          "Always the row id. `null` on an event that has never edited its statuses and is still running on the built-in defaults.",
      },
      name: { type: "string", examples: ["Accepted"] },
      value: {
        type: "string",
        description: "The value `submissions.status` holds — what `?status=` filters on.",
      },
      pipeline_status: {
        type: "string",
        enum: [
          "draft",
          "pending",
          "accept_queue",
          "decline_queue",
          "accepted",
          "declined",
          "withdrawn",
        ],
      },
      category: {
        type: "string",
        enum: ["draft", "pending", "accepted", "declined", "withdrawn"],
      },
      color: { type: "string", enum: ["green", "amber", "red", "gray", "blue"] },
      order: { type: "integer" },
      system: { type: "boolean", description: "A built-in the pipeline needs." },
      system_key: { type: "string", nullable: true },
      created_by: { type: "string", nullable: true, description: "`null` reads as “System”." },
      created_at: ts("Creation time; null for built-ins."),
      updated_at: ts("Last write."),
      deleted_at: ts("Set when archived — restore it with POST /statuses/{id}/restore."),
    },
  },
  SessionFile: {
    type: "object",
    properties: {
      id: { type: "string" },
      url: { type: "string", format: "uri", nullable: true },
      title: { type: "string" },
      filename: { type: "string" },
      size: { type: "integer", nullable: true },
      mimetype: { type: "string", nullable: true },
      version: { type: "integer" },
      approval_status: {
        type: "string",
        enum: ["pending", "approved", "changes_requested"],
      },
      review_note: { type: "string", nullable: true },
      session_id: { type: "string", nullable: true },
      assigned_participant_id: { type: "string", nullable: true },
      assigned_participant_email: { type: "string", nullable: true },
      assigned_participant_name: { type: "string", nullable: true },
      created_at: ts("Upload time."),
      updated_at: ts("Last write."),
    },
  },
  Session: {
    type: "object",
    description:
      "A session or abstract. The union of Sessionboard's `Session` shape and every field this API returned before parity, so it is a strict superset of both.",
    properties: {
      id: { type: "string" },
      friendly_id: { type: "string", examples: ["SESS-73041"] },
      friendly_id_raw: { type: "integer", examples: [73041] },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      status: {
        type: "string",
        enum: [
          "draft",
          "pending",
          "accept_queue",
          "decline_queue",
          "accepted",
          "declined",
          "withdrawn",
        ],
      },
      is_abstract: {
        type: "boolean",
        description: "True for CFP submissions, false for programme sessions.",
      },
      kind: { type: "string", enum: ["abstract", "session"] },
      is_public: { type: "boolean" },
      starts_at: ts("Scheduled start."),
      ends_at: ts("Scheduled end, derived from duration."),
      duration_minutes: { type: "integer", nullable: true },
      capacity: { type: "integer", nullable: true, description: "Assigned room's capacity." },
      created_at: ts("Submission time."),
      updated_at: ts("Concurrency token — send this back on PUT."),
      deleted_at: ts("Set when soft-deleted."),
      decided_at: ts("When the accept/decline decision was committed."),
      notified_at: ts("When the decision email went out."),
      custom_fields: {
        type: "array",
        items: { $ref: "#/components/schemas/CustomFieldValue" },
      },
      answers: {
        type: "object",
        additionalProperties: true,
        description: "The raw answer map keyed by field `internal_name`.",
      },
      speakers: { type: "array", items: { $ref: "#/components/schemas/Speaker" } },
      chairpersons: { type: "array", items: { $ref: "#/components/schemas/Speaker" } },
      moderators: { type: "array", items: { $ref: "#/components/schemas/Speaker" } },
      participants: {
        type: "array",
        description: "Every participant in one flat list, each with `participant_role`.",
        items: { $ref: "#/components/schemas/Speaker" },
      },
      submitter: { $ref: "#/components/schemas/Speaker" },
      tags: { type: "array", items: { $ref: "#/components/schemas/NamedMetadata" } },
      track: { $ref: "#/components/schemas/NamedMetadata" },
      room: { $ref: "#/components/schemas/NamedMetadata" },
      format: { $ref: "#/components/schemas/NamedMetadata" },
      level: { $ref: "#/components/schemas/NamedMetadata" },
      language: { $ref: "#/components/schemas/NamedMetadata" },
      subsessions: {
        type: "array",
        items: {},
        description:
          "Always empty — this product has no parent/child sessions. Present so clients written against Sessionboard can iterate it without a guard.",
      },
      files: {
        type: "array",
        items: { $ref: "#/components/schemas/SessionFile" },
        description: "Only present when `expand=files` is requested.",
      },
      startTime: { type: "integer", nullable: true, description: "Legacy: start in epoch ms." },
      endTime: { type: "integer", nullable: true, description: "Legacy: end in epoch ms." },
      durationMinutes: { type: "integer", nullable: true, description: "Legacy alias." },
      location: { type: "string", nullable: true, description: "Legacy: room name." },
      trackColor: { type: "string", nullable: true, description: "Legacy: track colour." },
      submittedAt: { type: "integer", description: "Legacy: creation time in epoch ms." },
      decidedAt: { type: "integer", nullable: true, description: "Legacy alias in epoch ms." },
    },
  },
  SessionStatusRow: {
    type: "object",
    properties: {
      id: { type: "string" },
      friendly_id: { type: "string" },
      friendly_id_raw: { type: "integer" },
      status: { type: "string" },
      is_abstract: { type: "boolean" },
      deleted_at: ts("Set when soft-deleted."),
      created_at: ts("Creation time."),
      updated_at: ts("Last write."),
      subsessions: { type: "array", items: {} },
    },
  },
  Event: {
    type: "object",
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      slug: { type: "string" },
      type: { type: "string", nullable: true },
      description: { type: "string", nullable: true },
      venue: { type: "string", nullable: true },
      website_url: { type: "string", nullable: true },
      timezone: { type: "string", examples: ["America/Los_Angeles"] },
      starts_at: ts("Event start."),
      ends_at: ts("Event end."),
      logo_url: { type: "string", nullable: true },
      background_url: { type: "string", nullable: true },
      agenda_published_at: ts("Set once the public programme is live."),
      created_at: ts("Creation time."),
      organization_id: {
        type: "string",
        nullable: true,
        description: "The workspace this event belongs to.",
      },
      public_url: { type: "string", examples: ["/e/ai-engineer/ai-summit-2026"] },
      portal_settings: {
        type: "object",
        description: "How the speaker portal behaves for this event.",
        properties: {
          always_show_tasks: { type: "boolean" },
          allow_submission_edits: { type: "boolean" },
          extend_task_deadlines: { type: "boolean" },
        },
      },
      features: {
        type: "object",
        properties: {
          translated_fields: { type: "boolean" },
          custom_fields: { type: "boolean" },
          webhooks: { type: "boolean" },
        },
      },
      _id: { type: "string", description: "Legacy alias of `id`." },
      startsAt: { type: "integer", nullable: true, description: "Legacy: epoch ms." },
      endsAt: { type: "integer", nullable: true, description: "Legacy: epoch ms." },
      websiteUrl: { type: "string", nullable: true, description: "Legacy alias." },
    },
  },
  Field: {
    type: "object",
    description:
      "A field definition. These come from the CFP form's questions — custom fields and form questions are one and the same in this product.",
    properties: {
      id: { type: "string", examples: ["format"] },
      internal_name: { type: "string", examples: ["format"] },
      public_name: { type: "string", examples: ["Format"] },
      field_type: {
        type: "string",
        examples: ["dropdown"],
        description:
          "short_text | long_text | rich_text | dropdown | multi_select | email | url | phone | checkbox | file",
      },
      field_source: {
        type: "string",
        enum: ["standard", "custom"],
        description: "`standard` for locked system fields, `custom` for organizer-added ones.",
      },
      contains_pii: { type: "boolean" },
      scope: { type: "string", enum: ["session", "contact"] },
      required: { type: "boolean" },
      enabled: { type: "boolean" },
      options: { type: "array", nullable: true, items: { type: "string" } },
      help: { type: "string", nullable: true },
      form_id: { type: "string" },
      form_slug: { type: "string" },
      createdAt: ts("Owning form's creation time."),
      updatedAt: ts("Owning form's last write."),
    },
  },
  Submission: {
    type: "object",
    description: "The pre-parity submission shape, unchanged.",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string", nullable: true },
      kind: { type: "string", enum: ["abstract", "session"] },
      status: { type: "string" },
      track: { type: "string", nullable: true },
      format: { type: "string", nullable: true },
      level: { type: "string", nullable: true },
      language: { type: "string", nullable: true },
      tags: { type: "array", items: { type: "string" } },
      submittedAt: { type: "integer" },
      decidedAt: { type: "integer", nullable: true },
      speakers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            email: { type: "string" },
            role: { type: "string" },
            jobTitle: { type: "string", nullable: true },
            company: { type: "string", nullable: true },
          },
        },
      },
    },
  },
  Webhook: {
    type: "object",
    properties: {
      id: { type: "string" },
      url: { type: "string", format: "uri" },
      events: {
        type: "array",
        items: { type: "string" },
        description: "Subscribed event types, or `[\"*\"]` for all of them.",
      },
      description: { type: "string", nullable: true },
      enabled: { type: "boolean" },
      event_id: { type: "string", nullable: true, description: "Null for workspace-wide endpoints." },
      org_id: { type: "string" },
      secret: {
        type: "string",
        description:
          "Full `whsec_…` value on create and rotate; masked (`whsec_1a2b3c4d…ef01`) everywhere else.",
      },
      created_at: ts("Creation time."),
      last_delivery_at: ts("Most recent attempt."),
      last_status: { type: "integer", nullable: true },
      last_error: { type: "string", nullable: true },
      consecutive_failures: { type: "integer" },
    },
  },
  WebhookDelivery: {
    type: "object",
    properties: {
      id: { type: "string" },
      event_type: { type: "string", examples: ["session.updated"] },
      status: { type: "string", enum: ["pending", "success", "failed"] },
      attempts: { type: "integer" },
      response_status: { type: "integer", nullable: true },
      error: { type: "string", nullable: true },
      payload: { type: "string", description: "The exact JSON body that was signed." },
      created_at: ts("Queued at."),
      delivered_at: ts("Succeeded at."),
    },
  },
  WebhookPayload: {
    type: "object",
    description:
      "The body POSTed to your endpoint. Signed with `Trackstage-Signature: t=<unix-seconds>,v1=<hex>`, an HMAC-SHA256 over `\"{t}.{body}\"` using the endpoint's secret. Verify it before trusting the payload, and reject timestamps outside your tolerance to prevent replay.",
    required: ["data", "metadata"],
    properties: {
      data: {
        type: "object",
        description: "The changed resource. Always carries `id` and `sourceOfChange`.",
        additionalProperties: true,
        properties: {
          id: { type: "string" },
          sourceOfChange: { type: "string", enum: ["user", "agent"] },
        },
      },
      metadata: {
        type: "object",
        properties: {
          action: { type: "string", examples: ["session.updated"] },
          event_id: { type: "string", nullable: true },
          org_id: { type: "string" },
          resource_url: {
            type: "string",
            nullable: true,
            description: "Where to re-fetch the resource from this API.",
          },
          version: { type: "integer", examples: [1] },
          datetime: { type: "string", format: "date-time" },
        },
      },
    },
  },
  Agenda: {
    type: "object",
    properties: {
      event: { $ref: "#/components/schemas/Event" },
      published: { type: "boolean" },
      published_at: ts("When the programme went public."),
      rooms: { type: "array", items: { $ref: "#/components/schemas/NamedMetadata" } },
      tracks: { type: "array", items: { $ref: "#/components/schemas/NamedMetadata" } },
      scheduled: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            starts_at: ts("Slot start."),
            ends_at: ts("Slot end."),
            duration_minutes: { type: "integer", nullable: true },
            room_id: { type: "string", nullable: true },
            track_id: { type: "string", nullable: true },
          },
        },
      },
      unscheduled: {
        type: "array",
        items: {
          type: "object",
          properties: { id: { type: "string" }, title: { type: "string" } },
        },
      },
      conflicts: {
        type: "array",
        items: {},
        description: "Double-booked rooms and speakers, computed live.",
      },
      totals: {
        type: "object",
        properties: {
          scheduled: { type: "integer" },
          unscheduled: { type: "integer" },
          conflicts: { type: "integer" },
        },
      },
    },
  },
  EchoResult: {
    type: "object",
    properties: {
      received: { type: "boolean" },
      verified: { type: "boolean", nullable: true },
      event: { type: "string", nullable: true },
      delivery: { type: "string", nullable: true },
    },
  },
  FileBytesReceipt: {
    type: "object",
    properties: {
      data: {
        type: "object",
        properties: {
          id: { type: "string" },
          size: { type: "integer" },
          received: { type: "boolean" },
        },
      },
    },
  },

  // ——— Request bodies ———
  DateRangeFilter: {
    type: "object",
    description: "ISO-8601 or epoch milliseconds are both accepted.",
    properties: {
      before: { type: "string", format: "date-time" },
      after: { type: "string", format: "date-time" },
    },
  },
  SessionSearchBody: {
    type: "object",
    properties: {
      filters: {
        type: "object",
        properties: {
          status: {
            type: "string",
            enum: [
              "draft",
              "pending",
              "accept_queue",
              "decline_queue",
              "accepted",
              "declined",
              "withdrawn",
            ],
          },
          isAbstract: { type: "boolean" },
          trackId: { type: "string" },
          tagId: { type: "string" },
          search: { type: "string", description: "Matches title and description." },
          includeDeleted: { type: "boolean" },
          createdAt: { $ref: "#/components/schemas/DateRangeFilter" },
          updatedAt: { $ref: "#/components/schemas/DateRangeFilter" },
        },
      },
      sort: {
        type: "object",
        properties: {
          order: { type: "string", enum: ["createdAt", "updatedAt", "startsAt", "title"] },
          sort: { type: "string", enum: ["asc", "desc"] },
        },
      },
      expand: { type: "array", items: { type: "string", enum: ["files", "deleted"] } },
      page: { type: "integer", minimum: 1 },
      pageSize: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  SpeakerSearchBody: {
    type: "object",
    properties: {
      filters: {
        type: "object",
        properties: {
          search: { type: "string" },
          workflowStatus: { type: "string", enum: ["invited", "confirmed", "dropped"] },
        },
      },
      sort: {
        type: "object",
        properties: { sort: { type: "string", enum: ["asc", "desc"] } },
      },
      page: { type: "integer", minimum: 1 },
      pageSize: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  MetadataSearchBody: {
    type: "object",
    properties: {
      filters: { type: "object", properties: { search: { type: "string" } } },
      page: { type: "integer", minimum: 1 },
      pageSize: { type: "integer", minimum: 1, maximum: 100 },
    },
  },
  SessionWriteBody: {
    type: "object",
    description:
      "Every field is optional on update; `title` is required on create. snake_case and camelCase keys are both accepted, and times take ISO-8601 or epoch milliseconds.",
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      status: {
        type: "string",
        enum: [
          "draft",
          "pending",
          "accept_queue",
          "decline_queue",
          "accepted",
          "declined",
          "withdrawn",
        ],
      },
      is_abstract: {
        type: "boolean",
        description: "Create only — a session cannot change kind after creation.",
      },
      starts_at: { type: "string", format: "date-time" },
      ends_at: {
        type: "string",
        format: "date-time",
        description: "Converted to `duration_minutes` when that is not given.",
      },
      duration_minutes: { type: "integer", minimum: 5 },
      room_id: { type: "string", description: "Empty string clears the assignment." },
      track_id: { type: "string", description: "Empty string clears the assignment." },
      format: { type: "string" },
      level: { type: "string" },
      language: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      custom_fields: { type: "object", additionalProperties: true },
      submitter_email: { type: "string", format: "email" },
      submitter_first_name: { type: "string" },
      submitter_last_name: { type: "string" },
      speaker_ids: { type: "array", items: { type: "string" } },
      updated_at: {
        type: "string",
        format: "date-time",
        description: "Optimistic concurrency token. A mismatch answers 409.",
      },
    },
  },
  CustomFieldsBody: {
    type: "object",
    required: ["custom_fields"],
    properties: {
      custom_fields: {
        type: "object",
        additionalProperties: true,
        description: "Values keyed by field `internal_name`.",
      },
    },
  },
  BulkOperations: {
    type: "object",
    required: ["operations"],
    properties: {
      operations: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          required: ["action"],
          properties: {
            action: { type: "string", enum: ["create", "update", "delete"] },
            id: { type: "string", description: "Required for update and delete." },
            data: { $ref: "#/components/schemas/SessionWriteBody" },
          },
        },
      },
    },
  },
  BulkResponse: {
    type: "object",
    properties: {
      batch_id: { type: "string" },
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            action: { type: "string" },
            status: { type: "string", enum: ["success", "error"] },
            id: { type: "string" },
            error: {
              type: "object",
              properties: {
                code: { type: "string" },
                message: { type: "string" },
              },
            },
          },
        },
      },
      stats: {
        type: "object",
        properties: {
          total: { type: "integer" },
          succeeded: { type: "integer" },
          failed: { type: "integer" },
        },
      },
    },
  },
  SpeakerWriteBody: {
    type: "object",
    description: "`email` is required on create and ignored on update.",
    properties: {
      email: { type: "string", format: "email" },
      first_name: { type: "string" },
      last_name: { type: "string" },
      title: { type: "string" },
      company_name: { type: "string" },
      about: { type: "string" },
      phone_mobile: { type: "string" },
      pronouns: { type: "string" },
      salutation: { type: "string" },
      website_url: { type: "string" },
      linkedin_url: { type: "string" },
      twitter_url: { type: "string" },
      workflow_status: { type: "string", enum: ["invited", "confirmed", "dropped"] },
    },
  },
  FieldWriteBody: {
    type: "object",
    properties: {
      name: { type: "string", description: "The label organizers and speakers see." },
      label: { type: "string", description: "Alias of `name`." },
      type: {
        type: "string",
        description:
          "short_text | long_text | rich_text | dropdown | multi_select | email | url | phone | checkbox | file",
      },
      required: { type: "boolean" },
      enabled: { type: "boolean" },
      help: { type: "string" },
      options: { type: "array", items: { type: "string" } },
      form_id: { type: "string", description: "Which form to add it to; defaults to the first." },
    },
  },
  MetadataWriteBody: {
    type: "object",
    properties: {
      name: { type: "string" },
      color: {
        type: "string",
        description:
          "Tracks: any hex. Statuses: one of `green`, `amber`, `red`, `gray`, `blue`.",
        examples: ["#0F6E70"],
      },
      capacity: { type: "integer", description: "Rooms only." },
      order: { type: "integer" },
      category: {
        type: "string",
        enum: ["draft", "pending", "accepted", "declined", "withdrawn"],
        description:
          "Statuses only — the pipeline behaviour the label inherits. Defaults to `pending`. Built-in statuses refuse a category change.",
      },
      reassign_to: {
        type: "string",
        description:
          "Statuses only, on DELETE — where submissions carrying this label should land. Required when any still do.",
      },
    },
  },
  Form: {
    type: "object",
    description:
      "A call-for-speakers form. Its `questions[]` ARE the event's custom-field definitions, so this is the same object `GET /fields` describes, seen from the form's side.",
    properties: {
      id: { type: "string" },
      slug: { type: "string", examples: ["cfp"] },
      kind: { type: "string", enum: ["abstract", "session"] },
      status: { type: "string", enum: ["open", "closed"] },
      is_open: {
        type: "boolean",
        description: "Status is open AND the close date has not passed.",
      },
      close_at: ts("When the CFP closes."),
      internal_name: { type: "string" },
      external_title: { type: "string" },
      page_heading: { type: "string", nullable: true },
      welcome_message: { type: "string", nullable: true },
      show_welcome_message: { type: "boolean" },
      notify_emails: { type: "array", items: { type: "string" } },
      public_url: {
        type: "string",
        examples: ["/submit/ai-engineer/ai-summit-2026/cfp"],
        description: "The canonical link an organizer shares.",
      },
      questions: { type: "array", items: { $ref: "#/components/schemas/FormQuestion" } },
      participant_config: {
        type: "object",
        properties: {
          speaker_min: { type: "integer" },
          speaker_max: { type: "integer" },
          chairperson_enabled: { type: "boolean" },
          moderator_enabled: { type: "boolean" },
          send_confirmation_email: { type: "boolean" },
          fields: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                internal_name: { type: "string", examples: ["participant.email"] },
                label: { type: "string" },
                required: { type: "boolean" },
                enabled: { type: "boolean" },
                locked: { type: "boolean" },
                help: { type: "string", nullable: true },
              },
            },
          },
        },
      },
      settings: {
        type: "object",
        properties: {
          limit_per_user: { type: "integer", nullable: true },
          allow_drafts: { type: "boolean" },
          success_message: { type: "string", nullable: true },
          auto_redirect_to_portal: { type: "boolean" },
          send_reminder_email: { type: "boolean" },
        },
      },
      submission_count: { type: "integer" },
      draft_count: { type: "integer" },
      created_at: ts("Creation time."),
      updated_at: ts("Last change."),
    },
  },
  FormQuestion: {
    type: "object",
    description:
      "One question on the form — the same object as a custom-field definition. `id`/`internal_name` is the key its answers are stored under.",
    properties: {
      id: { type: "string", examples: ["format"] },
      internal_name: { type: "string", examples: ["format"] },
      public_name: { type: "string", examples: ["Format"] },
      label: { type: "string", examples: ["Format"] },
      field_type: { type: "string", examples: ["dropdown"] },
      type: { type: "string", examples: ["dropdown"] },
      required: { type: "boolean" },
      enabled: { type: "boolean" },
      locked: {
        type: "boolean",
        description: "System questions the public flow depends on; they cannot be removed.",
      },
      help: { type: "string", nullable: true },
      placeholder: { type: "string", nullable: true },
      options: { type: "array", items: { type: "string" }, nullable: true },
      max_chars: { type: "integer", nullable: true },
      show_if: {
        type: "object",
        nullable: true,
        description: "Conditional logic — show this question only when another answered a value.",
        properties: {
          questionId: { type: "string" },
          equals: { type: "string" },
        },
      },
      is_track_question: {
        type: "boolean",
        description: "The answer to this question routes the submission to a track.",
      },
      order: { type: "integer" },
    },
  },
  Task: {
    type: "object",
    description: "One thing a speaker owes the organizer.",
    properties: {
      id: { type: "string" },
      title: { type: "string", examples: ["Upload your slides"] },
      instructions: { type: "string", nullable: true },
      kind: {
        type: "string",
        enum: ["profile", "headshot", "upload", "answer", "confirm"],
        description: "How it gets ticked off. `answer` asks a question in `instructions` and the speaker types a reply.",
      },
      response: {
        type: "string",
        nullable: true,
        description: "Kind `answer` only: what the speaker wrote back.",
      },
      due_at: ts("Deadline."),
      completed_at: ts("When the speaker ticked it off."),
      is_complete: { type: "boolean" },
      is_overdue: { type: "boolean" },
      speaker_id: { type: "string" },
      speaker: {
        type: "object",
        nullable: true,
        properties: {
          id: { type: "string" },
          full_name: { type: "string" },
          email: { type: "string" },
        },
      },
      session_id: { type: "string", nullable: true },
      session_title: { type: "string", nullable: true },
      form_id: { type: "string", nullable: true },
      created_at: ts("Creation time."),
    },
  },
  EvaluationCriterion: {
    type: "object",
    properties: {
      id: { type: "string" },
      label: { type: "string", examples: ["Relevance"] },
      type: { type: "string", enum: ["numeric", "select", "text"] },
      options: { type: "array", items: { type: "string" }, nullable: true },
      weight: {
        type: "number",
        description: "Relative importance in the weighted average. Numeric criteria only.",
      },
    },
  },
  EvaluationPlan: {
    type: "object",
    description: "One review round: criteria, a pool of submissions, and evaluators.",
    properties: {
      id: { type: "string" },
      name: { type: "string", examples: ["Round 1 — technical review"] },
      round: { type: "integer" },
      status: { type: "string", enum: ["open", "closed"] },
      blind: {
        type: "boolean",
        description: "Evaluators see the submissions without speaker identities.",
      },
      opens_at: ts("When the round opens."),
      due_at: ts("When the round closes."),
      criteria: {
        type: "array",
        items: { $ref: "#/components/schemas/EvaluationCriterion" },
      },
      submission_ids: { type: "array", items: { type: "string" } },
      submission_count: { type: "integer" },
      evaluator_count: { type: "integer" },
      assigned_count: { type: "integer", description: "Evaluations expected in total." },
      completed_count: { type: "integer" },
      outstanding_count: { type: "integer" },
      completion_pct: { type: "integer" },
      recused_count: { type: "integer" },
      scored_count: { type: "integer" },
      average_score: {
        type: "number",
        nullable: true,
        description: "Weighted mean over numeric criteria. Recusals never reach it.",
      },
      created_at: ts("Creation time."),
      evaluators: {
        type: "array",
        items: { $ref: "#/components/schemas/Evaluator" },
        description: "Only on the detail read.",
      },
      submissions: {
        type: "array",
        description: "Only on the detail read — the pool with per-submission averages.",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            status: { type: "string" },
            completed_count: { type: "integer" },
            recused_count: { type: "integer" },
            average_score: { type: "number", nullable: true },
          },
        },
      },
    },
  },
  Evaluator: {
    type: "object",
    properties: {
      id: { type: "string" },
      plan_id: { type: "string" },
      plan_name: { type: "string", description: "Only on the event-wide list." },
      plan_round: { type: "integer", description: "Only on the event-wide list." },
      email: { type: "string" },
      name: { type: "string", nullable: true },
      token: {
        type: "string",
        description: "Their magic review link's token. Organizer-only — never publish it.",
      },
      review_path: { type: "string", examples: ["/review/6f2c…"] },
      assigned_submission_ids: { type: "array", items: { type: "string" } },
      custom_assignment: {
        type: "boolean",
        description: "True when the queue was hand-picked rather than the whole pool.",
      },
      completed_count: { type: "integer" },
      assigned_count: { type: "integer" },
      outstanding_count: { type: "integer" },
      recused_count: { type: "integer" },
      last_reminded_at: ts("Last nudge."),
      created_at: ts("Creation time."),
    },
  },
  Evaluation: {
    type: "object",
    description: "One evaluator's scorecard for one submission.",
    properties: {
      id: { type: "string" },
      plan_id: { type: "string" },
      plan_name: { type: "string" },
      round: { type: "integer" },
      session_id: { type: "string" },
      session_title: { type: "string", nullable: true },
      evaluator_id: { type: "string" },
      evaluator_email: { type: "string", nullable: true },
      scores: {
        type: "object",
        additionalProperties: { type: "number" },
        description: "criterion id → 1–5. Numeric criteria only.",
      },
      values: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "criterion id → chosen option or free text.",
      },
      comment: { type: "string", nullable: true },
      recused: { type: "boolean" },
      recusal_reason: { type: "string", nullable: true },
      completed_at: ts("When it was submitted."),
      created_at: ts("Creation time."),
    },
  },
  EventWriteBody: {
    type: "object",
    properties: {
      name: { type: "string", examples: ["AI Summit 2026"] },
      slug: {
        type: "string",
        description:
          "The public address. Derived from the name when omitted; suffixed rather than rejected if taken.",
      },
      timezone: { type: "string", examples: ["America/Los_Angeles"], default: "UTC" },
      type: { type: "string", examples: ["Conference"] },
      website_url: { type: "string" },
      description: { type: "string" },
      venue: { type: "string" },
      starts_at: {
        type: "string",
        description: "ISO-8601 or epoch milliseconds.",
        examples: ["2026-09-14T09:00:00.000Z"],
      },
      ends_at: { type: "string", description: "ISO-8601 or epoch milliseconds." },
      organization_id: {
        type: "string",
        description:
          "Workspace to create the event in. Optional when you administer exactly one — otherwise the 400 lists your choices.",
      },
      portal_settings: {
        type: "object",
        description: "Speaker-portal behaviour. Unspecified flags keep their current value.",
        properties: {
          always_show_tasks: { type: "boolean" },
          allow_submission_edits: { type: "boolean" },
          extend_task_deadlines: { type: "boolean" },
        },
      },
    },
  },
  ParticipantWriteBody: {
    type: "object",
    description:
      "Name an existing person with `speaker_id`, or an `email` — a person this event has never seen is created, which needs `first_name`.",
    properties: {
      speaker_id: { type: "string" },
      email: { type: "string", format: "email" },
      first_name: { type: "string" },
      last_name: { type: "string" },
      role: {
        type: "string",
        enum: ["speaker", "chairperson", "moderator"],
        default: "speaker",
      },
    },
  },
  FormWriteBody: {
    type: "object",
    properties: {
      internal_name: { type: "string", description: "Required on create." },
      external_title: { type: "string", description: "What the public form is titled." },
      kind: { type: "string", enum: ["abstract", "session"], default: "abstract" },
      slug: { type: "string", description: "Public address inside the event." },
      status: { type: "string", enum: ["open", "closed"] },
      close_at: { type: "string", description: "ISO-8601 or epoch milliseconds." },
      page_heading: { type: "string" },
      welcome_message: { type: "string" },
      show_welcome_message: { type: "boolean" },
      notify_emails: {
        type: "array",
        items: { type: "string" },
        description: "Who gets told when a submission arrives.",
      },
      questions: {
        type: "array",
        items: { $ref: "#/components/schemas/FormQuestion" },
        description:
          "Replaces the question set wholesale. Locked system questions must be included.",
      },
      participant_config: {
        type: "object",
        properties: {
          speaker_min: { type: "integer" },
          speaker_max: { type: "integer" },
          chairperson_enabled: { type: "boolean" },
          moderator_enabled: { type: "boolean" },
          send_confirmation_email: { type: "boolean" },
          fields: { type: "array", items: { type: "object", additionalProperties: true } },
        },
      },
      settings: {
        type: "object",
        properties: {
          limit_per_user: { type: "integer" },
          allow_drafts: { type: "boolean" },
          success_message: { type: "string" },
          auto_redirect_to_portal: { type: "boolean" },
          send_reminder_email: { type: "boolean" },
        },
      },
    },
  },
  TaskWriteBody: {
    type: "object",
    properties: {
      title: { type: "string", examples: ["Upload your slides"] },
      instructions: { type: "string" },
      kind: {
        type: "string",
        enum: ["profile", "headshot", "upload", "answer", "confirm"],
        default: "upload",
      },
      due_at: { type: "string", description: "ISO-8601 or epoch milliseconds." },
      completed: {
        type: "boolean",
        description: "Update only — tick the task off (or reopen it) on the speaker's behalf.",
      },
      session_id: {
        type: "string",
        description: "Bind the task to a session, so files uploaded into it land on that session.",
      },
      speaker_ids: { type: "array", items: { type: "string" } },
      speaker_emails: {
        type: "array",
        items: { type: "string" },
        description: "Assign by address without looking ids up first.",
      },
    },
  },
  EvaluationPlanWriteBody: {
    type: "object",
    properties: {
      name: { type: "string", description: "Required on create." },
      round: { type: "integer", default: 1 },
      status: { type: "string", enum: ["open", "closed"] },
      blind: { type: "boolean" },
      opens_at: { type: "string", description: "ISO-8601 or epoch milliseconds." },
      due_at: { type: "string", description: "ISO-8601 or epoch milliseconds." },
      submission_ids: {
        type: "array",
        items: { type: "string" },
        description: "The pool. Replaces the current pool wholesale.",
      },
      criteria: {
        type: "array",
        description: "At least one is required on create. Replaces the criteria wholesale.",
        items: {
          type: "object",
          required: ["label"],
          properties: {
            id: { type: "string", description: "Derived from the label when omitted." },
            label: { type: "string" },
            type: { type: "string", enum: ["numeric", "select", "text"], default: "numeric" },
            options: { type: "array", items: { type: "string" } },
            weight: { type: "number", default: 1 },
          },
        },
      },
    },
  },
  EvaluatorWriteBody: {
    type: "object",
    properties: {
      plan_id: { type: "string", description: "Required on create." },
      email: { type: "string", format: "email", description: "Required on create." },
      name: { type: "string" },
      assigned_submission_ids: {
        type: "array",
        items: { type: "string" },
        description:
          "Hand-picked queue. Must be a subset of the plan's pool. Omit for the whole pool.",
      },
    },
  },
  WebhookWriteBody: {
    type: "object",
    properties: {
      url: { type: "string", format: "uri" },
      events: {
        type: "array",
        items: { type: "string" },
        description: "Event types to subscribe to; `[\"*\"]` means all.",
      },
      description: { type: "string" },
      enabled: { type: "boolean" },
      event: {
        type: "string",
        description:
          "Event slug or id to scope the endpoint to. Omit for a workspace-wide endpoint.",
      },
    },
  },
  SessionFileCreateBody: {
    type: "object",
    required: ["filename"],
    properties: {
      filename: { type: "string", examples: ["keynote-slides.pptx"] },
      size_bytes: { type: "integer", minimum: 1 },
      content_type: { type: "string" },
      mimetype: { type: "string", description: "Alias of `content_type`." },
      title: { type: "string" },
      assigned_participant_id: { type: "string", nullable: true },
    },
  },
  SessionFileUpdateBody: {
    type: "object",
    properties: {
      title: { type: "string" },
      assigned_participant_id: {
        type: "string",
        nullable: true,
        description: "Empty string clears the assignment.",
      },
    },
  },
  SessionFileUploadForm: {
    type: "object",
    required: ["file"],
    properties: {
      file: { type: "string", format: "binary" },
      title: { type: "string" },
      assigned_participant_id: { type: "string" },
    },
  },
  FileUploadTicket: {
    type: "object",
    properties: {
      data: {
        type: "object",
        properties: {
          id: { type: "string" },
          filename: { type: "string" },
          title: { type: "string" },
          replaces: { type: "string" },
          upload: {
            type: "object",
            properties: {
              url: { type: "string", format: "uri" },
              method: { type: "string", examples: ["PUT"] },
              headers: { type: "object", additionalProperties: { type: "string" } },
            },
          },
        },
      },
    },
  },
}

/** Envelope schemas are mechanical, so they are generated rather than typed. */
function envelope(name, inner) {
  return {
    type: "object",
    properties: { data: inner },
    required: ["data"],
    description: `Single-resource envelope. The resource is under \`data\`.`,
  }
}

function page(name, itemRef, extra = {}) {
  return {
    type: "object",
    description:
      "Paginated envelope. `data` and `results` are the same array — `data` is what this API has always returned, `results` is what Sessionboard's search endpoints return.",
    properties: {
      data: { type: "array", items: { $ref: `#/components/schemas/${itemRef}` } },
      results: { type: "array", items: { $ref: `#/components/schemas/${itemRef}` } },
      pagination: { $ref: "#/components/schemas/Pagination" },
      ...extra,
    },
  }
}

const DERIVED = {
  SessionEnvelope: envelope("Session", { $ref: "#/components/schemas/Session" }),
  SpeakerEnvelope: envelope("Speaker", { $ref: "#/components/schemas/Speaker" }),
  EventEnvelope: envelope("Event", { $ref: "#/components/schemas/Event" }),
  FieldEnvelope: envelope("Field", { $ref: "#/components/schemas/Field" }),
  MetadataEnvelope: envelope("NamedMetadata", { $ref: "#/components/schemas/NamedMetadata" }),
  FileEnvelope: envelope("SessionFile", { $ref: "#/components/schemas/SessionFile" }),
  AgendaEnvelope: envelope("Agenda", { $ref: "#/components/schemas/Agenda" }),
  WebhookEnvelope: envelope("Webhook", { $ref: "#/components/schemas/Webhook" }),
  WebhookDetailEnvelope: envelope("Webhook", {
    allOf: [
      { $ref: "#/components/schemas/Webhook" },
      {
        type: "object",
        properties: {
          deliveries: {
            type: "array",
            items: { $ref: "#/components/schemas/WebhookDelivery" },
          },
        },
      },
    ],
  }),
  WebhookTestEnvelope: envelope("WebhookTest", {
    type: "object",
    properties: {
      delivery_id: { type: "string" },
      status: { type: "string", examples: ["queued"] },
    },
  }),
  FileListEnvelope: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/SessionFile" } },
    },
  },
  WebhookListEnvelope: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/Webhook" } },
      results: { type: "array", items: { $ref: "#/components/schemas/Webhook" } },
    },
  },
  WebhookDeliveryListEnvelope: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } },
      results: { type: "array", items: { $ref: "#/components/schemas/WebhookDelivery" } },
    },
  },
  EventDetailEnvelope: envelope("Event", {
    allOf: [
      { $ref: "#/components/schemas/Event" },
      {
        type: "object",
        properties: {
          totals: {
            type: "object",
            description: "Row counts for the event, so one call answers “did my import land?”.",
            properties: {
              rooms: { type: "integer" },
              tracks: { type: "integer" },
              forms: { type: "integer" },
              sessions: { type: "integer" },
              abstracts: { type: "integer" },
              accepted: { type: "integer" },
              scheduled: { type: "integer" },
            },
          },
        },
      },
    ],
  }),
  FormEnvelope: envelope("Form", { $ref: "#/components/schemas/Form" }),
  TaskEnvelope: envelope("Task", { $ref: "#/components/schemas/Task" }),
  TaskCreateEnvelope: {
    type: "object",
    description:
      "One task row per speaker. `data` is the first (the single-speaker case); `results` is all of them.",
    properties: {
      data: { $ref: "#/components/schemas/Task" },
      results: { type: "array", items: { $ref: "#/components/schemas/Task" } },
      created: { type: "integer" },
    },
  },
  EvaluationPlanEnvelope: envelope("EvaluationPlan", {
    $ref: "#/components/schemas/EvaluationPlan",
  }),
  EvaluatorEnvelope: envelope("Evaluator", { $ref: "#/components/schemas/Evaluator" }),
  StatusEnvelope: envelope("SessionStatus", {
    $ref: "#/components/schemas/SessionStatus",
  }),
  ParticipantEnvelope: envelope("Participant", {
    allOf: [
      { $ref: "#/components/schemas/Speaker" },
      {
        type: "object",
        properties: {
          participant_id: { type: "string" },
          role: { type: "string", enum: ["speaker", "chairperson", "moderator"] },
          session_id: { type: "string" },
        },
      },
    ],
  }),
  ParticipantListEnvelope: {
    type: "object",
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/Speaker" } },
      results: { type: "array", items: { $ref: "#/components/schemas/Speaker" } },
    },
  },
  FormsPage: page("Forms", "Form"),
  TasksPage: page("Tasks", "Task"),
  EvaluationPlansPage: page("EvaluationPlans", "EvaluationPlan"),
  EvaluatorsPage: page("Evaluators", "Evaluator"),
  EvaluationsPage: page("Evaluations", "Evaluation"),
  StatusesPage: page("Statuses", "SessionStatus"),
  SessionsPage: page("Sessions", "Session", {
    event: { $ref: "#/components/schemas/Event" },
  }),
  SessionStatusesPage: page("SessionStatuses", "SessionStatusRow"),
  SpeakersPage: page("Speakers", "Speaker", {
    event: { $ref: "#/components/schemas/Event" },
  }),
  SubmissionsPage: page("Submissions", "Submission", {
    event: { $ref: "#/components/schemas/Event" },
  }),
  EventsPage: page("Events", "Event"),
  FieldsPage: page("Fields", "Field"),
  MetadataPage: page("Metadata", "NamedMetadata"),
}

const PARAMETERS = {
  eventRef: {
    name: "eventRef",
    in: "path",
    required: true,
    schema: { type: "string" },
    description:
      "The event's slug (the one in its public URL) or its raw id. Both work everywhere.",
    example: "ai-summit-2026",
  },
  sessionId: {
    name: "sessionId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The session id.",
  },
  speakerId: {
    name: "speakerId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The speaker id.",
  },
  fileId: {
    name: "fileId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The file id, or the upload id from an initiate/replace call.",
  },
  fieldId: {
    name: "fieldId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The field's `internal_name`.",
  },
  webhookId: {
    name: "webhookId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The webhook endpoint id.",
  },
  formId: {
    name: "formId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The form's id, or its public slug (e.g. `cfp`). Both work.",
    example: "cfp",
  },
  taskId: {
    name: "taskId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The task id.",
  },
  planId: {
    name: "planId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The evaluation plan id.",
  },
  evaluatorId: {
    name: "evaluatorId",
    in: "path",
    required: true,
    schema: { type: "string" },
    description: "The evaluator id.",
  },
  speaker_id: {
    name: "speaker_id",
    in: "query",
    schema: { type: "string" },
    description: "Restrict to one speaker.",
  },
  session_id: {
    name: "session_id",
    in: "query",
    schema: { type: "string" },
    description: "Restrict to one session.",
  },
  plan_id: {
    name: "plan_id",
    in: "query",
    schema: { type: "string" },
    description: "Restrict to one evaluation plan.",
  },
  evaluator_id: {
    name: "evaluator_id",
    in: "query",
    schema: { type: "string" },
    description: "Restrict to one evaluator.",
  },
  id: {
    name: "id",
    in: "path",
    required: true,
    schema: { type: "string" },
    description:
      "The resource id. For form-backed value lists (tags, formats, levels, languages) this is the value itself, URL-encoded.",
  },
  page: {
    name: "page",
    in: "query",
    schema: { type: "integer", minimum: 1, default: 1 },
    description: "1-based page number.",
  },
  pageSize: {
    name: "pageSize",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
    description: "Rows per page, max 100. `page_size` is accepted as an alias.",
  },
  search: {
    name: "search",
    in: "query",
    schema: { type: "string" },
    description: "Free-text filter.",
  },
  status: {
    name: "status",
    in: "query",
    schema: { type: "string" },
    description:
      "Filter by status. On `/sessions` this is the pipeline status and passing it opts out of the accepted-only default; on `/forms` it is `open` or `closed`; on `/tasks` it is `open`, `completed` or `overdue`; on `/evaluation-plans` it is `open` or `closed`.",
  },
  is_abstract: {
    name: "is_abstract",
    in: "query",
    schema: { type: "boolean" },
    description: "Restrict to abstracts (true) or programme sessions (false).",
  },
  track_id: { name: "track_id", in: "query", schema: { type: "string" } },
  tag_id: { name: "tag_id", in: "query", schema: { type: "string" } },
  include_deleted: {
    name: "include_deleted",
    in: "query",
    schema: { type: "boolean" },
    description:
      "Include soft-deleted rows — sessions on `/sessions`, archived statuses on `/statuses`. Each carries `deleted_at`.",
  },
  expand: {
    name: "expand",
    in: "query",
    schema: { type: "string" },
    description:
      "Comma-separated. `files` inlines attachments; `deleted` lets a soft-deleted session be read.",
  },
  workflow_status: {
    name: "workflow_status",
    in: "query",
    schema: { type: "string", enum: ["invited", "confirmed", "dropped"] },
  },
  event: {
    name: "event",
    in: "query",
    schema: { type: "string" },
    description: "Restrict to endpoints scoped to this event (slug or id).",
  },
  limit: {
    name: "limit",
    in: "query",
    schema: { type: "integer", minimum: 1, maximum: 100, default: 25 },
  },
  secret: {
    name: "secret",
    in: "query",
    required: true,
    schema: { type: "string" },
    description: "The endpoint's `whsec_…` signing secret, so the sink can verify the HMAC.",
  },
}

const ERROR_DESCRIPTIONS = {
  400: "Bad request — the body or parameters are invalid. The message says what.",
  401: "Missing or invalid API token.",
  403: "The credential is valid but lacks the scope, role or workspace access this needs.",
  404: "No such event, resource, or endpoint.",
  409: "Stale update — the resource changed since you fetched it. Re-read and retry.",
  413: "The file exceeds the 50 MB simple-upload ceiling. Use the two-phase flow.",
  429: "Rate limited. Wait for `Retry-After` seconds.",
}

const RATE_LIMIT_HEADER_REFS = {
  "RateLimit-Limit": { $ref: "#/components/headers/RateLimit-Limit" },
  "RateLimit-Remaining": { $ref: "#/components/headers/RateLimit-Remaining" },
  "RateLimit-Reset": { $ref: "#/components/headers/RateLimit-Reset" },
}

const RATE_LIMIT_HEADERS = {
  "RateLimit-Limit": {
    schema: { type: "integer" },
    description: "Requests allowed in the current window.",
  },
  "RateLimit-Remaining": {
    schema: { type: "integer" },
    description: "Requests left in the current window.",
  },
  "RateLimit-Reset": {
    schema: { type: "integer" },
    description: "Unix seconds at which the window resets.",
  },
}

// ——— Request examples ————————————————————————————————————————————————————
//
// One realistic request body per operation that takes one, keyed by
// operationId. Hand-written rather than captured: a request example has to be
// something you could paste into a terminal and have work.

const REQUEST_EXAMPLES = {
  createEvent: {
    name: "AI Summit 2026",
    slug: "ai-summit-2026",
    timezone: "America/Los_Angeles",
    type: "Conference",
    venue: "Moscone West, San Francisco",
    starts_at: "2026-09-14T09:00:00.000Z",
    ends_at: "2026-09-16T18:00:00.000Z",
    website_url: "https://aisummit.example.com",
  },
  updateEvent: {
    venue: "Moscone Center, Hall B",
    ends_at: "2026-09-17T18:00:00.000Z",
    portal_settings: { allow_submission_edits: false },
  },
  searchSessions: {
    filters: { status: "accepted", isAbstract: false, search: "agents" },
    sort: { order: "startsAt", sort: "asc" },
    expand: ["files"],
  },
  searchSessionsByStatus: {
    filters: { updatedAt: { after: "2026-08-01T00:00:00.000Z" } },
  },
  createSession: {
    title: "Designing agent workflows that survive contact with users",
    description: "<p>What we learned shipping agents to 40k organizers.</p>",
    status: "pending",
    is_abstract: false,
    format: "Talk",
    level: "Intermediate",
    language: "English",
    tag_ids: ["AI", "Product"],
    starts_at: "2026-09-14T15:00:00.000Z",
    ends_at: "2026-09-14T15:45:00.000Z",
    submitter_email: "ada@example.com",
    submitter_first_name: "Ada",
    submitter_last_name: "Lovelace",
    custom_fields: { takeaways: "Three patterns and one anti-pattern." },
  },
  updateSession: {
    title: "Designing agent workflows (revised)",
    status: "accepted",
    room_id: "k17abc…",
    updated_at: "2026-08-11T09:12:44.001Z",
  },
  bulkSessions: {
    operations: [
      { action: "create", data: { title: "Sponsor keynote", status: "accepted" } },
      { action: "update", id: "k17abc…", data: { level: "Advanced" } },
      { action: "delete", id: "k17def…" },
    ],
  },
  updateSessionFields: {
    custom_fields: {
      takeaways: "Three patterns and one anti-pattern.",
      prior_talks: ["SREcon 2025", "KubeCon 2024"],
    },
  },
  addSessionParticipant: {
    email: "grace@example.com",
    first_name: "Grace",
    last_name: "Hopper",
    role: "speaker",
  },
  searchSpeakers: {
    filters: { search: "hopper", workflowStatus: "confirmed" },
    sort: { sort: "asc" },
  },
  createSpeaker: {
    email: "grace@example.com",
    first_name: "Grace",
    last_name: "Hopper",
    title: "Distinguished Engineer",
    company_name: "Example Corp",
    about: "Compilers, and why they matter.",
    workflow_status: "invited",
  },
  updateSpeaker: { workflow_status: "confirmed", is_public: true },
  initiateSessionFileUpload: {
    filename: "keynote-slides.pptx",
    content_type:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    size_bytes: 184320000,
    title: "Keynote deck (final)",
  },
  replaceSessionFile: {
    filename: "keynote-slides-v2.pptx",
    content_type:
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
  updateSessionFile: {
    title: "Keynote deck (final)",
    assigned_participant_id: "k57abc…",
  },
  createField: {
    name: "Key takeaways",
    type: "long_text",
    required: true,
    help: "Three bullets an attendee should leave with.",
  },
  updateField: { name: "Key takeaways", required: false },
  createForm: {
    internal_name: "Main CFP 2026",
    external_title: "Call for Speakers — AI Summit 2026",
    kind: "abstract",
    slug: "cfp",
    page_heading: "Speak at AI Summit 2026",
    notify_emails: ["program@aisummit.example.com"],
  },
  updateForm: {
    status: "closed",
    close_at: "2026-08-31T23:59:00.000Z",
    settings: { allow_drafts: true, send_reminder_email: true },
  },
  createTask: {
    title: "Upload your slides",
    instructions: "16:9, PDF or PPTX, under 50 MB please.",
    kind: "upload",
    due_at: "2026-09-01T17:00:00.000Z",
    speaker_emails: ["grace@example.com", "ada@example.com"],
  },
  updateTask: { due_at: "2026-09-05T17:00:00.000Z", completed: true },
  createEvaluationPlan: {
    name: "Round 1 — technical review",
    round: 1,
    blind: true,
    due_at: "2026-07-01T23:59:00.000Z",
    criteria: [
      { label: "Relevance", type: "numeric", weight: 2 },
      { label: "Speaker experience", type: "numeric" },
      { label: "Recommendation", type: "select", options: ["Accept", "Waitlist", "Decline"] },
    ],
    submission_ids: ["k17abc…", "k17def…"],
  },
  updateEvaluationPlan: { status: "closed" },
  createEvaluator: {
    plan_id: "k37abc…",
    email: "reviewer@example.com",
    name: "Alan Turing",
    assigned_submission_ids: ["k17abc…"],
  },
  updateEvaluator: { assigned_submission_ids: ["k17abc…", "k17def…"] },
  createWebhook: {
    url: "https://hooks.example.com/trackstage",
    events: ["session.created", "session.updated", "decision.committed"],
    description: "Programme mirror",
    event: "ai-summit-2026",
  },
  updateWebhook: { events: ["*"], enabled: true },
  // The settings resources share one body schema; their examples differ enough
  // to be worth spelling out per resource.
  createTrack: { name: "Applied AI", color: "#0F6E70", order: 10 },
  updateTrack: { name: "Applied AI & Agents" },
  createRoom: { name: "Hall B", capacity: 450, order: 20 },
  updateRoom: { capacity: 500 },
  createTag: { name: "Open Source" },
  updateTag: { name: "Open source" },
  createFormat: { name: "Lightning Talk" },
  updateFormat: { name: "Lightning talk (10 min)" },
  createLevel: { name: "Advanced" },
  updateLevel: { name: "Advanced / deep dive" },
  createLanguage: { name: "Spanish" },
  updateLanguage: { name: "Español" },
  createStatu: { name: "Waitlist", category: "pending", color: "amber" },
  updateStatu: { name: "Waitlisted", color: "amber" },
  deleteStatu: { reassign_to: "pending" },
  searchFields: { filters: { search: "takeaways" } },
  searchTags: { filters: { search: "open" } },
  searchTracks: { filters: { search: "ai" } },
  searchRooms: { filters: { search: "hall" } },
  searchFormats: { filters: { search: "talk" } },
  searchLevels: { filters: { search: "adv" } },
  searchLanguages: { filters: { search: "eng" } },
  searchStatuses: { filters: { search: "accept" } },
  searchSessionStatuses: { filters: { search: "accept" } },
  echoWebhookDelivery: {
    data: { id: "k17abc…", title: "Designing agent workflows" },
    metadata: { action: "session.updated", event_id: "k97abc…" },
  },
}

// ——— Spec assembly ————————————————————————————————————————————————————————

function buildOperation(route, examples) {
  // "Write" here means "changes data", which POST alone cannot tell you on
  // this API — POST is also the search verb. The scope is what disambiguates.
  const isWrite = route.scope !== null && route.scope.startsWith("write:")
  const pathParams = [...route.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1])
  const parameters = [
    ...pathParams.map((name) => ({ $ref: `#/components/parameters/${name}` })),
    ...route.query.map((name) => ({ $ref: `#/components/parameters/${name}` })),
  ]

  const responses = {}
  for (const [status, schema] of route.responses) {
    const example = examples[`${route.method} ${route.path} ${status}`]
    responses[String(status)] = {
      description:
        status === 201 ? "Created." : status === 204 ? "No content." : "Success.",
      ...(route.bucket ? { headers: RATE_LIMIT_HEADER_REFS } : {}),
      ...(schema
        ? {
            content: {
              "application/json": {
                schema: { $ref: `#/components/schemas/${schema}` },
                ...(example ? { example } : {}),
              },
            },
          }
        : route.path.endsWith("schedule.ics")
          ? {
              content: {
                "text/calendar": {
                  schema: { type: "string" },
                  ...(example ? { example } : {}),
                },
              },
            }
          : {}),
    }
  }

  const failures = new Set(route.errors)
  if (!route.open) {
    failures.add(401)
    // 403 is reachable on every authenticated route: a scoped key missing the
    // scope, the demo token attempting a write, or a member without the role.
    failures.add(403)
  }
  // Anything rate limited can answer 429, whether or not the row spelled it out.
  if (route.bucket) failures.add(429)
  failures.add(404)
  // Shared, not inlined: 80 operations × five failure statuses would otherwise
  // be most of the file, and the reference page downloads all of it.
  for (const status of [...failures].sort()) {
    responses[String(status)] = { $ref: `#/components/responses/E${status}` }
  }

  let requestBody
  if (route.bodyKind === "multipart" && route.requestBody) {
    requestBody = {
      required: true,
      content: {
        "multipart/form-data": {
          schema: { $ref: `#/components/schemas/${route.requestBody}` },
        },
      },
    }
  } else if (route.bodyKind === "binary") {
    requestBody = {
      required: true,
      description: "The raw file bytes.",
      content: {
        "application/octet-stream": { schema: { type: "string", format: "binary" } },
      },
    }
  } else if (route.requestBody) {
    const example = REQUEST_EXAMPLES[route.operationId]
    requestBody = {
      // Optional where the body only carries extras: the search POST on
      // /sessions, and DELETE /statuses/{id} whose `reassign_to` is only
      // needed when submissions still carry the label.
      required:
        route.method !== "DELETE" &&
        (route.method !== "POST" || !route.path.endsWith("/sessions")),
      content: {
        "application/json": {
          schema: { $ref: `#/components/schemas/${route.requestBody}` },
          ...(example ? { example } : {}),
        },
      },
    }
  }

  const notes = []
  if (route.open) {
    notes.push(
      "**Authentication** — none required. This endpoint is deliberately open (see the description above); sending a key anyway is harmless.",
    )
  } else {
    notes.push(
      [
        "**Authentication** — send a personal API key as `x-access-token: sb_live_…` **or** `Authorization: Bearer sb_live_…`. Both headers are first-class.",
        route.scope
          ? `**Scope** \`${route.scope}\` — enforced only when the presenting key declares a scope set; an unscoped key acts with exactly its owner's workspace permissions, and declaring scopes can only narrow that. A 403 names the missing scope.`
          : null,
        isWrite
          ? "**Write** — the read-only demo token (`demo-api-token`) answers 403 here."
          : "The read-only demo token can call this.",
      ]
        .filter(Boolean)
        .join("\n\n"),
    )
  }
  if (route.bucket)
    notes.push(
      `**Rate limit** 100 requests / 15 minutes per key in the \`${route.bucket}\` bucket. Every response carries \`RateLimit-Limit\`, \`RateLimit-Remaining\` and \`RateLimit-Reset\`; a 429 adds \`Retry-After\`.`,
    )

  return {
    operationId: route.operationId,
    tags: [route.tag],
    summary: route.summary,
    description: [route.description, ...notes].join("\n\n"),
    // Machine-readable companions to the prose above, so a generated client or
    // an agent can reason about auth without parsing markdown.
    ...(route.scope ? { "x-required-scope": route.scope } : {}),
    ...(route.bucket ? { "x-rate-limit-bucket": route.bucket } : {}),
    "x-demo-token-allowed": route.open ? true : !isWrite,
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
    // Declared per operation, not just globally, so the reference shows the
    // accepted credentials on every endpoint rather than once at the top.
    security: route.open ? [] : [{ ApiKeyHeader: [] }, { BearerToken: [] }],
  }
}

/**
 * Tag order IS the sidebar order in the reference. Reads and their writes sit
 * next to each other so the full CRUD for one object is visible at a glance
 * (`Sessions` then `Session Writes`, `Event Settings` then `Field Writes` then
 * `Metadata Writes`). Where Sessionboard has no equivalent tag — Forms, Tasks,
 * Evaluation — reads and writes share one tag, because splitting them buys
 * nothing but a second click.
 */
const TAGS = [
  {
    name: "Events",
    description:
      "Full CRUD over the event itself: list, read, create, update, delete. Sessionboard's API reads events only — everything but `GET /v1/events` is ours.",
  },
  {
    name: "Sessions",
    description:
      "Read sessions, abstracts and submissions, and read a session's line-up. Writes are in **Session Writes** below.",
  },
  {
    name: "Session Writes",
    description:
      "Create, update, soft-delete, restore and bulk-edit sessions, and attach or detach speakers. Requires `write:sessions`.",
  },
  {
    name: "Session Files",
    description:
      "Attachments on a session — slides, handouts, anything a speaker uploads. Reads need `read:sessions`; every write needs `write:sessions`.",
  },
  {
    name: "Speakers",
    description:
      "The event's people and the sessions they are on. Reads need `read:contacts`, writes `write:contacts`.",
  },
  {
    name: "Forms",
    description:
      "The call-for-speakers forms themselves — list, read, create, update, delete. A form's questions ARE this event's custom-field definitions, so editing one here changes the public submission page. Requires `write:fields` to change.",
  },
  {
    name: "Tasks",
    description:
      "What each speaker still owes the organizer: headshots, slides, profile completion. `GET /tasks?status=open` is the outstanding-tasks dashboard as an API call. Requires `write:events` to change.",
  },
  {
    name: "Evaluation",
    description:
      "Multi-round review: plans (criteria + pool), evaluators (with their magic review links and per-evaluator assignment), and the individual scorecards behind every average.",
  },
  { name: "Agenda", description: "The timetable, its conflicts, and the publish gate." },
  {
    name: "Event Settings",
    description:
      "Read the field definitions and the value lists a session's metadata comes from: tracks, rooms, tags, formats, levels, languages, statuses. Writes are in the two tags below.",
  },
  {
    name: "Field Writes",
    description:
      "Define custom fields. In this product a custom field IS a CFP form question, so changes show up in the form builder and on the public form. Requires `write:fields`.",
  },
  {
    name: "Metadata Writes",
    description:
      "Create, rename, delete and restore tracks, rooms, value lists and session statuses. Requires `write:metadata`.",
  },
  {
    name: "Webhooks",
    description:
      "Signed, retried HTTP callbacks so you never have to poll. Requires `write:events` to manage.",
  },
  { name: "Calendar", description: "The public .ics subscription feed." },
]

const WEBHOOK_EVENT_TABLE = [
  ["submission.created", "A CFP submission arrived."],
  ["submission.updated", "A submission's details or status changed."],
  ["session.created", "A programme session was created."],
  ["session.updated", "A session's details changed."],
  ["session.deleted", "A session was soft-deleted."],
  ["session.restored", "A soft-deleted session was restored."],
  ["session.scheduled", "A session was given a room and a slot."],
  ["session.unscheduled", "A session was taken off the timetable."],
  ["decision.committed", "An accept or decline queue was committed and the emails went out."],
  ["agenda.published", "The public programme went live."],
  ["speaker.created", "Someone was added to the roster."],
  ["speaker.updated", "A speaker's profile or workflow status changed."],
  ["file.uploaded", "A file was attached to a session."],
  ["file.deleted", "A session file was removed."],
  ["webhook.test", "A test delivery you triggered yourself."],
]

/**
 * Reference readers render a path's operations in key order, so the keys are
 * written in CRUD order rather than the alphabetical order an object literal
 * would otherwise fall into (delete, get, put). "Get an event" belongs above
 * "Delete an event", always.
 */
const METHOD_ORDER = ["get", "post", "put", "delete"]

function buildSpec(routes, examples, siteUrl) {
  const paths = {}
  for (const route of routes) {
    paths[route.path] ??= {}
    paths[route.path][route.method.toLowerCase()] = buildOperation(route, examples)
  }
  for (const [path, item] of Object.entries(paths)) {
    const ordered = {}
    for (const method of METHOD_ORDER) if (item[method]) ordered[method] = item[method]
    for (const [method, operation] of Object.entries(item))
      if (!ordered[method]) ordered[method] = operation
    paths[path] = ordered
  }

  const eventRows = WEBHOOK_EVENT_TABLE.map(([name, desc]) => `| \`${name}\` | ${desc} |`).join("\n")

  return {
    openapi: "3.1.0",
    info: {
      title: "Trackstage API",
      version: "1.1.0",
      summary:
        "Read and write your event's programme, speakers, submissions, custom fields and agenda — and get webhooks when any of it changes.",
      description: [
        "A complete REST API over an event: the event itself, sessions and abstracts, speakers and line-ups, CFP forms, custom fields, session files, speaker tasks, multi-round evaluation, the agenda, and signed outbound webhooks.",
        "",
        "Everything an organizer can do in the browser app, an integration can do here — and every response carries both this API's original field names and the names a Sessionboard client expects, so a migration is a base-URL change.",
        "",
        "---",
        "",
        "## Getting started",
        "",
        "### 1. Base URL",
        "",
        `Every path below is relative to your deployment's Convex site URL — the one server, no regions to choose between:`,
        "",
        "```",
        `${siteUrl ?? "https://your-deployment.convex.site"}`,
        "```",
        "",
        "### 2. Get a key",
        "",
        "**Account settings → API & MCP → Create key.** The key (`sb_live_…`) is shown **once**, at creation — copy it then. Keys are revocable from that same screen, and a revoked key stops working immediately. Optionally pick a scope set when you create it (see below); a key created without one is unrestricted within its owner's own permissions.",
        "",
        "### 3. Make a call",
        "",
        "```bash",
        `curl -s "${siteUrl ?? "https://your-deployment.convex.site"}/v1/events" \\`,
        '  -H "Authorization: Bearer sb_live_…"',
        "```",
        "",
        "Or, byte-for-byte compatible with a Sessionboard client:",
        "",
        "```bash",
        `curl -s "${siteUrl ?? "https://your-deployment.convex.site"}/v1/event/ai-summit-2026/sessions" \\`,
        '  -H "x-access-token: sb_live_…"',
        "```",
        "",
        "Prefer to look before you sign up? The token `demo-api-token` reads the demo events and answers **403** on every write.",
        "",
        "---",
        "",
        "## Authentication",
        "",
        "Two header forms are accepted, interchangeably, on every authenticated endpoint:",
        "",
        "| Header | Form | Notes |",
        "| --- | --- | --- |",
        "| `Authorization` | `Bearer sb_live_…` | The scheme this API has always used. |",
        "| `x-access-token` | `sb_live_…` | Sessionboard's header, so their clients work unchanged. |",
        "",
        "A key resolves to a **user**, and every request re-runs the same workspace-membership authorization the browser app runs — including per-member event scoping. A key can therefore never reach an event its owner cannot, and a leaked key is bounded by a real permission model rather than by an organization boundary.",
        "",
        "**Roles.** Some operations need more than membership: publishing or unpublishing the agenda, deleting or restoring a session, deleting an event, a form or a task, and every webhook write require the **admin** role on the event. A member without it gets a 403 that says so.",
        "",
        "### Scopes",
        "",
        "A key may declare a scope set. Unset means *unrestricted within the owner's permissions*; setting scopes can only ever **narrow** that, never widen it. Each operation below names the scope it enforces, both in prose and as an `x-required-scope` extension.",
        "",
        "| Scope | Grants |",
        "| --- | --- |",
        "| `read:events` | Events, agenda, settings, forms, tasks, webhooks. |",
        "| `read:sessions` | Sessions, abstracts, submissions, session files, evaluation. |",
        "| `read:contacts` | Speakers, session line-ups, evaluators. |",
        "| `write:sessions` | Session create/update/delete/restore/bulk, files, participants, evaluation plans. |",
        "| `write:contacts` | Speaker create/update/delete, evaluator management. |",
        "| `write:fields` | Custom-field definitions and CFP forms. |",
        "| `write:metadata` | Tracks, rooms, tags, formats, levels, languages, statuses. |",
        "| `write:events` | Event CRUD, agenda publish/unpublish, tasks, webhooks. |",
        "",
        "A 403 always names the missing scope, e.g. `This token lacks the \\`write:sessions\\` scope.`",
        "",
        "### Endpoints that need no credential",
        "",
        "- `GET /v1/event/{eventRef}/schedule.ics` — calendar clients subscribe by URL and cannot send headers.",
        "- `POST /v1/_echo` — the signature-verifying test sink.",
        "",
        "### AI agents: MCP and OAuth",
        "",
        "This is the REST surface. Agents have a second, separate one: a full **MCP server at `/mcp`**, authenticated with **OAuth 2.1 + PKCE** (discovery at `/.well-known/oauth-protected-resource`) rather than with an API key — connect it from Claude, Cursor or any MCP client and the same authorization rules apply. An `sb_live_…` key also works there as a bearer token for non-interactive clients. See [the MCP reference](/docs/mcp).",
        "",
        "---",
        "",
        "## Conventions",
        "",
        "### Addressing an event",
        "",
        "`{eventRef}` accepts the event's **slug** or its **id**, everywhere. `/v1/event/ai-summit-2026/sessions` and `/v1/event/k97abc…/sessions` are the same endpoint — the slug form is the one you want in a shell history. Forms take their slug too (`/forms/cfp`).",
        "",
        "### Pagination",
        "",
        "Every list takes `page` (1-based) and `pageSize` (default 25, max 100; `page_size` is accepted as an alias). Every paginated response carries the same array under **both** `data` and `results`, and pagination counts in **both** spellings:",
        "",
        "```json",
        "{",
        '  "data": [ … ],',
        '  "results": [ … ],',
        '  "pagination": {',
        '    "currentPage": 1, "pageSize": 25, "totalPages": 4, "totalResults": 87,',
        '    "current_page": 1, "page_size": 25, "total_pages": 4, "total_results": 87',
        "  }",
        "}",
        "```",
        "",
        "So a client written against either convention works, and no endpoint makes you check which one you are on. Single-resource responses are `{ \"data\": { … } }`.",
        "",
        "### Errors",
        "",
        "Every failure has the same shape:",
        "",
        "```json",
        "{",
        '  "error": "This session changed since you fetched it (now 2026-08-11T09:12:44.001Z). Re-fetch and retry.",',
        '  "code": "ConflictError",',
        '  "message": "This session changed since you fetched it (now 2026-08-11T09:12:44.001Z). Re-fetch and retry.",',
        '  "status": 409',
        "}",
        "```",
        "",
        "`error` and `message` are the same organizer-readable sentence — `error` is where this API has always put it, `message` is where Sessionboard clients look. `code` is the machine-readable name:",
        "",
        "| Status | `code` | When |",
        "| --- | --- | --- |",
        "| 400 | `BadRequestError` | The body or parameters are invalid; the message says what. |",
        "| 401 | `UnauthorizedError` | Missing or invalid key. |",
        "| 403 | `ForbiddenError` | Valid key, but missing scope, role, or workspace access — including the read-only demo token attempting a write. |",
        "| 404 | `NotFoundError` | No such event, resource or endpoint. A mistyped path answers with the nearest real routes. |",
        "| 405 | `MethodNotAllowedError` | Right path, wrong verb. |",
        "| 409 | `ConflictError` | Stale `updated_at` — someone else edited first. |",
        "| 413 | `PayloadTooLargeError` | Over the 50 MB simple-upload ceiling. |",
        "| 429 | `TooManyRequestsError` | Rate limited; wait `Retry-After` seconds. |",
        "| 500 | `InternalServerError` | Ours, not yours. |",
        "",
        "Messages are written for the person reading them, never stack traces.",
        "",
        "### Rate limits",
        "",
        "100 requests / 15 minutes **per key, per bucket**. The buckets are `entity_reads`, `session_writes`, `field_writes`, `metadata_writes` and `event_writes`, so a bulk import cannot starve your dashboard's reads. Each operation names its bucket below (and carries it as `x-rate-limit-bucket`).",
        "",
        "| Header | Meaning |",
        "| --- | --- |",
        "| `RateLimit-Limit` | Requests allowed in the window. |",
        "| `RateLimit-Remaining` | Requests left. |",
        "| `RateLimit-Reset` | Unix seconds at which the window resets. |",
        "| `Retry-After` | On a 429 only: seconds to wait. |",
        "",
        "### Times",
        "",
        "ISO-8601 in responses. Requests accept ISO-8601 **or** epoch milliseconds, anywhere a time is taken. Legacy epoch-millisecond fields (`startTime`, `endTime`, `submittedAt`, `decidedAt`, …) are still returned alongside the ISO ones and will not be removed.",
        "",
        "### Optimistic concurrency",
        "",
        "Send the `updated_at` you last read on `PUT /sessions/{id}`. If someone edited the session in between, the call answers **409** with the current value instead of silently clobbering their work; re-read and retry.",
        "",
        "### `expand`",
        "",
        "Comma-separated on session reads: `expand=files` inlines the session's attachments, `expand=deleted` lets a soft-deleted session be read.",
        "",
        "### Soft deletes",
        "",
        "`DELETE /sessions/{id}` and `DELETE /statuses/{id}` archive rather than destroy — the row leaves every listing, reads 404, and comes back intact via the matching `/restore`. `DELETE /events/{ref}` is the one exception: it runs the full cascade and is not recoverable.",
        "",
        "---",
        "",
        "### Custom fields",
        "",
        "A custom field and a CFP form question are the same object. `GET /v1/event/{eventRef}/fields` returns the definitions (with `internal_name`, type, options and whether the field holds PII); every session carries its answers as `custom_fields[]` (labelled, with a lossless `value_raw`) and as a raw `answers` map; `PUT /v1/event/{eventRef}/sessions/{sessionId}/fields` writes them. Creating a field through `POST /fields/create` adds the question to the form builder and to the public submission form.",
        "",
        "### Webhooks",
        "",
        "Register an endpoint with `POST /v1/webhooks`. Every delivery POSTs `{ data, metadata }` and carries:",
        "",
        "| Header | Meaning |",
        "| --- | --- |",
        "| `Trackstage-Signature` | `t=<unix-seconds>,v1=<hex>` — HMAC-SHA256 of `\"{t}.{body}\"` keyed with the endpoint's `whsec_…` secret. |",
        "| `Trackstage-Event` | The event type. |",
        "| `Trackstage-Delivery` | Unique delivery id, for idempotency. |",
        "",
        "Verify the signature before trusting a payload, and reject timestamps outside your tolerance to prevent replay. Failed deliveries retry five times with exponential backoff (1s, 5s, 25s, 125s) and the full attempt log — including the exact signed body — is readable at `GET /v1/webhooks/{webhookId}/deliveries`.",
        "",
        "**Verifying a delivery** (Node, no dependencies):",
        "",
        "```js",
        "import { createHmac, timingSafeEqual } from \"node:crypto\"",
        "",
        "export function verify(rawBody, header, secret, toleranceSeconds = 300) {",
        "  const m = /t=(\\d+),v1=([0-9a-f]+)/.exec(header ?? \"\")",
        "  if (!m) return false",
        "  const [, t, signature] = m",
        "  if (Math.abs(Date.now() / 1000 - Number(t)) > toleranceSeconds) return false // replay",
        "  const expected = createHmac(\"sha256\", secret).update(`${t}.${rawBody}`).digest(\"hex\")",
        "  const a = Buffer.from(expected), b = Buffer.from(signature)",
        "  return a.length === b.length && timingSafeEqual(a, b)",
        "}",
        "```",
        "",
        "Sign over the **raw body bytes**, before any JSON parsing — re-serialising changes the bytes and the signature will not match.",
        "",
        "Not sure your receiver is right? Point a webhook at `POST /v1/_echo?secret=whsec_…`. That sink recomputes the HMAC itself and answers 200 **only** when the signature verifies, so a green delivery in the log is proof, not a guess.",
        "",
        "**Event types**",
        "",
        "| Event | Fires when |",
        "| --- | --- |",
        eventRows,
        "",
        "Subscribe to `[\"*\"]` for all of them. Scope an endpoint to one event with `\"event\": \"ai-summit-2026\"`, or omit it for every event in the workspace.",
        "",
        "---",
        "",
        "### Uploading session files",
        "",
        "Two flows, same resource. Use the simple one until you hit its ceiling.",
        "",
        "**Simple — one request, up to 50 MB.** `multipart/form-data`, field name `file`:",
        "",
        "```bash",
        "curl -X POST \"$BASE/v1/event/ai-summit-2026/sessions/$SID/files/upload\" \\",
        "  -H \"Authorization: Bearer sb_live_…\" \\",
        "  -F \"file=@keynote-slides.pptx\" \\",
        "  -F \"title=Keynote deck (final)\"",
        "```",
        "",
        "Size and MIME type are read from the bytes. Over 50 MB answers **413** and tells you to use the two-phase flow.",
        "",
        "**Two-phase — for anything larger.** Three calls:",
        "",
        "1. `POST …/sessions/{sessionId}/files` with `{ \"filename\": \"…\" }` → returns an id and an `upload` block (`url`, `method`, `headers`).",
        "2. `PUT` the raw bytes to that `upload.url`. Unlike a presigned S3 URL this leg is authenticated with **your ordinary API key**, so no credential is ever embedded in a URL that can leak through logs or referrers. Re-PUTting replaces the pending bytes.",
        "3. `POST …/files/{fileId}/complete` → promotes the blob into a real attachment and returns it. Completing with no bytes received answers 400.",
        "",
        "**Replacing a file** is the same three steps starting from `POST …/files/{fileId}/replace`; the file group's version is bumped and the previous version retired when the replacement completes. `PUT …/files/{fileId}` changes the title or the participant it is assigned to without touching bytes, and `DELETE` soft-deletes.",
        "",
        "---",
        "",
        "### The calendar feed",
        "",
        "`GET /v1/event/{eventRef}/schedule.ics` is an RFC 5545 feed of the published programme — accepted, scheduled sessions of an event whose agenda has been published. It takes **no credential**, because calendar clients subscribe by URL and cannot send headers; paste it into Google Calendar, Apple Calendar or Outlook as a subscription and it stays in step with the board.",
        "",
        "---",
        "",
        "### Migrating from Sessionboard",
        "",
        "Change the base URL and the event id, and keep your code. Their paths, their `x-access-token` header, their `filters`/`sort`/`expand` search bodies, their `results` + `pagination` envelope, their status enum, their `custom_fields[]` shape and their 4xx codes are all served as-is. What is additive on our side: `data` alongside `results`, snake_case *and* camelCase pagination, `value_raw` on every custom field, slugs as event references, and the endpoints their API does not have at all — event CRUD, forms, tasks, evaluation, participants and API-managed webhooks.",
      ].join("\n"),
      license: { name: "MIT", identifier: "MIT" },
      contact: {
        name: "Trackstage",
        url: "https://github.com/markokraemer/trackstage",
      },
    },
    servers: [
      {
        url: siteUrl ?? "https://neat-sparrow-926.convex.site",
        description: "Your deployment's Convex site URL.",
      },
    ],
    security: [{ ApiKeyHeader: [] }, { BearerToken: [] }],
    tags: TAGS,
    paths,
    webhooks: {
      delivery: {
        post: {
          operationId: "webhookDelivery",
          tags: ["Webhooks"],
          summary: "Webhook delivery (sent BY Trackstage to your endpoint)",
          description:
            "The request your registered endpoint receives. Respond 2xx to acknowledge; anything else is retried with exponential backoff.",
          parameters: [
            {
              name: "Trackstage-Signature",
              in: "header",
              required: true,
              schema: { type: "string" },
              description: "`t=<unix-seconds>,v1=<hex>` — HMAC-SHA256 over `\"{t}.{body}\"`.",
            },
            {
              name: "Trackstage-Event",
              in: "header",
              required: true,
              schema: { type: "string" },
              description: "The event type, e.g. `session.updated`.",
            },
            {
              name: "Trackstage-Delivery",
              in: "header",
              required: true,
              schema: { type: "string" },
              description: "Unique delivery id — use it for idempotency.",
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/WebhookPayload" },
                ...(examples["WEBHOOK_PAYLOAD"]
                  ? { example: examples["WEBHOOK_PAYLOAD"] }
                  : {}),
              },
            },
          },
          responses: {
            200: { description: "Acknowledged. Any 2xx works." },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "x-access-token",
          description: [
            "A personal API key (`sb_live_…`), sent in Sessionboard's header so their clients work against this API unchanged.",
            "",
            "**Where to get one:** Account settings → **API & MCP** → *Create key*. The key is shown once, at creation — copy it then; it is stored only as a hash and cannot be shown again. Keys are revocable from the same screen and stop working immediately.",
            "",
            "**What it can reach:** the key resolves to a user, and every request re-runs the same workspace-membership and per-member event scoping the browser app runs. It can never reach an event its owner cannot.",
            "",
            "**Scopes:** optional. Unset means unrestricted within the owner's permissions; setting them can only narrow. Each operation names the scope it enforces (`x-required-scope`).",
            "",
            "**Exploring without an account:** `demo-api-token` reads the demo events and answers 403 on every write.",
          ].join("\n"),
        },
        BearerToken: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "sb_live_…",
          description: [
            "The same personal API key, sent as `Authorization: Bearer sb_live_…`. Interchangeable with `x-access-token` on every endpoint — pick whichever your HTTP client makes easier.",
            "",
            "AI agents have a separate door: the MCP server at `/mcp` speaks OAuth 2.1 + PKCE (discovery at `/.well-known/oauth-protected-resource`), and also accepts an `sb_live_…` key as a bearer token for non-interactive clients. See [the MCP reference](/docs/mcp).",
          ].join("\n"),
        },
      },
      parameters: PARAMETERS,
      headers: {
        ...RATE_LIMIT_HEADERS,
        "Retry-After": {
          schema: { type: "integer" },
          description: "Seconds to wait before retrying.",
        },
      },
      responses: Object.fromEntries(
        Object.entries(ERROR_DESCRIPTIONS).map(([status, description]) => [
          `E${status}`,
          {
            description,
            ...(status === "429"
              ? {
                  headers: {
                    ...RATE_LIMIT_HEADER_REFS,
                    "Retry-After": { $ref: "#/components/headers/Retry-After" },
                  },
                }
              : {}),
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Error" } },
            },
          },
        ]),
      ),
      schemas: { ...SCHEMAS, ...DERIVED },
    },
  }
}

// ——— Checks ——————————————————————————————————————————————————————————————

/**
 * Every manifest route must be reachable in the dispatcher. This is a source
 * check, so it runs in CI with no deployment: each route's distinguishing
 * literal (its resource segment, or its trailing action) has to appear.
 */
async function checkDispatcher(routes, settingsResources) {
  const source = await readFile(DISPATCHER, "utf8")
  const problems = []

  // The settings resources are routed generically off the manifest's own
  // lists, so their names never appear as literals in the dispatcher. What
  // must hold instead is that the dispatcher really imports those lists and
  // still has the generic branch that serves them.
  for (const marker of [
    "SETTINGS_READ_RESOURCES",
    "METADATA_WRITE_RESOURCES",
    "SETTINGS_RESOURCES.has(resource)",
    "METADATA_RESOURCES.has(normalized)",
  ]) {
    if (!source.includes(marker))
      problems.push(`convex/apiHttp.ts no longer contains \`${marker}\` — settings routes are unserved`)
  }

  const generic = new Set(settingsResources)
  for (const route of routes) {
    const literals = route.path
      .split("/")
      .filter((s) => s && !s.startsWith("{") && s !== "v1" && s !== "event")
      .filter((s) => !generic.has(s))
    const missing = literals.filter((literal) => !source.includes(`"${literal}"`))
    if (missing.length > 0) {
      problems.push(
        `${route.method} ${route.path} — convex/apiHttp.ts never mentions ${missing
          .map((m) => `"${m}"`)
          .join(", ")}`,
      )
    }
  }
  return problems
}

/** Reads the dev deployment URL the same way the backend suite does. */
async function readSiteUrl() {
  const env = await readFile(resolve(root, ".env.local"), "utf8").catch(() => "")
  const line = env.split("\n").find((l) => l.startsWith("VITE_CONVEX_SITE_URL"))
  return line ? line.slice(line.indexOf("=") + 1).trim() : null
}

/**
 * Probes every documented route against a live deployment. A route that is
 * genuinely served answers with its own status — including 400/404/409 for a
 * deliberately empty probe body. A route that does NOT exist answers the
 * dispatcher's "Unknown endpoint" 404 or a 405, which is what this fails on.
 */
async function probeLive(routes, siteUrl, token) {
  const problems = []
  const sample = {
    eventRef: "ai-summit-2026",
    sessionId: "probe-nonexistent",
    speakerId: "probe-nonexistent",
    fileId: "probe-nonexistent",
    fieldId: "probe-nonexistent",
    webhookId: "probe-nonexistent",
    id: "probe-nonexistent",
  }
  for (const route of routes) {
    // Never probe a destructive verb against a real id — the sample ids above
    // are deliberately non-existent, so writes cannot touch real data.
    let path = route.path
    for (const [key, value] of Object.entries(sample))
      path = path.replaceAll(`{${key}}`, value)
    const headers = { Authorization: `Bearer ${token}` }
    let body
    if (route.bodyKind === "json") {
      headers["Content-Type"] = "application/json"
      body = "{}"
    } else if (route.bodyKind === "binary") {
      body = new Uint8Array([0])
    }
    let res
    try {
      res = await fetch(`${siteUrl}${path}`, { method: route.method, headers, body })
    } catch (e) {
      problems.push(`${route.method} ${route.path} — request failed: ${e.message}`)
      continue
    }
    if (res.status === 405) {
      problems.push(`${route.method} ${route.path} — server answers 405 (method not served)`)
      continue
    }
    const text = await res.text()
    if (res.status === 404 && /Unknown (endpoint|resource|session endpoint|file endpoint|webhook endpoint)/.test(text)) {
      problems.push(`${route.method} ${route.path} — server does not route this path`)
    }
  }
  return problems
}

// ——— Live example capture ————————————————————————————————————————————————

/**
 * Real responses, captured from the dev deployment, embedded as the spec's
 * examples. Run without --check to refresh them. Anything that cannot be
 * captured is simply omitted rather than faked.
 */
async function captureExamples(siteUrl, token) {
  const examples = {}
  const get = async (path) => {
    const res = await fetch(`${siteUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const text = await res.text()
    try {
      return { status: res.status, json: JSON.parse(text) }
    } catch {
      return { status: res.status, text }
    }
  }
  /**
   * Keep examples readable AND the spec small — the reference page downloads
   * this file. One row shows the shape; nested collections are capped too, so
   * a session with thirty participants does not become the example.
   */
  const cap = (value, depth = 0) => {
    if (Array.isArray(value))
      return value.slice(0, depth === 0 ? 1 : 2).map((item) => cap(item, depth + 1))
    if (value && typeof value === "object") {
      const next = {}
      for (const [key, inner] of Object.entries(value)) next[key] = cap(inner, depth + 1)
      return next
    }
    if (typeof value === "string" && value.length > 400)
      return `${value.slice(0, 400)}…`
    return value
  }
  const trim = (payload, key = "data") => {
    if (!payload || typeof payload !== "object") return payload
    const next = { ...payload }
    if (Array.isArray(next[key])) next[key] = cap(next[key])
    if (Array.isArray(next.results)) next.results = cap(next.results)
    return next
  }

  const captures = [
    ["GET /v1/events 200", "/v1/events?pageSize=1", trim],
    ["GET /v1/event/{eventRef}/sessions 200", "/v1/event/ai-summit-2026/sessions?pageSize=1", trim],
    ["GET /v1/event/{eventRef}/submissions 200", "/v1/event/ai-summit-2026/submissions?pageSize=1", trim],
    ["GET /v1/event/{eventRef}/speakers 200", "/v1/event/ai-summit-2026/speakers?pageSize=1", trim],
    ["GET /v1/event/{eventRef}/fields 200", "/v1/event/ai-summit-2026/fields?pageSize=3", trim],
    ["GET /v1/event/{eventRef}/tracks 200", "/v1/event/ai-summit-2026/tracks", trim],
    ["GET /v1/event/{eventRef}/rooms 200", "/v1/event/ai-summit-2026/rooms", trim],
    ["GET /v1/event/{eventRef}/statuses 200", "/v1/event/ai-summit-2026/statuses", trim],
    ["GET /v1/event/{eventRef}/formats 200", "/v1/event/ai-summit-2026/formats", trim],
    ["GET /v1/event/{eventRef}/levels 200", "/v1/event/ai-summit-2026/levels", trim],
    ["GET /v1/event/{eventRef}/languages 200", "/v1/event/ai-summit-2026/languages", trim],
    ["GET /v1/event/{eventRef}/tags 200", "/v1/event/ai-summit-2026/tags", trim],
    ["GET /v1/event/{eventRef}/session-statuses 200", "/v1/event/ai-summit-2026/session-statuses", trim],
    ["GET /v1/event/{eventRef}/agenda 200", "/v1/event/ai-summit-2026/agenda", null],
    ["GET /v1/webhooks 200", "/v1/webhooks", trim],
    ["GET /v1/event/{eventRef}/schedule.ics 200", "/v1/event/ai-summit-2026/schedule.ics", null],
    ["GET /v1/events/{eventRef} 200", "/v1/events/ai-summit-2026", null],
    ["GET /v1/event/{eventRef}/forms 200", "/v1/event/ai-summit-2026/forms?pageSize=1", trim],
    ["GET /v1/event/{eventRef}/forms/{formId} 200", "/v1/event/ai-summit-2026/forms/cfp", null],
    ["GET /v1/event/{eventRef}/tasks 200", "/v1/event/ai-summit-2026/tasks?pageSize=1", trim],
    [
      "GET /v1/event/{eventRef}/evaluation-plans 200",
      "/v1/event/ai-summit-2026/evaluation-plans?pageSize=1",
      trim,
    ],
    ["GET /v1/event/{eventRef}/evaluators 200", "/v1/event/ai-summit-2026/evaluators?pageSize=1", trim],
    [
      "GET /v1/event/{eventRef}/evaluations 200",
      "/v1/event/ai-summit-2026/evaluations?pageSize=1",
      trim,
    ],
  ]

  for (const [key, path, shrink] of captures) {
    const result = await get(path)
    if (result.status !== 200) continue
    if (result.text !== undefined) {
      // The .ics feed: first few lines are plenty to show the shape.
      examples[key] = result.text.split("\r\n").slice(0, 12).join("\r\n") + "\r\n…"
      continue
    }
    // Agenda + session shapes get deep; cap the size so the reference stays
    // readable rather than becoming a data dump.
    const payload = cap(shrink ? shrink(result.json) : result.json)
    if (JSON.stringify(payload).length > 24000) continue
    examples[key] = payload
  }

  // A session detail example, taken from whatever the first session is.
  const sessions = await get("/v1/event/ai-summit-2026/sessions?pageSize=1")
  const first = sessions.json?.data?.[0]
  if (first?.id) {
    const detail = await get(`/v1/event/ai-summit-2026/sessions/${first.id}`)
    const capped = detail.status === 200 ? cap(detail.json, 1) : null
    if (capped && JSON.stringify(capped).length < 24000)
      examples["GET /v1/event/{eventRef}/sessions/{sessionId} 200"] = capped
  }

  // Detail + sub-resource reads need a real id, so they follow their list.
  const firstIdOf = (key, path) => {
    const rows = examples[key]
    void path
    const row = rows?.data?.[0] ?? rows?.results?.[0]
    return typeof row?.id === "string" ? row.id : null
  }
  const taskId = firstIdOf("GET /v1/event/{eventRef}/tasks 200")
  if (taskId) {
    const detail = await get(`/v1/event/ai-summit-2026/tasks/${taskId}`)
    if (detail.status === 200)
      examples["GET /v1/event/{eventRef}/tasks/{taskId} 200"] = cap(detail.json, 1)
  }
  const planId = firstIdOf("GET /v1/event/{eventRef}/evaluation-plans 200")
  if (planId) {
    const detail = await get(`/v1/event/ai-summit-2026/evaluation-plans/${planId}`)
    if (detail.status === 200 && JSON.stringify(detail.json).length < 24000)
      examples["GET /v1/event/{eventRef}/evaluation-plans/{planId} 200"] = cap(
        detail.json,
        1,
      )
  }
  if (first?.id) {
    const participants = await get(
      `/v1/event/ai-summit-2026/sessions/${first.id}/participants`,
    )
    if (participants.status === 200)
      examples["GET /v1/event/{eventRef}/sessions/{sessionId}/participants 200"] =
        cap(trim(participants.json))
  }

  // A real webhook payload, straight out of the delivery log if one exists.
  const hooks = await get("/v1/webhooks")
  const hookId = hooks.json?.data?.[0]?.id
  if (hookId) {
    const deliveries = await get(`/v1/webhooks/${hookId}/deliveries?limit=1`)
    const payload = deliveries.json?.data?.[0]?.payload
    if (payload) {
      try {
        examples["WEBHOOK_PAYLOAD"] = JSON.parse(payload)
      } catch {
        /* keep the spec's hand-written shape */
      }
    }
  }
  return examples
}

/**
 * Response examples for the WRITE operations, derived from the reads we just
 * captured. A create returns the same resource its list returns, so the
 * honest example is a real row wrapped in the single-resource envelope —
 * which is both accurate and impossible to let rot.
 */
const DERIVED_EXAMPLES = [
  // [target, source list, extra keys merged onto the envelope]
  ["POST /v1/event/{eventRef}/sessions/create 201", "GET /v1/event/{eventRef}/sessions 200"],
  ["PUT /v1/event/{eventRef}/sessions/{sessionId} 200", "GET /v1/event/{eventRef}/sessions 200"],
  [
    "POST /v1/event/{eventRef}/sessions/{sessionId}/restore 200",
    "GET /v1/event/{eventRef}/sessions 200",
  ],
  [
    "PUT /v1/event/{eventRef}/sessions/{sessionId}/fields 200",
    "GET /v1/event/{eventRef}/sessions 200",
  ],
  ["POST /v1/event/{eventRef}/speakers/create 201", "GET /v1/event/{eventRef}/speakers 200"],
  ["PUT /v1/event/{eventRef}/speakers/{speakerId} 200", "GET /v1/event/{eventRef}/speakers 200"],
  ["POST /v1/events 201", "GET /v1/events 200", { slug_adjusted: false }],
  ["PUT /v1/events/{eventRef} 200", "GET /v1/events 200", { slug_adjusted: false }],
  ["POST /v1/event/{eventRef}/agenda/publish 200", "GET /v1/events 200"],
  ["POST /v1/event/{eventRef}/agenda/unpublish 200", "GET /v1/events 200"],
  ["POST /v1/event/{eventRef}/forms/create 201", "GET /v1/event/{eventRef}/forms 200"],
  ["PUT /v1/event/{eventRef}/forms/{formId} 200", "GET /v1/event/{eventRef}/forms 200"],
  ["PUT /v1/event/{eventRef}/tasks/{taskId} 200", "GET /v1/event/{eventRef}/tasks 200"],
  [
    "POST /v1/event/{eventRef}/evaluation-plans/create 201",
    "GET /v1/event/{eventRef}/evaluation-plans 200",
  ],
  [
    "PUT /v1/event/{eventRef}/evaluation-plans/{planId} 200",
    "GET /v1/event/{eventRef}/evaluation-plans 200",
  ],
  ["POST /v1/event/{eventRef}/evaluators/create 201", "GET /v1/event/{eventRef}/evaluators 200"],
  ["PUT /v1/event/{eventRef}/evaluators/{evaluatorId} 200", "GET /v1/event/{eventRef}/evaluators 200"],
  ["POST /v1/event/{eventRef}/fields/create 201", "GET /v1/event/{eventRef}/fields 200"],
  ["PUT /v1/event/{eventRef}/fields/{fieldId} 200", "GET /v1/event/{eventRef}/fields 200"],
  ["POST /v1/event/{eventRef}/tracks/create 201", "GET /v1/event/{eventRef}/tracks 200"],
  ["PUT /v1/event/{eventRef}/tracks/{id} 200", "GET /v1/event/{eventRef}/tracks 200"],
  ["POST /v1/event/{eventRef}/rooms/create 201", "GET /v1/event/{eventRef}/rooms 200"],
  ["PUT /v1/event/{eventRef}/rooms/{id} 200", "GET /v1/event/{eventRef}/rooms 200"],
  ["POST /v1/event/{eventRef}/tags/create 201", "GET /v1/event/{eventRef}/tags 200"],
  ["PUT /v1/event/{eventRef}/tags/{id} 200", "GET /v1/event/{eventRef}/tags 200"],
  ["POST /v1/event/{eventRef}/formats/create 201", "GET /v1/event/{eventRef}/formats 200"],
  ["PUT /v1/event/{eventRef}/formats/{id} 200", "GET /v1/event/{eventRef}/formats 200"],
  ["POST /v1/event/{eventRef}/levels/create 201", "GET /v1/event/{eventRef}/levels 200"],
  ["PUT /v1/event/{eventRef}/levels/{id} 200", "GET /v1/event/{eventRef}/levels 200"],
  ["POST /v1/event/{eventRef}/languages/create 201", "GET /v1/event/{eventRef}/languages 200"],
  ["PUT /v1/event/{eventRef}/languages/{id} 200", "GET /v1/event/{eventRef}/languages 200"],
  ["POST /v1/event/{eventRef}/statuses/create 201", "GET /v1/event/{eventRef}/statuses 200"],
  ["PUT /v1/event/{eventRef}/statuses/{id} 200", "GET /v1/event/{eventRef}/statuses 200"],
  [
    "POST /v1/event/{eventRef}/statuses/{id}/restore 200",
    "GET /v1/event/{eventRef}/statuses 200",
  ],
  [
    "POST /v1/event/{eventRef}/sessions/{sessionId}/participants 201",
    "GET /v1/event/{eventRef}/sessions/{sessionId}/participants 200",
  ],
  ["GET /v1/event/{eventRef}/speakers/{speakerId} 200", "GET /v1/event/{eventRef}/speakers 200"],
  // The POST search forms return exactly what their GET list returns, so they
  // copy the whole captured page rather than one row.
  ["POST /v1/event/{eventRef}/sessions 200", "GET /v1/event/{eventRef}/sessions 200", "page"],
  ["POST /v1/event/{eventRef}/speakers 200", "GET /v1/event/{eventRef}/speakers 200", "page"],
  ["POST /v1/event/{eventRef}/fields 200", "GET /v1/event/{eventRef}/fields 200", "page"],
  ["POST /v1/event/{eventRef}/tags 200", "GET /v1/event/{eventRef}/tags 200", "page"],
  ["POST /v1/event/{eventRef}/tracks 200", "GET /v1/event/{eventRef}/tracks 200", "page"],
  ["POST /v1/event/{eventRef}/rooms 200", "GET /v1/event/{eventRef}/rooms 200", "page"],
  ["POST /v1/event/{eventRef}/formats 200", "GET /v1/event/{eventRef}/formats 200", "page"],
  ["POST /v1/event/{eventRef}/levels 200", "GET /v1/event/{eventRef}/levels 200", "page"],
  ["POST /v1/event/{eventRef}/languages 200", "GET /v1/event/{eventRef}/languages 200", "page"],
  ["POST /v1/event/{eventRef}/statuses 200", "GET /v1/event/{eventRef}/statuses 200", "page"],
  [
    "POST /v1/event/{eventRef}/session-statuses 200",
    "GET /v1/event/{eventRef}/session-statuses 200",
    "page",
  ],
]

const SESSION_FILE_EXAMPLE = {
  id: "k67abc…",
  url: "https://your-deployment.convex.site/api/storage/9f2c…",
  title: "Keynote deck",
  filename: "keynote-slides.pptx",
  size: 18432000,
  mimetype:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  version: 2,
  approval_status: "approved",
  review_note: null,
  session_id: "k17abc…",
  assigned_participant_id: "k57abc…",
  assigned_participant_email: "grace@example.com",
  assigned_participant_name: "Grace Hopper",
  created_at: "2026-08-09T14:22:07.311Z",
  updated_at: "2026-08-09T14:22:07.311Z",
}

const WEBHOOK_EXAMPLE = {
  id: "k77abc…",
  url: "https://hooks.example.com/trackstage",
  events: ["session.created", "session.updated", "decision.committed"],
  description: "Programme mirror",
  enabled: true,
  event_id: "k97abc…",
  secret_masked: "whsec_9c1f4…0513",
  created_at: "2026-07-28T08:15:00.000Z",
  updated_at: "2026-08-11T09:12:44.001Z",
  last_delivery_at: "2026-08-11T09:12:45.220Z",
  last_status: 200,
}

const WEBHOOK_DELIVERY_EXAMPLE = {
  id: "k87abc…",
  webhook_id: "k77abc…",
  event: "session.updated",
  status: "succeeded",
  attempts: 1,
  response_status: 200,
  error: null,
  payload:
    '{"data":{"id":"k17abc…","title":"Designing agent workflows","sourceOfChange":"api"},"metadata":{"action":"session.updated","event_id":"k97abc…","version":"1"}}',
  created_at: "2026-08-11T09:12:45.001Z",
  delivered_at: "2026-08-11T09:12:45.220Z",
}

/** Examples we can write exactly, because their shape is fixed. */
const STATIC_EXAMPLES = {
  "POST /v1/event/{eventRef}/tasks/create 201": {
    data: {
      id: "k47abc…",
      title: "Upload your slides",
      instructions: "16:9, PDF or PPTX, under 50 MB please.",
      kind: "upload",
      due_at: "2026-09-01T17:00:00.000Z",
      completed_at: null,
      is_complete: false,
      is_overdue: false,
      speaker_id: "k57abc…",
      speaker: { id: "k57abc…", full_name: "Grace Hopper", email: "grace@example.com" },
      session_id: null,
      session_title: null,
      form_id: null,
      created_at: "2026-08-11T09:12:44.001Z",
    },
    results: [{ id: "k47abc…", title: "Upload your slides", speaker_id: "k57abc…" }],
    created: 2,
  },
  "POST /v1/event/{eventRef}/sessions/bulk 200": {
    batch_id: "batch_9f2c…",
    results: [
      { index: 0, action: "create", status: "created", id: "k17ghi…" },
      { index: 1, action: "update", status: "updated", id: "k17abc…" },
      {
        index: 2,
        action: "delete",
        status: "failed",
        error: { code: "NotFoundError", message: "Session not found." },
      },
    ],
    stats: { total: 3, succeeded: 2, failed: 1 },
  },
  "POST /v1/event/{eventRef}/sessions/{sessionId}/files 201": {
    data: {
      id: "k67abc…",
      filename: "keynote-slides.pptx",
      title: "Keynote deck (final)",
      upload: {
        url: "https://your-deployment.convex.site/v1/event/ai-summit-2026/sessions/k17abc…/files/k67abc…/bytes",
        method: "PUT",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          Authorization: "Bearer <your API key>",
        },
      },
    },
  },
  "PUT /v1/event/{eventRef}/sessions/{sessionId}/files/{fileId}/bytes 200": {
    data: { id: "k67abc…", size: 184320000, received: true },
  },
  "POST /v1/_echo 200": {
    received: true,
    verified: true,
    event: "session.updated",
    delivery: "k87abc…",
  },
  "POST /v1/event/{eventRef}/sessions/status 200": {
    data: [
      {
        id: "k17abc…",
        friendly_id: "SESS-73041",
        friendly_id_raw: 73041,
        status: "accepted",
        is_abstract: false,
        deleted_at: null,
        created_at: "2026-06-02T11:03:12.884Z",
        updated_at: "2026-08-11T09:12:44.001Z",
        subsessions: [],
      },
    ],
    results: [
      {
        id: "k17abc…",
        friendly_id: "SESS-73041",
        friendly_id_raw: 73041,
        status: "accepted",
        is_abstract: false,
        deleted_at: null,
        created_at: "2026-06-02T11:03:12.884Z",
        updated_at: "2026-08-11T09:12:44.001Z",
        subsessions: [],
      },
    ],
    pagination: {
      currentPage: 1,
      pageSize: 25,
      totalPages: 1,
      totalResults: 1,
      current_page: 1,
      page_size: 25,
      total_pages: 1,
      total_results: 1,
    },
  },
  // Session files. The demo token cannot write, so these are written out
  // rather than captured — the shapes are `SessionFile` verbatim.
  "GET /v1/event/{eventRef}/sessions/{sessionId}/files 200": {
    data: [SESSION_FILE_EXAMPLE],
  },
  "POST /v1/event/{eventRef}/sessions/{sessionId}/files/upload 201": {
    data: SESSION_FILE_EXAMPLE,
  },
  "POST /v1/event/{eventRef}/sessions/{sessionId}/files/{fileId}/complete 201": {
    data: SESSION_FILE_EXAMPLE,
  },
  "PUT /v1/event/{eventRef}/sessions/{sessionId}/files/{fileId} 200": {
    data: { ...SESSION_FILE_EXAMPLE, title: "Keynote deck (final)" },
  },
  "POST /v1/event/{eventRef}/sessions/{sessionId}/files/{fileId}/replace 201": {
    data: {
      id: "k67def…",
      replaces: "k67abc…",
      upload: {
        url: "https://your-deployment.convex.site/v1/event/ai-summit-2026/sessions/k17abc…/files/k67def…/bytes",
        method: "PUT",
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
      },
    },
  },
  // Webhooks. Not capturable either: they belong to a workspace, and the
  // read-only demo token the generator authenticates with has none.
  "GET /v1/webhooks 200": { data: [WEBHOOK_EXAMPLE], results: [WEBHOOK_EXAMPLE] },
  "POST /v1/webhooks 201": {
    data: {
      ...WEBHOOK_EXAMPLE,
      secret: "whsec_9c1f4a7e2b8d0356f1a9c4e7b2d80513",
      secret_masked: "whsec_9c1f4…0513",
    },
  },
  "GET /v1/webhooks/{webhookId} 200": {
    data: { ...WEBHOOK_EXAMPLE, deliveries: [WEBHOOK_DELIVERY_EXAMPLE] },
  },
  "PUT /v1/webhooks/{webhookId} 200": { data: WEBHOOK_EXAMPLE },
  "POST /v1/webhooks/{webhookId}/test 200": {
    data: { delivery_id: "k87abc…", status: "queued" },
  },
  "POST /v1/webhooks/{webhookId}/rotate 200": {
    data: {
      ...WEBHOOK_EXAMPLE,
      secret: "whsec_4e7b2d805139c1f4a7e2b8d0356f1a9c",
      secret_masked: "whsec_4e7b2…1a9c",
    },
  },
  "GET /v1/webhooks/{webhookId}/deliveries 200": {
    data: [WEBHOOK_DELIVERY_EXAMPLE],
    results: [WEBHOOK_DELIVERY_EXAMPLE],
  },
}

/**
 * Pulls every example back out of a previously generated spec, so a run
 * without a deployment keeps the real ones instead of publishing a bare
 * reference. The inverse of what buildSpec does with them.
 */
function harvestExamples(spec) {
  const examples = {}
  for (const [path, item] of Object.entries(spec.paths ?? {}))
    for (const [method, operation] of Object.entries(item))
      for (const [status, response] of Object.entries(operation.responses ?? {}))
        for (const media of Object.values(response.content ?? {}))
          if (media.example !== undefined)
            examples[`${method.toUpperCase()} ${path} ${status}`] = media.example
  const payload =
    spec.webhooks?.delivery?.post?.requestBody?.content?.["application/json"]?.example
  if (payload !== undefined) examples["WEBHOOK_PAYLOAD"] = payload
  return examples
}

function deriveWriteExamples(examples) {
  for (const [target, source, extra] of DERIVED_EXAMPLES) {
    if (examples[target]) continue
    const page = examples[source]
    if (!page) continue
    if (extra === "page") {
      examples[target] = page
      continue
    }
    const row = page?.data?.[0] ?? page?.results?.[0] ?? page?.data ?? null
    if (!row || typeof row !== "object" || Array.isArray(row)) continue
    examples[target] = { data: row, ...(extra ?? {}) }
  }
  for (const [key, value] of Object.entries(STATIC_EXAMPLES))
    if (!examples[key]) examples[key] = value
  return examples
}

// ——— Entry point —————————————————————————————————————————————————————————

async function main() {
  const check = process.argv.includes("--check")
  const live = process.argv.includes("--live")
  const { routes, settingsResources } = await loadRoutes()

  // Duplicate operationIds silently break generated clients, so they are a
  // hard error rather than something to notice in review.
  const seen = new Map()
  for (const route of routes) {
    const previous = seen.get(route.operationId)
    if (previous) {
      console.error(
        `Duplicate operationId "${route.operationId}": ${previous} and ${route.method} ${route.path}`,
      )
      process.exit(1)
    }
    seen.set(route.operationId, `${route.method} ${route.path}`)
  }

  const dispatcherProblems = await checkDispatcher(routes, settingsResources)
  if (dispatcherProblems.length > 0) {
    console.error("Route manifest and dispatcher disagree:")
    for (const problem of dispatcherProblems) console.error(`  · ${problem}`)
    process.exit(1)
  }

  const siteUrl = await readSiteUrl()
  const token = process.env.PUBLIC_API_TOKEN ?? "demo-api-token"

  if (live) {
    if (!siteUrl) {
      console.error("--live needs VITE_CONVEX_SITE_URL in .env.local")
      process.exit(1)
    }
    const liveProblems = await probeLive(routes, siteUrl, token)
    if (liveProblems.length > 0) {
      console.error("Documented routes the live deployment does not serve:")
      for (const problem of liveProblems) console.error(`  · ${problem}`)
      process.exit(1)
    }
    console.log(`· ${routes.length} routes verified against ${siteUrl}`)
  }

  const current = await readFile(OUT, "utf8").catch(() => "")

  if (check) {
    let existing
    try {
      existing = JSON.parse(current)
    } catch {
      console.error("public/docs/api/openapi.json is missing or unparseable — run `node scripts/generate-openapi.mjs`.")
      process.exit(1)
    }
    // Compare the route surface, not the examples: examples are captured from
    // live data and legitimately change between runs.
    const documented = new Set()
    for (const [path, item] of Object.entries(existing.paths ?? {}))
      for (const method of Object.keys(item)) documented.add(`${method.toUpperCase()} ${path}`)
    const expected = new Set(routes.map((r) => `${r.method} ${r.path}`))

    const missing = [...expected].filter((r) => !documented.has(r))
    const extra = [...documented].filter((r) => !expected.has(r))
    if (missing.length > 0 || extra.length > 0) {
      console.error("public/docs/api/openapi.json is out of date:")
      for (const route of missing) console.error(`  · MISSING  ${route}`)
      for (const route of extra) console.error(`  · ORPHANED ${route}`)
      console.error("Run `node scripts/generate-openapi.mjs`.")
      process.exit(1)
    }
    console.log(`· OpenAPI spec documents all ${expected.size} routes`)
    return
  }

  // Reuse the examples already in the file unless we can capture fresh ones,
  // so running without a deployment never strips the reference bare. They are
  // harvested back out of the spec rather than kept in a duplicate block —
  // the spec IS the store, which keeps the published file half the size.
  let examples = {}
  try {
    examples = harvestExamples(JSON.parse(current))
  } catch {
    /* first run */
  }
  if (siteUrl) {
    const captured = await captureExamples(siteUrl, token)
    // MERGE, never replace: a capture that came back short (a rate-limited
    // run, an endpoint with no rows yet) must not strip examples the file
    // already had. Fresh where we got it, kept everywhere else.
    examples = { ...examples, ...captured }
    console.log(
      `· captured ${Object.keys(captured).length} live examples (${Object.keys(examples).length} total)`,
    )
  }
  // Writes return what their reads return, so their examples come from the
  // captured rows rather than from a second, drifting set of fixtures.
  examples = deriveWriteExamples(examples)

  const spec = buildSpec(routes, examples, siteUrl)
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, `${JSON.stringify(spec, null, 2)}\n`)
  console.log(
    `· wrote ${OUT.replace(`${root}/`, "")} — ${routes.length} routes, ${
      Object.keys(spec.components.schemas).length
    } schemas`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
