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
    routes.push({
      method: "GET",
      path: `/v1/event/{eventRef}/${resource}`,
      operationId: `list${camel[0].toUpperCase()}${camel.slice(1)}`,
      tag: "Event Settings",
      summary: `List ${plural}`,
      description: isFields
        ? "Every field definition on the event — the CFP form's questions plus its participant fields. These are the `internal_name`s you write through `PUT /sessions/{id}/fields`."
        : `Every ${label} configured on the event.`,
      scope: "read:events",
      bucket: "entity_reads",
      requestBody: null,
      responses: [[200, isFields ? "FieldsPage" : "MetadataPage"]],
      errors: [429],
      query: ["page", "pageSize", "search"],
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
      responses: [[200, isFields ? "FieldsPage" : "MetadataPage"]],
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
    const systemOwned = resource === "statuses"
    const note = systemOwned
      ? " Session statuses are system-defined in this product, so this always answers 400 with an explanation — the pipeline (draft → pending → accept/decline queue → accepted/declined, plus withdrawn) is fixed."
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
        responses: systemOwned ? [] : [[201, "MetadataEnvelope"]],
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
        responses: systemOwned ? [] : [[200, "MetadataEnvelope"]],
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
              : `Removes the ${label}.${note}`,
        scope: "write:metadata",
        bucket: "metadata_writes",
        requestBody: null,
        responses: systemOwned ? [] : [[204, null]],
        errors: [400, 429],
        query: [],
        open: false,
        bodyKind: "none",
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
      agenda_published_at: ts("Set once the public programme is live."),
      created_at: ts("Creation time."),
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
      color: { type: "string", description: "Tracks only.", examples: ["#0F6E70"] },
      capacity: { type: "integer", description: "Rooms only." },
      order: { type: "integer" },
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
    description: "Filter by status. Passing this opts out of the accepted-only default.",
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
    description: "Include soft-deleted sessions.",
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

// ——— Spec assembly ————————————————————————————————————————————————————————

function buildOperation(route, examples) {
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
    if (route.scope) failures.add(403)
  }
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
    requestBody = {
      required: route.method !== "POST" || !route.path.endsWith("/sessions"),
      content: {
        "application/json": {
          schema: { $ref: `#/components/schemas/${route.requestBody}` },
        },
      },
    }
  }

  const notes = []
  if (route.scope)
    notes.push(
      `**Scope** \`${route.scope}\` — enforced only when the presenting key declares a scope set; an unscoped key acts with its owner's workspace permissions.`,
    )
  if (route.bucket)
    notes.push(`**Rate limit** 100 requests / 15 minutes in the \`${route.bucket}\` bucket.`)
  if (route.open) notes.push("**No credential required.**")

  return {
    operationId: route.operationId,
    tags: [route.tag],
    summary: route.summary,
    description: [route.description, ...notes].join("\n\n"),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
    ...(route.open ? { security: [] } : {}),
  }
}

const TAGS = [
  { name: "Events", description: "The events a credential can reach." },
  { name: "Sessions", description: "Read sessions, abstracts and submissions." },
  {
    name: "Session Writes",
    description:
      "Create, update, soft-delete, restore and bulk-edit sessions. Requires `write:sessions`.",
  },
  {
    name: "Session Files",
    description:
      "Attachments on a session — slides, handouts, anything a speaker uploads. Requires `write:sessions` to change.",
  },
  { name: "Speakers", description: "The event's people and their sessions." },
  {
    name: "Event Settings",
    description:
      "Field definitions and the value lists a session's metadata comes from: tracks, rooms, tags, formats, levels, languages, statuses.",
  },
  {
    name: "Field Writes",
    description:
      "Define custom fields. In this product a custom field IS a CFP form question, so changes show up in the form builder and on the public form. Requires `write:fields`.",
  },
  {
    name: "Metadata Writes",
    description: "Create, rename and delete tracks, rooms and value lists. Requires `write:metadata`.",
  },
  { name: "Agenda", description: "The timetable, its conflicts, and the publish gate." },
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

function buildSpec(routes, examples, siteUrl) {
  const paths = {}
  for (const route of routes) {
    paths[route.path] ??= {}
    paths[route.path][route.method.toLowerCase()] = buildOperation(route, examples)
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
        "A complete REST API over an event: sessions and abstracts, speakers, custom fields, session files, the agenda, and signed outbound webhooks.",
        "",
        "### Authentication",
        "",
        "Send a personal API key from **Settings → API & MCP** as either header — both are first-class:",
        "",
        "```",
        "x-access-token: sb_live_…",
        "Authorization: Bearer sb_live_…",
        "```",
        "",
        "A key resolves to a user, and every request re-runs the same workspace-membership authorization the app itself uses, so a key can never reach an event its owner cannot. Keys may optionally declare **scopes** (`read:events`, `read:sessions`, `read:contacts`, `write:sessions`, `write:contacts`, `write:fields`, `write:metadata`, `write:events`); a key without scopes is unrestricted within its owner's permissions, and declaring scopes can only narrow that.",
        "",
        "The demo token `demo-api-token` is read-only and exists so the API can be explored without signing up. `schedule.ics` needs no credential at all — calendar clients cannot send headers.",
        "",
        "### Conventions",
        "",
        "- **Events are addressed by slug or id.** `/v1/event/ai-summit-2026/sessions` and `/v1/event/{id}/sessions` are the same endpoint.",
        "- **Paginated responses carry `data` and `results`** — the same array under both names — plus a `pagination` object with camelCase *and* snake_case keys. Default page size 25, maximum 100.",
        "- **Times** are ISO-8601 in responses. Requests accept ISO-8601 or epoch milliseconds. Legacy epoch-millisecond fields (`startTime`, `submittedAt`, …) are still returned alongside.",
        "- **Errors** are `{ error, code, message, status }`; `error` and `message` are the same human sentence.",
        "- **Optimistic concurrency**: send the `updated_at` you last read on `PUT /sessions/{id}` and a concurrent edit answers `409` instead of silently winning.",
        "- **Rate limits** are 100 requests / 15 minutes per key per category, reported on every rate-limited response via `RateLimit-Limit`, `RateLimit-Remaining` and `RateLimit-Reset`.",
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
        "Verify the signature before trusting a payload, and reject timestamps outside your tolerance to prevent replay. Failed deliveries retry five times with exponential backoff (1s, 5s, 25s, 125s) and the full attempt log is readable at `GET /v1/webhooks/{webhookId}/deliveries`.",
        "",
        "**Event types**",
        "",
        "| Event | Fires when |",
        "| --- | --- |",
        eventRows,
        "",
        "Subscribe to `[\"*\"]` for all of them.",
        "",
        "### MCP",
        "",
        "Everything here is also available to AI agents over MCP at `/mcp` — see [the MCP reference](/docs/mcp).",
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
          description: "Personal API key from Settings → API & MCP.",
        },
        BearerToken: {
          type: "http",
          scheme: "bearer",
          description: "The same key, sent as `Authorization: Bearer sb_live_…`.",
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
    if (JSON.stringify(payload).length > 12000) continue
    examples[key] = payload
  }

  // A session detail example, taken from whatever the first session is.
  const sessions = await get("/v1/event/ai-summit-2026/sessions?pageSize=1")
  const first = sessions.json?.data?.[0]
  if (first?.id) {
    const detail = await get(`/v1/event/ai-summit-2026/sessions/${first.id}`)
    const capped = detail.status === 200 ? cap(detail.json, 1) : null
    if (capped && JSON.stringify(capped).length < 12000)
      examples["GET /v1/event/{eventRef}/sessions/{sessionId} 200"] = capped
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
  // so running without a deployment never strips the reference bare.
  let examples = {}
  try {
    const existing = JSON.parse(current)
    examples = existing["x-captured-examples"] ?? {}
  } catch {
    /* first run */
  }
  if (siteUrl) {
    const captured = await captureExamples(siteUrl, token)
    if (Object.keys(captured).length > 0) examples = captured
    console.log(`· captured ${Object.keys(examples).length} live examples`)
  }

  const spec = buildSpec(routes, examples, siteUrl)
  // Kept so a regeneration without a deployment reuses real examples.
  spec["x-captured-examples"] = examples
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
