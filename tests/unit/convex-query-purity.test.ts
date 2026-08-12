import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

import { cfpClosedMessage, formWindow } from "../../convex/lib/formWindow"

function sourceFiles(directory: string): Array<string> {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "_generated") return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return entry.name.endsWith(".ts") ? [path] : []
  })
}

describe("Convex query time boundaries", () => {
  it("keeps Date.now() out of registered queries", () => {
    const hits: Array<string> = []
    for (const path of sourceFiles(join(process.cwd(), "convex"))) {
      const text = readFileSync(path, "utf8")
      const source = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
      )
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          (node.expression.text === "query" ||
            node.expression.text === "internalQuery") &&
          node.getText(source).includes("Date.now()")
        ) {
          const line =
            source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1
          hits.push(`${path}:${line}`)
        }
        ts.forEachChild(node, visit)
      }
      visit(source)
    }
    expect(hits).toEqual([])
  })

  it("derives the CFP verdict from the timestamp in the query key", () => {
    const closeAt = 2_000
    expect(formWindow({ status: "open", closeAt }, 1_999)).toEqual({
      open: true,
    })
    expect(formWindow({ status: "open", closeAt }, 2_001)).toEqual({
      open: false,
      reason: "The submission deadline for this form has passed.",
    })
  })

  it("uses the same timestamp in the portal refusal sentence", () => {
    const form = { closeAt: 2_000 } as Parameters<typeof cfpClosedMessage>[0]
    expect(cfpClosedMessage(form, "UTC", 1_999)).not.toContain(" on ")
    expect(cfpClosedMessage(form, "UTC", 2_001)).toContain("closed on Jan 1, 1970")
  })
})
