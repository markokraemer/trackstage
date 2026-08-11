import { createFileRoute, redirect } from "@tanstack/react-router"

/**
 * `/forms/new` is no longer a destination — creating a form is a DIALOG on the
 * Forms list (Marko, 2026-08-12; src/components/forms-builder/new-form-dialog.tsx).
 * The address survives for old links and bookmarks: it lands on the list with
 * the dialog already open (`?new=1`, validated by the list route).
 */
export const Route = createFileRoute("/app/$workspaceSlug/$eventSlug/forms/new")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/$workspaceSlug/$eventSlug/forms",
      params,
      search: { new: true },
      replace: true,
    })
  },
})
