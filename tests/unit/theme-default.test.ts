// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import {
  THEME_BOOT_SCRIPT,
  THEME_COOKIE,
  readStoredTheme,
  readThemeCookie,
  resolveTheme,
} from "@/lib/theme"

// The contract under test: LIGHT is the default. A visitor with no stored
// choice gets light no matter what their OS prefers — dark and "system" are
// explicit opt-ins from Appearance settings. These tests pin the fallback in
// every layer that has one (browser read, boot script, cookie parse), because
// a regression here is invisible to every developer whose OS is in light mode.

describe("theme default", () => {
  beforeEach(() => {
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0`
    localStorage.clear()
  })

  it("readStoredTheme falls back to light with nothing stored", () => {
    expect(readStoredTheme()).toBe("light")
  })

  it("readStoredTheme honours an explicit opt-in", () => {
    localStorage.setItem("ts-theme", "dark")
    expect(readStoredTheme()).toBe("dark")
    localStorage.setItem("ts-theme", "system")
    expect(readStoredTheme()).toBe("system")
  })

  it("garbage in storage still lands on light", () => {
    localStorage.setItem("ts-theme", "midnight")
    expect(readStoredTheme()).toBe("light")
  })

  it("an absent or invalid cookie yields no preference", () => {
    expect(readThemeCookie("")).toBeNull()
    expect(readThemeCookie("ts-theme=midnight")).toBeNull()
    expect(readThemeCookie("ts-theme=dark")).toBe("dark")
  })

  it("only a stored 'system' consults the OS", () => {
    // A dark OS must not darken anyone who didn't opt in.
    expect(resolveTheme("light", true)).toBe("light")
    expect(resolveTheme("dark", false)).toBe("dark")
    expect(resolveTheme("system", true)).toBe("dark")
    expect(resolveTheme("system", false)).toBe("light")
  })

  it("the no-flash boot script defaults to light and stays out of public pages", () => {
    // The inline script duplicates the constants by design (nothing is loaded
    // when it runs), so the fallback has to be pinned as text.
    expect(THEME_BOOT_SCRIPT).toContain('t="light"')
    expect(THEME_BOOT_SCRIPT).not.toContain('t="system"')
    // The /app gate is what keeps every public surface light.
    expect(THEME_BOOT_SCRIPT).toContain('indexOf("/app/")')
  })
})
