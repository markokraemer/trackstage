import { createFileRoute } from "@tanstack/react-router"
import { useSuspenseQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const eventsQuery = convexQuery(api.events.list, {})

export const Route = createFileRoute("/")({
  component: App,
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(eventsQuery)
  },
})

function App() {
  const { data: events } = useSuspenseQuery(eventsQuery)

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-medium">Sessionboard OSS</h1>
        <p className="text-muted-foreground text-sm">
          Speaker, CFP, and program management.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Events</h2>
        {events.length === 0 ? (
          <p className="text-muted-foreground text-sm">No events yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event) => (
              <li key={event._id}>
                <Card>
                  <CardHeader>
                    <CardTitle>{event.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-muted-foreground text-sm">
                    <p>/{event.slug}</p>
                    {event.venue ? <p>{event.venue}</p> : null}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
