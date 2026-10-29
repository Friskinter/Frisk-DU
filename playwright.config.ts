import { defineConfig, devices } from "@playwright/test";

// Tests de parcours dans un vrai navigateur, sur l'application compilée en mode test
// (lib/mode-test.ts) : données de démonstration, sans compte ni base de données.
const PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, locale: "fr-FR", timezoneId: "Europe/Paris", trace: "retain-on-failure" },
  projects: [
    { name: "ordinateur", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec\.ts/ },
    { name: "telephone", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/legal/mentions`,
    env: { NEXT_PUBLIC_FRISK_E2E: "1" },
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
  },
});
