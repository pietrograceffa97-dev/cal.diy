import { defineConfig, devices } from "@playwright/test";

/**
 * Standalone config for the production smoke suite.
 *
 * Deliberately shares NOTHING with the repo's root playwright.config.ts. That
 * one boots the whole app (`webServer`), imports `@calcom/lib/constants` and
 * needs a seeded database — it tests a build. This one tests whatever is
 * already live at `baseURL`, so it needs no database, no env file, no install
 * of the monorepo, and it cannot be broken by a build that is red.
 *
 * `||` rather than `??`: an unset GitHub Actions variable arrives as the empty
 * string, which `??` would pass straight through as the base URL.
 */
const baseURL = process.env.SMOKE_BASE_URL || "https://cal-diy-web-eight.vercel.app";

export default defineConfig({
  testDir: ".",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // One retry in CI only. A cold Vercel start is genuinely slow, and a smoke
  // suite that cries wolf gets ignored — which costs more than the extra
  // minute. Locally, no retries: a flake should be visible while you work.
  retries: process.env.CI ? 1 : 0,

  timeout: 90_000,
  expect: { timeout: 30_000 },

  reporter: process.env.CI
    ? [["list"], ["json", { outputFile: "report.json" }], ["html", { open: "never" }]]
    : [["list"]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
  },
});
