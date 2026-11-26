import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  // Dev only: lets `cf tunnels quick-start` URLs reach the dev server (for testing on a phone over HTTPS).
  server: {
    allowedHosts: [".trycloudflare.com"],
    // Playwright writes reports/traces/screenshots inside the project; without this, Vite hot-reloads
    // the page under test whenever one of them changes.
    watch: { ignored: ["**/test-results/**", "**/playwright-report/**", "**/e2e/.auth/**"] },
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
