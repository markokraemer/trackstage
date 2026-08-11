import { betterAuth } from "better-auth/minimal"
import { organization } from "better-auth/plugins"
import { createClient  } from "@convex-dev/better-auth"
import type {GenericCtx} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins"
import authConfig from "./auth.config"
import { components } from "./_generated/api"
import { query } from "./_generated/server"
import type { DataModel } from "./_generated/dataModel"

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000"

export const authComponent = createClient<DataModel>(components.betterAuth)

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [
      // Multi-tenancy: organizations own events; members carry roles
      // (owner | admin | member). See convex/lib/auth.ts for authorization.
      organization(),
      convex({ authConfig }),
    ],
  })
}

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.safeGetAuthUser(ctx)
  },
})
