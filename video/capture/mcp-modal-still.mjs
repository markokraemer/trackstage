/**
 * One-off still for the V3 launch film's MCP beat (Marko: show the Connect
 * MCP modal opened from the COPILOT page, not the account settings page).
 *
 *   CAPTURE_BASE=http://localhost:3000 node video/capture/mcp-modal-still.mjs
 *
 * Writes video/public/captures/mcp-modal.png (1600×1000 @2x).
 */
import { shutdown, still } from "./lib.mjs"

await still("mcp-modal", "/app/copilot", async (page) => {
  await page.getByRole("button", { name: /connect mcp/i }).first().click()
  await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15000 })
  // Let the dialog's open transition and font rendering settle.
  await page.waitForTimeout(900)
})
await shutdown()
