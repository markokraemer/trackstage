/**
 * External destinations used across the marketing homepage.
 * Kept in one place so a URL never drifts between the nav, hero and footer.
 */

export const GITHUB_URL = "https://github.com/markokraemer/sessionboard"
export const GITHUB_LICENSE_URL = `${GITHUB_URL}/blob/main/LICENSE`
export const SESSIONBOARD_URL = "https://www.sessionboard.com"
export const KILL_MY_SAAS_POST_URL =
  "https://x.com/swyx/status/2085517544795079014"
export const LATENT_SPACE_URL = "https://www.latent.space"

/** Props every external link on this page uses. */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noreferrer",
} as const
