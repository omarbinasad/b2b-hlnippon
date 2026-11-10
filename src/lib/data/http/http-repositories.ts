/**
 * The REST implementation of `Repositories`, built from the endpoint table. Not used until DATA_SOURCE=http: see
 * `src/lib/data/index.ts`. Pure apart from `fetch`, so it can be tested with a fake one and no backend.
 */
import type { Repositories } from "../repositories";
import { ENDPOINTS, type CallParts, type EndpointSpec } from "./endpoints.ts";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface HttpConfig {
  /** e.g. https://api.example.com/api/v1. Server-side only; no secrets in NEXT_PUBLIC variables. */
  baseUrl: string;
  /** Forwards the signed-in user's session, e.g. the Cookie header. Read per request. */
  headers?: () => Promise<Record<string, string>> | Record<string, string>;
  fetch?: typeof fetch;
}

/** A query value, with empty values left out. Lists become comma-separated. */
function queryString(query: object | undefined) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    out.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  const s = out.toString();
  return s ? `?${s}` : "";
}

/** `{id?}` is for "create when null": POST without the id, PUT with it. */
export function buildRequest(spec: EndpointSpec<unknown[]>, parts: CallParts) {
  const [verb, route] = spec.route.split(" ");
  let method = verb;
  let path = route;
  const optional = /\/\{(\w+)\?\}/.exec(route);
  if (optional) {
    const value = parts.path?.[optional[1]];
    if (value === undefined || value === "") {
      method = "POST";
      path = route.replace(optional[0], "");
    } else path = route.replace(optional[0], `/${encodeURIComponent(String(value))}`);
  }
  path = path.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = parts.path?.[name];
    if (value === undefined) throw new Error(`Missing path value "${name}" for ${spec.route}`);
    return encodeURIComponent(String(value));
  });
  return { method, path: `${path}${queryString(parts.query)}`, body: parts.body };
}

async function errorOf(res: Response) {
  try {
    const body = (await res.json()) as { error?: { code?: string; message?: string; fields?: Record<string, string | string[]> } };
    const fields = Object.fromEntries(Object.entries(body.error?.fields ?? {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
    return { code: body.error?.code, message: body.error?.message ?? `Request failed (${res.status}).`, fields };
  } catch {
    return { code: undefined, message: `Request failed (${res.status}).`, fields: {} as Record<string, string> };
  }
}

function multipartBody(input: unknown) {
  const { bytes, fileName, ...rest } = input as { bytes: Uint8Array; fileName: string } & Record<string, unknown>;
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)]), fileName);
  for (const [k, v] of Object.entries(rest)) if (v !== undefined) form.set(k, String(v));
  return form;
}

export function createHttpRepositories(config: HttpConfig): Repositories {
  const doFetch = config.fetch ?? fetch;
  const base = config.baseUrl.replace(/\/$/, "");

  const call = (name: string, spec: EndpointSpec<unknown[]>) =>
    async (...args: unknown[]) => {
      const { method, path, body } = buildRequest(spec, spec.map?.(...args) ?? {});
      const form = spec.kind === "multipart";
      const res = await doFetch(`${base}${path}`, {
        method,
        // Customer prices and account data must never land in a shared cache.
        cache: "no-store",
        headers: { Accept: "application/json", ...(body !== undefined && !form ? { "Content-Type": "application/json" } : {}), ...(await config.headers?.()) },
        body: body === undefined ? undefined : form ? multipartBody(body) : JSON.stringify(body),
      });
      if (!res.ok) {
        if (spec.kind === "nullable" && res.status === 404) return null;
        const e = await errorOf(res);
        if ((spec.kind === "save" || form) && (res.status === 422 || res.status === 404 || res.status === 409)) return { ok: false, errors: e.fields, message: e.message };
        throw new ApiError(res.status, `${name}: ${e.message}`, e.code);
      }
      if (spec.kind === "void") return undefined;
      if (spec.kind === "binary") return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "application/octet-stream" };
      const data = res.status === 204 ? null : await res.json();
      return spec.kind === "save" || form ? { ok: true, value: data } : data;
    };

  const out: Record<string, Record<string, unknown>> = {};
  for (const [repo, methods] of Object.entries(ENDPOINTS)) {
    out[repo] = {};
    for (const [method, spec] of Object.entries(methods)) out[repo][method] = call(`${repo}.${method}`, spec as EndpointSpec<unknown[]>);
  }
  return out as unknown as Repositories;
}
