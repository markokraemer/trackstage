/**
 * Workspace roles (convex/workspaces.ts enforces the same rules server-side).
 * Owner is granted at creation and can't be assigned or removed from the UI.
 */
export const ROLE_LABELS: Record<string, string | undefined> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
}

export const ROLE_HELP: Record<string, string | undefined> = {
  owner: "Can do everything, including managing the team.",
  admin: "Can run events end to end and invite teammates.",
  member: "Can work on events, but can't change the team.",
}

/** Human label for a role, falling back to the raw value. */
export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

export function canManageTeam(role: string | undefined): boolean {
  return role === "owner" || role === "admin"
}

export function canChangeRoles(role: string | undefined): boolean {
  return role === "owner"
}
