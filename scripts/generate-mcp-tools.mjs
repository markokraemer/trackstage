/**
 * Generates the MCP tool table used by /docs/mcp straight from the server's own
 * tool definitions, so the docs can never drift from what the MCP actually
 * exposes.
 *
 *   node scripts/generate-mcp-tools.mjs           # rewrite the generated file
 *   node scripts/generate-mcp-tools.mjs --check   # fail if it is out of date (CI)
 *
 * Source of truth: the `export const TOOLS: Array<ToolDef> = [...]` literal in
 * convex/mcp.ts. We parse it rather than import it because convex/mcp.ts pulls
 * in the whole generated Convex API surface, which cannot be loaded from plain
 * node. The literal is deliberately flat (string/number/boolean properties), so
 * a brace-balanced scan over it is exact — and if the shape ever changes enough
 * to break the scan, this script throws instead of emitting a half-right table.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE = resolve(root, "convex/mcp.ts")
const OUT = resolve(root, "src/docs/generated/mcp-tools.ts")

/** Tool name → docs grouping. Every tool must land in exactly one group. */
const GROUPS = [
  {
    id: "workspaces",
    label: "Workspaces & events",
    tools: [
      "list_workspaces",
      "list_events",
      "create_event",
      "delete_event",
      "get_event_overview",
      "get_event_summary",
    ],
  },
  {
    id: "forms",
    label: "CFP forms",
    tools: [
      "list_forms",
      "get_form",
      "create_form",
      "update_form_settings",
      "get_public_form_link",
      "delete_form",
    ],
  },
  {
    id: "submissions",
    label: "Submissions & decisions",
    tools: [
      "list_submissions",
      "get_submission",
      "set_submission_status",
      "commit_decision_queue",
      "add_manual_session",
    ],
  },
  {
    id: "agenda",
    label: "Agenda",
    tools: ["get_agenda", "schedule_session", "unschedule_session", "auto_place_sessions"],
  },
  {
    id: "speakers",
    label: "Speakers & tasks",
    tools: [
      "list_speakers",
      "get_speaker_portal_link",
      "assign_task",
      "remove_task",
      "list_task_library",
      "save_task_template",
      "assign_task_from_template",
      "send_reminders",
    ],
  },
  {
    id: "email",
    label: "Email",
    tools: [
      "list_templates",
      "get_template",
      "update_template",
      "list_outbox",
      "send_test_email",
    ],
  },
]

/**
 * Slices out the body of `export const TOOLS: Array<ToolDef> = [ … ]` by
 * counting brackets, so nested arrays/objects inside a tool cannot end it early.
 */
function extractToolsArray(source) {
  const marker = "export const TOOLS: Array<ToolDef> = ["
  const start = source.indexOf(marker)
  if (start === -1) throw new Error("convex/mcp.ts: could not find `export const TOOLS`")
  let depth = 0
  for (let i = start + marker.length - 1; i < source.length; i++) {
    const char = source[i]
    if (char === "[" || char === "{") depth++
    else if (char === "]" || char === "}") {
      depth--
      if (depth === 0) return source.slice(start + marker.length, i)
    }
  }
  throw new Error("convex/mcp.ts: unbalanced TOOLS array")
}

/** Top-level `{ … }` objects of the array, one per tool. */
function splitObjects(body) {
  const objects = []
  let depth = 0
  let startIndex = -1
  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (char === "{") {
      if (depth === 0) startIndex = i
      depth++
    } else if (char === "}") {
      depth--
      if (depth === 0 && startIndex !== -1) {
        objects.push(body.slice(startIndex, i + 1))
        startIndex = -1
      }
    }
  }
  return objects
}

/** First `key: "…"` in the block — tool fields are declared before inputSchema. */
function readString(block, key, toolName) {
  const match = new RegExp(`\\b${key}:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(block)
  if (!match) throw new Error(`Tool ${toolName ?? "?"}: missing string field \`${key}\``)
  return JSON.parse(`"${match[1]}"`)
}

/** Property keys and the required list from `inputSchema: schema({…}, [...])`. */
function readInputSchema(block, name) {
  const at = block.indexOf("inputSchema: schema(")
  if (at === -1) throw new Error(`Tool ${name}: missing inputSchema`)
  const open = block.indexOf("{", at)
  let depth = 0
  let end = -1
  for (let i = open; i < block.length; i++) {
    if (block[i] === "{") depth++
    else if (block[i] === "}") {
      depth--
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  if (end === -1) throw new Error(`Tool ${name}: unbalanced inputSchema`)
  const properties = block.slice(open + 1, end)

  // Depth-1 keys only — nested `description:`/`enum:` keys sit deeper.
  const args = []
  let level = 0
  for (const line of properties.split("\n")) {
    const trimmed = line.trim()
    if (level === 0) {
      const key = /^([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(trimmed)
      if (key) args.push(key[1])
    }
    for (const char of line) {
      if (char === "{" || char === "[" || char === "(") level++
      else if (char === "}" || char === "]" || char === ")") level--
    }
  }

  // The second argument of `schema(properties, required)`, read from just past
  // the balanced properties object so nested arrays can never be mistaken for it.
  const requiredMatch = /^\s*,\s*\[([^\]]*)\]/.exec(block.slice(end + 1))
  const required = requiredMatch
    ? requiredMatch[1]
        .split(",")
        .map((part) => part.trim().replace(/^"|"$/g, ""))
        .filter(Boolean)
    : []
  return { args, required }
}

function parseTools(source) {
  return splitObjects(extractToolsArray(source)).map((block) => {
    const name = readString(block, "name")
    const readOnlyMatch = /\breadOnly:\s*(true|false)/.exec(block)
    if (!readOnlyMatch) throw new Error(`Tool ${name}: missing readOnly`)
    const { args, required } = readInputSchema(block, name)
    return {
      name,
      title: readString(block, "title", name),
      description: readString(block, "description", name),
      readOnly: readOnlyMatch[1] === "true",
      // `confirm: true` is the server-side guard on the irreversible actions.
      requiresConfirm: args.includes("confirm"),
      args,
      required,
    }
  })
}

function render(tools) {
  const grouped = GROUPS.map((group) => {
    const missing = group.tools.filter((name) => !tools.some((tool) => tool.name === name))
    if (missing.length) throw new Error(`Unknown tool(s) in GROUPS: ${missing.join(", ")}`)
    return { ...group, tools: group.tools.map((name) => tools.find((tool) => tool.name === name)) }
  })
  const ungrouped = tools.filter((tool) => !GROUPS.some((group) => group.tools.includes(tool.name)))
  if (ungrouped.length) {
    throw new Error(
      `New MCP tool(s) not assigned to a docs group: ${ungrouped.map((t) => t.name).join(", ")}. ` +
        `Add them to GROUPS in scripts/generate-mcp-tools.mjs.`
    )
  }

  const body = grouped
    .map(
      (group) => `  {
    id: ${JSON.stringify(group.id)},
    label: ${JSON.stringify(group.label)},
    tools: [
${group.tools
  .map(
    (tool) => `      {
        name: ${JSON.stringify(tool.name)},
        title: ${JSON.stringify(tool.title)},
        description: ${JSON.stringify(tool.description)},
        readOnly: ${tool.readOnly},
        requiresConfirm: ${tool.requiresConfirm},
        args: ${JSON.stringify(tool.args)},
        required: ${JSON.stringify(tool.required)},
      },`
  )
  .join("\n")}
    ],
  },`
    )
    .join("\n")

  return `// GENERATED FILE — DO NOT EDIT.
// Source of truth: convex/mcp.ts (\`export const TOOLS\`).
// Regenerate with: node scripts/generate-mcp-tools.mjs

export interface McpToolDoc {
  /** Tool name exactly as the MCP client sees it. */
  name: string
  /** Short human title from the tool's \`annotations.title\`. */
  title: string
  /** The description the model is given. */
  description: string
  /** \`readOnlyHint\` — true when the tool cannot change anything. */
  readOnly: boolean
  /** Guarded by a required \`confirm: true\` argument. */
  requiresConfirm: boolean
  args: Array<string>
  required: Array<string>
}

export interface McpToolGroup {
  id: string
  label: string
  tools: Array<McpToolDoc>
}

export const MCP_TOOL_GROUPS: Array<McpToolGroup> = [
${body}
]

export const MCP_TOOL_COUNT = ${tools.length}
`
}

async function main() {
  const source = await readFile(SOURCE, "utf8")
  const next = render(parseTools(source))

  if (process.argv.includes("--check")) {
    const current = await readFile(OUT, "utf8").catch(() => "")
    if (current !== next) {
      console.error(
        "src/docs/generated/mcp-tools.ts is out of date — run `node scripts/generate-mcp-tools.mjs`."
      )
      process.exit(1)
    }
    console.log("· MCP tool docs are up to date")
    return
  }

  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, next)
  console.log(`· wrote ${OUT.replace(`${root}/`, "")}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
