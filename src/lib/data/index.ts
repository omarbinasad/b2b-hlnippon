import "server-only";

import { createHttpRepositories } from "./http/http-repositories";
import { mockRepositories } from "./mock-repositories";
import type { Repositories } from "./repositories";

export type * from "./repositories";

/**
 * Single swap point for the data source: the mock by default, or the REST backend with DATA_SOURCE=http and API_BASE_URL.
 * Pages and components don't change. See docs/BACKEND-INTEGRATION-GUIDE.md. The session cookie is forwarded so the
 * backend sees the signed-in user.
 */
function fromHttp(): Repositories {
  const baseUrl = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error("DATA_SOURCE=http needs API_BASE_URL, e.g. https://api.example.com/api/v1");
  return createHttpRepositories({
    baseUrl,
    headers: async (): Promise<Record<string, string>> => {
      const { cookies } = await import("next/headers");
      const cookie = (await cookies()).toString();
      return cookie ? { Cookie: cookie } : {};
    },
  });
}

export const repositories: Repositories = process.env.DATA_SOURCE === "http" ? fromHttp() : mockRepositories;
