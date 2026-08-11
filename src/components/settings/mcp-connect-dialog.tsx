import { useState } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  MCP_SCOPE_COPY,
  McpClientStack,
  McpConnectPanel,
} from "@/components/settings/mcp-connect-panel"

/**
 * "Connect a client", as a modal — ONE component, two homes (Marko,
 * 2026-08-11): Account settings → API & MCP, and the copilot page header.
 *
 * The modal is the right shape for this job everywhere it appears: connecting
 * an outside client is a five-second errand, not a page you live on, and the
 * organizer should not lose the conversation (or the settings tab) they were
 * in to run it. It wraps `McpConnectPanel` rather than restating any of it, so
 * the mint-on-copy snippets can never drift between the two entry points.
 */
export function McpConnectDialog({
  apiKey = null,
  open,
  onOpenChange,
}: {
  /** A key just created on this screen; otherwise copying mints one. */
  apiKey?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
        WIDE, and every child `min-w-0` (Marko, 2026-08-11): a `claude mcp add`
        command is ~150 characters, and in a grid/flex box whose items default
        to `min-width: auto` that one line silently widens the track past the
        dialog's max-width — which clipped the copy buttons and cut the
        description off mid-word. The snippets scroll inside their own block;
        the dialog itself never does.
      */}
      <DialogContent className="grid max-h-[85svh] w-full grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex items-center gap-2">
            <McpClientStack />
            Connect a client
          </DialogTitle>
          <DialogDescription>{MCP_SCOPE_COPY}</DialogDescription>
        </DialogHeader>
        <McpConnectPanel apiKey={apiKey} />
      </DialogContent>
    </Dialog>
  )
}

/**
 * The button that opens it: the client logos as an avatar stack plus a label.
 * Quiet enough to sit in a page header next to a chat, explicit enough that
 * nobody has to guess what a plug icon meant.
 */
export function McpConnectButton({
  apiKey = null,
  label = "Connect MCP",
  variant = "outline",
  className,
}: {
  apiKey?: string | null
  label?: string
  variant?: "outline" | "ghost"
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant={variant}
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setOpen(true)}
      >
        <McpClientStack />
        <span className="max-sm:sr-only">{label}</span>
      </Button>
      <McpConnectDialog apiKey={apiKey} open={open} onOpenChange={setOpen} />
    </>
  )
}
