import { describe, expect, it } from "vitest"

import { latestVersionsOnly } from "@/lib/files"

/**
 * A bulk download is a handover, not a backup. These pin the rule the Files
 * library's "Download all" depends on: one file per version slot, the newest
 * one — because handing the AV team both v1 and v2 of the same deck is how the
 * wrong talk gets projected.
 *
 * The slot rule mirrors `convex/lib/files.ts::slotKey`.
 */

const file = (over: Partial<Parameters<typeof latestVersionsOnly>[0][number]>) => ({
  version: 1,
  personId: "p1",
  ...over,
})

describe("latestVersionsOnly", () => {
  it("keeps only the newest version within one task slot", () => {
    const rows = [
      file({ version: 2, taskId: "t1" }),
      file({ version: 1, taskId: "t1" }),
    ]
    const kept = latestVersionsOnly(rows)
    expect(kept).toHaveLength(1)
    expect(kept[0].version).toBe(2)
  })

  it("does not merge different tasks", () => {
    const kept = latestVersionsOnly([
      file({ version: 1, taskId: "t1" }),
      file({ version: 1, taskId: "t2" }),
    ])
    expect(kept).toHaveLength(2)
  })

  it("scopes a submission slot per speaker, so co-speakers both survive", () => {
    const kept = latestVersionsOnly([
      file({ version: 3, submissionId: "s1", personId: "priya" }),
      file({ version: 1, submissionId: "s1", personId: "marcus" }),
    ])
    expect(kept).toHaveLength(2)
  })

  it("collapses versions of a submission slot for the same speaker", () => {
    const kept = latestVersionsOnly([
      file({ version: 1, submissionId: "s1", personId: "priya" }),
      file({ version: 3, submissionId: "s1", personId: "priya" }),
      file({ version: 2, submissionId: "s1", personId: "priya" }),
    ])
    expect(kept.map((row) => row.version)).toEqual([3])
  })

  it("falls back to the person when a file belongs to no task or session", () => {
    const kept = latestVersionsOnly([
      file({ version: 1, personId: "priya" }),
      file({ version: 2, personId: "priya" }),
      file({ version: 1, personId: "marcus" }),
    ])
    expect(kept).toHaveLength(2)
    expect(kept.find((row) => row.personId === "priya")?.version).toBe(2)
  })

  it("preserves the caller's ordering", () => {
    const kept = latestVersionsOnly([
      file({ version: 1, taskId: "b" }),
      file({ version: 2, taskId: "a" }),
      file({ version: 1, taskId: "a" }),
    ])
    expect(kept.map((row) => row.taskId)).toEqual(["b", "a"])
  })

  it("leaves an already-latest-only list untouched", () => {
    const rows = [file({ taskId: "t1" }), file({ taskId: "t2" })]
    expect(latestVersionsOnly(rows)).toEqual(rows)
  })
})
