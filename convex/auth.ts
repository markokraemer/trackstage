import { betterAuth } from "better-auth/minimal"
import { mcp, organization } from "better-auth/plugins"
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
      // MCP / OAuth 2.1 authorization server (convex/mcp.ts is the protected
      // resource). Gives Claude and ChatGPT connectors the "add by URL" flow:
      // dynamic client registration → authorization code + PKCE → bearer
      // token, with our own sign-in page as the consent step.
      //
      // baseURL is the APP origin on purpose: the browser leg of the flow
      // needs the Better Auth session cookie, and that cookie lives on the
      // app origin because the app proxies /api/auth/* through to Convex
      // (src/routes/api/auth/$.ts). The `resource` is the MCP endpoint on the
      // Convex site — that split (issuer = app, resource = Convex site) is
      // exactly what RFC 9728 protected-resource metadata exists to express.
      mcp({
        loginPage: "/login",
        resource: `${(process.env.CONVEX_SITE_URL ?? "").replace(/\/+$/, "")}/mcp`,
      }),
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
