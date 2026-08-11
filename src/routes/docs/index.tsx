import { Link, createFileRoute } from "@tanstack/react-router"
import {
  RiArrowRightSLine,
  RiBookOpenLine,
  RiCodeSSlashLine,
  RiRobot2Line
  
} from "@remixicon/react"
import type {RemixiconComponentType} from "@remixicon/react";
import type { LinkProps } from "@tanstack/react-router"

import { DOCS_NAV } from "@/docs/nav"
import { MCP_TOOL_COUNT } from "@/docs/generated/mcp-tools"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/docs/")({
  component: DocsIndexPage,
  head: () => ({
    meta: [
      { title: "Docs · Trackstage" },
      {
        name: "description",
        content:
          "How to run a call for papers, review it, build the agenda and publish your programme — plus the API and MCP server.",
      },
    ],
  }),
})

const SURFACES = [
  {
    to: "/docs/guide/getting-started",
    icon: RiBookOpenLine,
    title: "User guide",
    description:
      "Eleven short pages, each one flow, each with the screens you will actually be looking at.",
    meta: "Start here",
  },
  {
    to: "/docs/api",
    icon: RiCodeSSlashLine,
    title: "API",
    description:
      "Read your sessions, speakers and submissions over plain HTTP, plus a calendar feed that needs no key. Full-screen interactive reference.",
    meta: "4 endpoints",
  },
  {
    to: "/docs/mcp",
    icon: RiRobot2Line,
    title: "MCP",
    description:
      "Connect Claude, ChatGPT or Codex to your event and run it by chat — read and write.",
    meta: `${MCP_TOOL_COUNT} tools`,
  },
] satisfies ReadonlyArray<{
  to: NonNullable<LinkProps["to"]>
  icon: RemixiconComponentType
  title: string
  description: string
  meta: string
}>

function DocsIndexPage() {
  const guide = DOCS_NAV.find((group) => group.label === "User guide")

  return (
    <div>
      <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-foreground">
        Documentation
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-7 text-pretty text-muted-foreground">
        Everything you need to run a call for papers, decide on it, and get a
        programme on stage.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {SURFACES.map((surface) => (
          <Link
            key={surface.to}
            to={surface.to}
            className={cn(
              "group flex flex-col rounded-xl border border-border bg-card p-4 transition-colors",
              "hover:border-primary-border hover:bg-primary-surface/40"
            )}
          >
            <surface.icon size={20} aria-hidden className="text-primary" />
            <span className="font-heading mt-3 text-base font-semibold tracking-[-0.02em] text-foreground">
              {surface.title}
            </span>
            <span className="mt-1 flex-1 text-[0.8125rem] leading-6 text-pretty text-muted-foreground">
              {surface.description}
            </span>
            <span className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">
              {surface.meta}
              <RiArrowRightSLine
                size={14}
                aria-hidden
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        ))}
      </div>

      <h2 className="font-heading mt-12 text-lg font-semibold tracking-[-0.02em] text-foreground">
        The whole flow, in order
      </h2>
      <p className="mt-1 text-[0.875rem] text-muted-foreground">
        Read it top to bottom the first time. Each page takes under a minute.
      </p>

      <ol className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {guide?.items.map((item, index) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/60"
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, "0")}
              </span>
              <item.icon size={16} aria-hidden className="shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {item.title}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {item.summary}
                </span>
              </span>
              <RiArrowRightSLine
                size={16}
                aria-hidden
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ol>

      <p className="mt-6 text-[0.875rem] text-muted-foreground">
        Running it yourself?{" "}
        <Link
          to="/docs/self-host"
          className="font-medium text-primary underline underline-offset-4"
        >
          Self-host in five minutes
        </Link>
        .
      </p>
    </div>
  )
}
