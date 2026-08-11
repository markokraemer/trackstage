/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agenda from "../agenda.js";
import type * as airtable from "../airtable.js";
import type * as apiHttp from "../apiHttp.js";
import type * as apiKeys from "../apiKeys.js";
import type * as apiRoutes from "../apiRoutes.js";
import type * as apiV1 from "../apiV1.js";
import type * as audit from "../audit.js";
import type * as auth from "../auth.js";
import type * as comms from "../comms.js";
import type * as copilotThreads from "../copilotThreads.js";
import type * as crons from "../crons.js";
import type * as dashboard from "../dashboard.js";
import type * as embeds from "../embeds.js";
import type * as evaluationsAdmin from "../evaluationsAdmin.js";
import type * as events from "../events.js";
import type * as files from "../files.js";
import type * as forms from "../forms.js";
import type * as http from "../http.js";
import type * as lib_airtable from "../lib/airtable.js";
import type * as lib_airtableInbound from "../lib/airtableInbound.js";
import type * as lib_apiIcs from "../lib/apiIcs.js";
import type * as lib_apiXml from "../lib/apiXml.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_email from "../lib/email.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_evaluation from "../lib/evaluation.js";
import type * as lib_files from "../lib/files.js";
import type * as lib_formWindow from "../lib/formWindow.js";
import type * as lib_ics from "../lib/ics.js";
import type * as lib_profileCompleteness from "../lib/profileCompleteness.js";
import type * as lib_profileTasks from "../lib/profileTasks.js";
import type * as lib_publicLinks from "../lib/publicLinks.js";
import type * as lib_taskVars from "../lib/taskVars.js";
import type * as lib_uploadComments from "../lib/uploadComments.js";
import type * as mcp from "../mcp.js";
import type * as platformEmails from "../platformEmails.js";
import type * as portal from "../portal.js";
import type * as publicData from "../publicData.js";
import type * as review from "../review.js";
import type * as roomsTracks from "../roomsTracks.js";
import type * as search from "../search.js";
import type * as seed from "../seed.js";
import type * as sessionStatuses from "../sessionStatuses.js";
import type * as speakersAdmin from "../speakersAdmin.js";
import type * as submissions from "../submissions.js";
import type * as submit from "../submit.js";
import type * as tasksAdmin from "../tasksAdmin.js";
import type * as valueLists from "../valueLists.js";
import type * as webhooks from "../webhooks.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agenda: typeof agenda;
  airtable: typeof airtable;
  apiHttp: typeof apiHttp;
  apiKeys: typeof apiKeys;
  apiRoutes: typeof apiRoutes;
  apiV1: typeof apiV1;
  audit: typeof audit;
  auth: typeof auth;
  comms: typeof comms;
  copilotThreads: typeof copilotThreads;
  crons: typeof crons;
  dashboard: typeof dashboard;
  embeds: typeof embeds;
  evaluationsAdmin: typeof evaluationsAdmin;
  events: typeof events;
  files: typeof files;
  forms: typeof forms;
  http: typeof http;
  "lib/airtable": typeof lib_airtable;
  "lib/airtableInbound": typeof lib_airtableInbound;
  "lib/apiIcs": typeof lib_apiIcs;
  "lib/apiXml": typeof lib_apiXml;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/email": typeof lib_email;
  "lib/errors": typeof lib_errors;
  "lib/evaluation": typeof lib_evaluation;
  "lib/files": typeof lib_files;
  "lib/formWindow": typeof lib_formWindow;
  "lib/ics": typeof lib_ics;
  "lib/profileCompleteness": typeof lib_profileCompleteness;
  "lib/profileTasks": typeof lib_profileTasks;
  "lib/publicLinks": typeof lib_publicLinks;
  "lib/taskVars": typeof lib_taskVars;
  "lib/uploadComments": typeof lib_uploadComments;
  mcp: typeof mcp;
  platformEmails: typeof platformEmails;
  portal: typeof portal;
  publicData: typeof publicData;
  review: typeof review;
  roomsTracks: typeof roomsTracks;
  search: typeof search;
  seed: typeof seed;
  sessionStatuses: typeof sessionStatuses;
  speakersAdmin: typeof speakersAdmin;
  submissions: typeof submissions;
  submit: typeof submit;
  tasksAdmin: typeof tasksAdmin;
  valueLists: typeof valueLists;
  webhooks: typeof webhooks;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
