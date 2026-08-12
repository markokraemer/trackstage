import { createFileRoute, redirect } from "@tanstack/react-router"

/** `/get` — straight redirect to the (now public) GitHub repo. */
export const Route = createFileRoute("/get")({
  beforeLoad: () => {
    throw redirect({ href: "https://github.com/markokraemer/trackstage" })
  },
})
