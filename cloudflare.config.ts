import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "hoang-phuong-store",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-26",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "hp-store-db" }),
      IMAGES: bindings.r2({ name: "hp-store-images" }),
      ADMIN_USERNAME: bindings.secret(),
      ADMIN_PASSWORD_HASH: bindings.secret(),
      SESSION_SECRET: bindings.secret(),
    },
  }),
});
