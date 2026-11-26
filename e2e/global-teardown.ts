import { cleanupE2eProducts, loggedInApi } from "./api";

export default async function globalTeardown() {
  const api = await loggedInApi();
  await cleanupE2eProducts(api);
  await api.dispose();
}
