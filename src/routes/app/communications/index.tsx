import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { RiCalendarEventLine, RiMailSettingsLine } from "@remixicon/react"

import { api } from "@convex/_generated/api"
import type { Id } from "@convex/_generated/dataModel"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TooltipProvider } from "@/components/ui/tooltip"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { MESSAGE_STATUS_FILTERS } from "@/components/comms/constants"
import { MessageDrawer } from "@/components/comms/message-drawer"
import { OutboxTable } from "@/components/comms/outbox-table"
import { TemplateDrawer } from "@/components/comms/template-drawer"
import { TemplateList } from "@/components/comms/template-list"
import { useCurrentEvent } from "@/lib/current-event"

/**
 * Communications — docs/SPEC.md §4.9.
 *
 * Two tabs: the wording of every email the event sends (Templates), and every
 * email it has actually produced (Outbox), with the full rendered body one
 * click away. Tab and status filter live in the URL so any view is linkable.
 */

type CommsTab = "templates" | "outbox"

interface CommsSearch {
  tab: CommsTab
  status: string
}

export const Route = createFileRoute("/app/communications/")({
  validateSearch: (search: Record<string, unknown>): CommsSearch => {
    const rawStatus = typeof search.status === "string" ? search.status : "all"
    return {
      tab: search.tab === "outbox" ? "outbox" : "templates",
      status: MESSAGE_STATUS_FILTERS.some((f) => f.value === rawStatus)
        ? rawStatus
        : "all",
    }
  },
  component: CommunicationsPage,
})

function CommunicationsPage() {
  const { tab, status } = Route.useSearch()
  const navigate = Route.useNavigate()
  const [search, setSearch] = useState("")
  const [openTemplateKey, setOpenTemplateKey] = useState<string | null>(null)
  const [openMessageId, setOpenMessageId] = useState<Id<"messages"> | null>(
    null,
  )

  const { event, isLoading: eventsLoading } = useCurrentEvent()
  const eventId = event?._id

  const templatesQuery = useQuery(
    convexQuery(api.comms.listTemplates, eventId ? { eventId } : "skip"),
  )
  const messagesQuery = useQuery(
    convexQuery(
      api.comms.listMessages,
      eventId ? { eventId, limit: 500 } : "skip",
    ),
  )

  const templates = templatesQuery.data
  const messages = messagesQuery.data
  const openTemplate =
    templates?.find((row) => row.key === openTemplateKey) ?? null
  const openMessage =
    messages?.find((row) => row._id === openMessageId) ?? null

  function goToTab(next: CommsTab) {
    void navigate({
      search: (prev) => ({ ...prev, tab: next }),
      replace: true,
    })
  }

  function setStatus(next: string) {
    void navigate({
      search: (prev) => ({ ...prev, status: next }),
      replace: true,
    })
  }

  if (!eventsLoading && !event) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Communications"
          description="Email templates and everything your event has sent."
        />
        <EmptyState
          icon={RiMailSettingsLine}
          title="Create your event first"
          description="Emails are written per event — acceptances, declines, waitlist notes and task reminders all carry the event's name and its speaker portal links."
          action={
            <Button render={<a href="/app/settings" />}>Go to Settings</Button>
          }
        />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Communications"
          description="The wording of every email your event sends, and a full record of everything that has gone out."
        />

        <Tabs
          value={tab}
          onValueChange={(value: unknown) =>
            goToTab(value === "outbox" ? "outbox" : "templates")
          }
        >
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="outbox">
              Outbox
              {messages && messages.length > 0 ? (
                <Badge variant="secondary" className="ml-1.5">
                  {messages.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="pt-5">
            <div className="flex flex-col gap-4">
              <Alert>
                <RiCalendarEventLine aria-hidden />
                <AlertTitle>
                  Write once — every email fills itself in
                </AlertTitle>
                <AlertDescription>
                  Merge fields like{" "}
                  <code className="font-mono text-xs">{"{{firstName}}"}</code>{" "}
                  and{" "}
                  <code className="font-mono text-xs">{"{{portalLink}}"}</code>{" "}
                  are replaced with each speaker's own details as the email goes
                  out. Acceptance emails also carry a calendar invite once the
                  session has a time and room.
                </AlertDescription>
              </Alert>

              <TemplateList
                templates={templates}
                loading={templatesQuery.isPending || eventsLoading}
                onEdit={(template) => setOpenTemplateKey(template.key)}
              />
            </div>
          </TabsContent>

          <TabsContent value="outbox" className="pt-5">
            <OutboxTable
              messages={messages}
              loading={messagesQuery.isPending || eventsLoading}
              eventId={eventId}
              search={search}
              onSearchChange={setSearch}
              status={status}
              onStatusChange={setStatus}
              onOpenMessage={(message) => setOpenMessageId(message._id)}
              onEditTemplates={() => goToTab("templates")}
            />
          </TabsContent>
        </Tabs>

        <TemplateDrawer
          open={Boolean(openTemplate)}
          onOpenChange={(next) => {
            if (!next) setOpenTemplateKey(null)
          }}
          template={openTemplate}
          eventId={eventId}
          eventName={event?.name}
          onViewOutbox={() => {
            setOpenTemplateKey(null)
            goToTab("outbox")
          }}
        />

        <MessageDrawer
          open={Boolean(openMessage)}
          onOpenChange={(next) => {
            if (!next) setOpenMessageId(null)
          }}
          message={openMessage}
          eventId={eventId}
          venue={event?.venue}
        />
      </div>
    </TooltipProvider>
  )
}
