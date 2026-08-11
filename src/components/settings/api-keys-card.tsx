import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { convexQuery, useConvexMutation } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import { format, formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  RiAddLine,
  RiDeleteBinLine,
  RiKey2Line,
  RiShieldKeyholeLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/empty-state"
import { LabeledField } from "@/components/settings/labeled-field"
import { ConfirmDeleteButton } from "@/components/settings/confirm-delete-button"
import { CopyButton } from "@/components/settings/copy-button"
import { errorMessage } from "@/components/settings/errors"

export interface CreatedApiKey {
  keyId: Id<"apiKeys">
  key: string
  prefix: string
  name: string
}

/**
 * Personal API keys — the credential for the MCP server and REST API
 * (`convex/apiKeys.ts`). The plaintext key is only ever returned once, right
 * after creation, so `onCreated` lifts it to the settings page so the MCP
 * connect card can drop it straight into a copyable snippet.
 */
export function ApiKeysCard({
  createdKey,
  onCreated,
  onDismissCreated,
}: {
  createdKey: CreatedApiKey | null
  onCreated: (key: CreatedApiKey) => void
  onDismissCreated: () => void
}) {
  const { data: keys, isPending } = useQuery(convexQuery(api.apiKeys.list, {}))
  const [dialogOpen, setDialogOpen] = useState(false)

  const hasKeys = (keys?.length ?? 0) > 0

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiKey2Line size={18} aria-hidden className="text-primary" />
          Personal API keys
        </CardTitle>
        <CardDescription>
          Keys authenticate you personally — an AI assistant or script acting
          as a key can do anything you can do. Revoke a key any time to cut
          it off immediately.
        </CardDescription>
        <CardAction>
          <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
            <RiAddLine size={15} aria-hidden />
            New key
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent>
        {createdKey ? (
          <CreatedKeyAlert createdKey={createdKey} onDismiss={onDismissCreated} />
        ) : null}

        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !hasKeys ? (
          <EmptyState
            variant="plain"
            icon={RiKey2Line}
            title="No API keys yet"
            description="Create a personal key to connect Claude, ChatGPT, Codex or any MCP client to Sessionboard — see “Connect from your AI assistant” below."
            action={
              <Button type="button" size="sm" onClick={() => setDialogOpen(true)}>
                <RiAddLine size={15} aria-hidden />
                New key
              </Button>
            }
            className="py-8"
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead className="w-32">Created</TableHead>
                  <TableHead className="w-32">Last used</TableHead>
                  <TableHead className="w-12 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(keys ?? []).map((key) => (
                  <ApiKeyRow key={key.keyId} apiKey={key} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <NewKeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onCreated}
      />
    </Card>
  )
}

function ApiKeyRow({
  apiKey,
}: {
  apiKey: {
    keyId: Id<"apiKeys">
    name: string
    prefix: string
    createdAt: number
    lastUsedAt: number | null
  }
}) {
  const revoke = useMutation({ mutationFn: useConvexMutation(api.apiKeys.revoke) })

  return (
    <TableRow>
      <TableCell className="font-medium text-foreground">{apiKey.name}</TableCell>
      <TableCell>
        <span className="font-mono text-xs text-muted-foreground">
          {apiKey.prefix}…
        </span>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {format(apiKey.createdAt, "MMM d, yyyy")}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {apiKey.lastUsedAt
          ? formatDistanceToNow(apiKey.lastUsedAt, { addSuffix: true })
          : "Never"}
      </TableCell>
      <TableCell className="text-right">
        <ConfirmDeleteButton
          label={`Revoke ${apiKey.name}`}
          title={`Revoke “${apiKey.name}”?`}
          description="Anything using this key — an AI assistant, a script — loses access immediately. This can't be undone."
          confirmLabel="Revoke key"
          successMessage="Key revoked"
          fallbackError="Couldn't revoke that key."
          onConfirm={() => revoke.mutateAsync({ keyId: apiKey.keyId })}
        >
          <RiDeleteBinLine size={15} aria-hidden />
        </ConfirmDeleteButton>
      </TableCell>
    </TableRow>
  )
}

function CreatedKeyAlert({
  createdKey,
  onDismiss,
}: {
  createdKey: CreatedApiKey
  onDismiss: () => void
}) {
  return (
    <Alert className="border-primary/25 bg-accent">
      <RiShieldKeyholeLine size={18} aria-hidden className="text-accent-foreground" />
      <AlertTitle>“{createdKey.name}” created</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p className="font-medium text-destructive">
          Copy it now — you won't be able to see it again.
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <code className="min-w-0 flex-1 leading-relaxed break-all select-all font-mono text-sm text-foreground">
            {createdKey.key}
          </code>
          <CopyButton
            value={createdKey.key}
            label="Copy key"
            successMessage="API key copied to your clipboard"
          />
        </div>
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onDismiss}>
            Done — I've saved it
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

function NewKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (key: CreatedApiKey) => void
}) {
  const [name, setName] = useState("")
  const create = useMutation({ mutationFn: useConvexMutation(api.apiKeys.create) })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    try {
      const result = await create.mutateAsync({ name: name.trim() || undefined })
      onCreated(result)
      onOpenChange(false)
      setName("")
      toast.success("API key created")
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't create that key."))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setName("")
      }}
    >
      <DialogContent>
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Create an API key</DialogTitle>
            <DialogDescription>
              Give it a name that reminds you where it's used — you'll see the
              key itself only once, right after creating it.
            </DialogDescription>
          </DialogHeader>

          <LabeledField label="Name" htmlFor="api-key-name">
            <Input
              id="api-key-name"
              value={name}
              autoComplete="off"
              placeholder="Claude Code on my laptop"
              onChange={(event) => setName(event.target.value)}
            />
          </LabeledField>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
