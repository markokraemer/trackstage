import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import {
  convexQuery,
  useConvexAction,
  useConvexMutation,
} from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"
import type { FunctionReturnType } from "convex/server"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  RiArrowRightUpLine,
  RiCheckboxCircleFill,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiLoader4Line,
  RiRefreshLine,
  RiTableLine,
} from "@remixicon/react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/shared/empty-state"
import { LabeledField } from "@/components/settings/labeled-field"
import { ConfirmDeleteButton } from "@/components/settings/confirm-delete-button"
import { errorMessage } from "@/components/settings/errors"

const TOKEN_HELP_URL = "https://airtable.com/create/tokens"
const SCOPES = [
  "data.records:read",
  "data.records:write",
  "schema.bases:read",
  "schema.bases:write",
]

/**
 * Settings → Integrations → Airtable (docs/memory/RULES.md 15).
 *
 * The whole promise in one card: paste a token and a base ID, and every
 * submission, speaker and scheduled session shows up as a row in the
 * organizer's OWN Airtable base — which is what their existing automations
 * are already watching. One way only, so nothing they do in Airtable can
 * corrupt the programme.
 */
export function AirtableCard({ eventId }: { eventId: Id<"events"> }) {
  const { data: connection, isPending } = useQuery(
    convexQuery(api.airtable.status, { eventId })
  )
  const [dialogOpen, setDialogOpen] = useState(false)

  const syncNow = useMutation({
    mutationFn: useConvexMutation(api.airtable.syncNow),
  })
  const disconnect = useMutation({
    mutationFn: useConvexMutation(api.airtable.disconnect),
  })

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center gap-2">
          <RiTableLine size={18} aria-hidden className="text-primary" />
          Airtable
          {connection ? (
            <Badge
              variant={
                connection.status === "error" ? "destructive" : "secondary"
              }
            >
              {connection.status === "error" ? "Needs attention" : "Connected"}
            </Badge>
          ) : null}
          {connection?.mode === "demo" ? (
            <Badge variant="outline">Demo mode</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Mirror this event into a base you own. New submissions appear as rows
          — point your Airtable automations at them. Trackstage stays the source
          of truth; only Status can be sent back, and only if you switch it on
          below.
        </CardDescription>
        {connection ? (
          <CardAction>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncNow.isPending}
              onClick={async () => {
                try {
                  await syncNow.mutateAsync({ eventId })
                  toast.success("Syncing — new rows land in a few seconds.")
                } catch (error) {
                  toast.error(errorMessage(error, "Couldn't start that sync."))
                }
              }}
            >
              {syncNow.isPending ? (
                <RiLoader4Line size={15} aria-hidden className="animate-spin" />
              ) : (
                <RiRefreshLine size={15} aria-hidden />
              )}
              Sync now
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent>
        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !connection ? (
          <EmptyState
            variant="plain"
            icon={RiTableLine}
            title="Not connected yet"
            description="Connect once and we'll create three tables — Submissions, Speakers and Sessions — in your base, then keep them up to date automatically."
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => setDialogOpen(true)}
              >
                Connect Airtable
              </Button>
            }
            className="py-8"
          />
        ) : (
          <>
            <ConnectedState connection={connection} />
            <TwoWayToggle eventId={eventId} connection={connection} />
          </>
        )}
      </CardContent>

      {connection ? (
        <CardFooter className="justify-between border-t">
          <p className="text-xs text-muted-foreground">
            Disconnecting only forgets your token — your Airtable tables and
            their rows stay exactly as they are.
          </p>
          <ConfirmDeleteButton
            label="Disconnect Airtable"
            title="Disconnect Airtable?"
            description="We'll stop mirroring this event and forget your access token. Your base keeps every row it already has — reconnect any time to resume."
            confirmLabel="Disconnect"
            successMessage="Airtable disconnected"
            fallbackError="Couldn't disconnect Airtable."
            triggerVariant="outline"
            triggerSize="sm"
            onConfirm={() => disconnect.mutateAsync({ eventId })}
          >
            Disconnect
          </ConfirmDeleteButton>
        </CardFooter>
      ) : null}

      <ConnectDialog
        eventId={eventId}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </Card>
  )
}

type Connection = NonNullable<FunctionReturnType<typeof api.airtable.status>>

function ConnectedState({ connection }: { connection: Connection }) {
  const counts = connection.recordCounts
  const tiles = [
    { label: "Submissions", value: counts?.submissions },
    { label: "Speakers", value: counts?.speakers },
    { label: "Sessions", value: counts?.sessions },
  ]

  return (
    <div className="flex flex-col gap-4">
      {connection.lastError ? (
        <Alert variant="destructive">
          <RiErrorWarningLine size={18} aria-hidden />
          <AlertTitle>Last sync didn't finish</AlertTitle>
          <AlertDescription>{connection.lastError}</AlertDescription>
        </Alert>
      ) : null}

      {connection.mode === "demo" ? (
        <Alert>
          <RiCheckboxCircleFill
            size={18}
            aria-hidden
            className="text-primary"
          />
          <AlertTitle>Demo mode</AlertTitle>
          <AlertDescription>
            This deployment runs with{" "}
            <code className="font-mono text-xs">AIRTABLE_DEMO_MODE=1</code>, so
            the connection is simulated: we count the rows we would mirror but
            never call Airtable. Unset it and reconnect with a real token to
            write for real.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Base
          </span>
          <a
            href={connection.baseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 font-mono text-sm text-primary underline-offset-4 hover:underline"
          >
            {connection.baseId}
            <RiExternalLinkLine size={13} aria-hidden />
          </a>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            Token
          </span>
          <span className="font-mono text-sm text-foreground">
            {connection.tokenMasked}
          </span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-0.5 rounded-lg border border-border bg-muted/40 px-3 py-2"
          >
            <span className="text-lg font-semibold text-foreground tabular-nums">
              {tile.value ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              rows in {tile.label}
            </span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        {connection.lastSyncAt
          ? `Last synced ${formatDistanceToNow(connection.lastSyncAt, { addSuffix: true })}.`
          : "First sync is running — rows appear in a moment."}{" "}
        We re-sync within seconds of a new submission and sweep every 5 minutes
        for everything else. Rows are matched on the{" "}
        <code className="font-mono text-xs">Trackstage ID</code> column, so a
        sync never duplicates anything.
      </p>
    </div>
  )
}

/**
 * The experimental inbound half (docs/memory/HISTORY.md 61).
 *
 * Framed as one switch with a plain-English promise and a plain-English limit,
 * because that is the whole risk model an organizer needs: ONE column comes
 * back, and if the two sides disagree, Trackstage wins. Everything subtler —
 * echo detection, modified-since cursors — is our problem, not theirs.
 */
function TwoWayToggle({
  eventId,
  connection,
}: {
  eventId: Id<"events">
  connection: Connection
}) {
  const setTwoWay = useMutation({
    mutationFn: useConvexMutation(api.airtable.setTwoWaySync),
  })
  const inbound = connection.inbound

  return (
    <div className="mt-5 flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4">
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel
            htmlFor="airtable-two-way"
            className="flex items-center gap-2 text-sm font-medium"
          >
            Sync Status changes back
            <Badge variant="outline">Experimental</Badge>
          </FieldLabel>
          <FieldDescription>
            Change a submission's <b>Status</b> in Airtable and it lands here on
            the next sync. Only that one column comes back — and if the same
            submission changed in Trackstage too, Trackstage wins and we note it
            in the activity log.
          </FieldDescription>
        </FieldContent>
        <Switch
          id="airtable-two-way"
          checked={connection.twoWaySync}
          disabled={setTwoWay.isPending}
          onCheckedChange={async (value) => {
            try {
              await setTwoWay.mutateAsync({ eventId, enabled: Boolean(value) })
              toast.success(
                value
                  ? "Two-way sync on — Status changes in Airtable will come back."
                  : "Two-way sync off — Airtable is a read-only mirror again."
              )
            } catch (error) {
              toast.error(errorMessage(error, "Couldn't change that setting."))
            }
          }}
        />
      </Field>

      {connection.twoWaySync ? (
        <p className="text-xs text-muted-foreground">
          {inbound
            ? `Last check ${formatDistanceToNow(inbound.at, { addSuffix: true })}: ${inbound.applied} applied, ${inbound.skipped} left alone${inbound.conflicts > 0 ? `, ${inbound.conflicts} kept as Trackstage had them` : ""}.`
            : "Waiting for the first sync — a row becomes eligible once we've mirrored it at least once."}{" "}
          Draft and Withdrawn can never be set from Airtable.
        </p>
      ) : null}
    </div>
  )
}

function ConnectDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: Id<"events">
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [token, setToken] = useState("")
  const [baseId, setBaseId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const connect = useMutation({
    mutationFn: useConvexAction(api.airtable.connect),
  })

  function reset() {
    setToken("")
    setBaseId("")
    setError(null)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    try {
      const result = await connect.mutateAsync({
        eventId,
        token: token.trim(),
        baseId: baseId.trim(),
      })
      onOpenChange(false)
      reset()
      toast.success(
        result.createdTables.length > 0
          ? `Airtable connected — created ${result.createdTables.join(", ")}.`
          : "Airtable connected — syncing now."
      )
      for (const warning of result.warnings) toast.warning(warning)
    } catch (caught) {
      setError(errorMessage(caught, "Couldn't connect to Airtable."))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) reset()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} noValidate className="flex flex-col gap-6">
          <DialogHeader>
            <DialogTitle>Connect Airtable</DialogTitle>
            <DialogDescription>
              Two values from Airtable and you're done. We'll create the tables
              we need and start mirroring straight away.
            </DialogDescription>
          </DialogHeader>

          {error ? (
            <Alert variant="destructive">
              <RiErrorWarningLine size={18} aria-hidden />
              <AlertTitle>Airtable said no</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <LabeledField
            label="Personal access token"
            htmlFor="airtable-token"
            required
            description={
              <>
                Create one at{" "}
                <a
                  href={TOKEN_HELP_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary underline underline-offset-3"
                >
                  airtable.com/create/tokens
                  <RiArrowRightUpLine size={12} aria-hidden />
                </a>
                , add your base under “Access”, and tick these scopes:
              </>
            }
            footer={
              <span className="flex flex-wrap gap-1">
                {SCOPES.map((scope) => (
                  <code
                    key={scope}
                    className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[11px]"
                  >
                    {scope}
                  </code>
                ))}
              </span>
            }
          >
            <Input
              id="airtable-token"
              value={token}
              autoComplete="off"
              spellCheck={false}
              placeholder="patXXXXXXXXXXXXXX.xxxxxxxx…"
              onChange={(event) => setToken(event.target.value)}
            />
          </LabeledField>

          <LabeledField
            label="Base ID"
            htmlFor="airtable-base"
            required
            description="Open the base in Airtable — the ID is in the address bar, right after airtable.com/ and starting with “app”."
            footer={
              <span className="font-mono text-[11px]">
                airtable.com/<b className="text-foreground">appAbC123XyZ</b>
                /tblXXXX/viwXXXX
              </span>
            }
          >
            <Input
              id="airtable-base"
              value={baseId}
              autoComplete="off"
              spellCheck={false}
              placeholder="appAbC123XyZ"
              onChange={(event) => setBaseId(event.target.value)}
            />
          </LabeledField>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={connect.isPending}>
              {connect.isPending ? (
                <>
                  <RiLoader4Line
                    size={15}
                    aria-hidden
                    className="animate-spin"
                  />
                  Checking with Airtable…
                </>
              ) : (
                "Connect"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
