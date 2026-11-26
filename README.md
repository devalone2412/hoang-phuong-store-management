# vinext app

This project was created with create-vinext-app.

## Scripts

- `pnpm run dev` starts the vinext dev server.
- `pnpm run build` builds the Cloudflare Worker output.
- `pnpm run start` previews the built Worker locally.
- `pnpm run deploy` deploys the Cloudflare Worker.

- `npm test` runs the unit tests (vitest).
- `npm run typecheck` runs `tsc --noEmit`.

## End-to-end and responsive tests

`npm run e2e` runs the Playwright suite in `e2e/` against the dev server (it starts `npm run dev` if
nothing is listening on `http://localhost:5173`).

One-time setup: `npm run e2e:install` (downloads Chromium), or set `PW_CHROMIUM_PATH` to an existing
Chromium/Chrome binary.

The tests log in as the admin of the server under test, so tell them the credentials:

```sh
E2E_PASSWORD='your-dev-password' npm run e2e            # E2E_USERNAME defaults to "admin"
E2E_PASSWORD='...' npx playwright test --project=iphone-se   # one device
E2E_PASSWORD='...' npx playwright test layout                # one spec
```

What it covers, on **9 device profiles** (iPhone SE portrait + landscape, iPhone 14 Pro Max, Pixel 7,
Galaxy S9+, iPad Mini portrait + landscape, 1366px laptop, 1920px desktop; all Chromium with device
emulation):

- no sideways scrolling or off-screen elements on login, lookup, products, the product form and the
  barcode scanner; tap targets of at least 32px on touch devices; dialogs fit the viewport
- pagination on the lookup and products pages (page numbers, page size, reset on a new query/filter,
  selection cleared on navigation), very long product names
- barcode scanner opens with a (fake) live camera stream
- login hardening: no password in the URL, no `<input>` in the server HTML, pages and API need a session
- flows (iPhone SE + laptop only): delete the last page and Undo; create a product with a photo and combos

Test data is created by `e2e/global-setup.ts` (120 products plus a long-named one, all named `E2E …`) and
deleted again in `e2e/global-teardown.ts`; real products are never touched. Against a local dev server the
setup also applies `migrations/*.sql` to the local database. Set `E2E_BASE_URL` to point at another server
(then apply migrations yourself).
