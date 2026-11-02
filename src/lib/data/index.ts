import "server-only";

import { mockRepositories } from "./mock-repositories";
import type { Repositories } from "./repositories";

export type * from "./repositories";

/**
 * Single swap point for the data source. When the backend is ready, add an
 * API implementation of `Repositories` and select it here (e.g. by env var).
 */
export const repositories: Repositories = mockRepositories;
