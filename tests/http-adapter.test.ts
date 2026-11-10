import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ALL_CAPABILITIES } from "../src/lib/auth/capabilities.ts";
import { ENDPOINTS } from "../src/lib/data/http/endpoints.ts";
import { ApiError, buildRequest, createHttpRepositories } from "../src/lib/data/http/http-repositories.ts";

type Seen = { url: string; init: RequestInit };

function fake(responses: (url: string, init: RequestInit) => Response) {
  const calls: Seen[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return responses(url, init);
  }) as unknown as typeof fetch;
  return { calls, f };
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const repos = (f: typeof fetch) => createHttpRepositories({ baseUrl: "https://api.test/api/v1/", fetch: f, headers: () => ({ Cookie: "s=1" }) });

describe("endpoint table", () => {
  it("every route is valid and unique", () => {
    const seen = new Map<string, string>();
    for (const [repo, methods] of Object.entries(ENDPOINTS)) {
      for (const [method, spec] of Object.entries(methods)) {
        assert.match((spec as { route: string }).route, /^(GET|POST|PUT|PATCH|DELETE) \/\S*$/, `${repo}.${method}`);
        const route = (spec as { route: string }).route;
        assert.ok(!seen.has(route), `${route} is used by ${seen.get(route)} and ${repo}.${method}`);
        seen.set(route, `${repo}.${method}`);
      }
    }
  });
  it("every endpoint names who may call it", () => {
    for (const methods of Object.values(ENDPOINTS)) for (const spec of Object.values(methods)) assert.ok((spec as { perm: string }).perm);
  });
  it("every permission is a real capability", () => {
    const others = new Set(["public", "customer", "demo only"]);
    for (const [repo, methods] of Object.entries(ENDPOINTS)) {
      for (const [method, spec] of Object.entries(methods)) {
        for (const perm of (spec as { perm: string }).perm.split(" or ")) assert.ok(others.has(perm) || ALL_CAPABILITIES.includes(perm), `${repo}.${method}: ${perm}`);
      }
    }
  });
  it("routes with path values have a mapping that supplies them", () => {
    for (const [repo, methods] of Object.entries(ENDPOINTS)) {
      for (const [method, spec] of Object.entries(methods)) {
        const s = spec as { route: string; map?: unknown };
        if (/\{\w+\??\}/.test(s.route)) assert.ok(s.map, `${repo}.${method}`);
      }
    }
  });
});

describe("requests", () => {
  it("puts path values and queries in the URL, leaving out empty ones", async () => {
    const { calls, f } = fake(() => json({ items: [] }));
    await repos(f).products.adminList({ search: "rice", status: "draft", sort: undefined, page: 2 });
    assert.equal(calls[0].url, "https://api.test/api/v1/admin/products?search=rice&status=draft&page=2");
    assert.equal(calls[0].init.method, "GET");
  });
  it("sends JSON with the session and never caches", async () => {
    const { calls, f } = fake(() => json({ id: "1" }));
    await repos(f).coupons.save("c1", { code: "A" } as never, { id: "a", name: "n", role: "admin" });
    assert.equal(calls[0].url, "https://api.test/api/v1/admin/coupons/c1");
    assert.equal(calls[0].init.method, "PUT");
    assert.equal(calls[0].init.cache, "no-store");
    assert.equal((calls[0].init.headers as Record<string, string>).Cookie, "s=1");
    assert.equal(calls[0].init.body, JSON.stringify({ code: "A" }));
  });
  it("never sends the actor: the backend uses the session", async () => {
    const { calls, f } = fake(() => json({}));
    await repos(f).pages.save("p1", { title: "T" } as never, { id: "secret-actor", name: "n", role: "admin" });
    assert.ok(!String(calls[0].init.body).includes("secret-actor"));
  });
  it("creating uses POST without an id", async () => {
    const { calls, f } = fake(() => json({ id: "1" }));
    await repos(f).coupons.save(null, { code: "A" } as never, { id: "a", name: "n", role: "admin" });
    assert.equal(calls[0].url, "https://api.test/api/v1/admin/coupons");
    assert.equal(calls[0].init.method, "POST");
  });
  it("encodes path values", async () => {
    const { calls, f } = fake(() => new Response(null, { status: 204 }));
    await repos(f).posts.deleteTerm("tag", "a/b c");
    assert.ok(calls[0].url.endsWith("/admin/post-terms/tag/a%2Fb%20c"));
  });
  it("the signed-in customer isn't taken from the caller", async () => {
    const { calls, f } = fake(() => json({ lines: [] }));
    await repos(f).cart.get("someone-else");
    assert.ok(!calls[0].url.includes("someone-else"));
  });
  it("refuses a route missing a path value", () => {
    assert.throws(() => buildRequest({ route: "GET /x/{id}", perm: "public" }, {}), /Missing path value/);
  });
});

describe("responses", () => {
  it("wraps a saved value", async () => {
    const { f } = fake(() => json({ id: "1" }));
    assert.deepEqual(await repos(f).coupons.save(null, {} as never, { id: "a", name: "n", role: "admin" }), { ok: true, value: { id: "1" } });
  });
  it("turns 422 into field errors the forms already show", async () => {
    const { f } = fake(() => json({ error: { code: "validation_failed", message: "Check it", fields: { code: ["Taken"], amount: "Bad" } } }, 422));
    assert.deepEqual(await repos(f).coupons.save(null, {} as never, { id: "a", name: "n", role: "admin" }), { ok: false, errors: { code: "Taken", amount: "Bad" }, message: "Check it" });
  });
  it("404 is null where a missing record is normal", async () => {
    const { f } = fake(() => json({ error: { code: "not_found" } }, 404));
    assert.equal(await repos(f).orders.getById("x"), null);
  });
  it("other failures throw with the status and code", async () => {
    const { f } = fake(() => json({ error: { code: "forbidden", message: "No" } }, 403));
    await assert.rejects(() => repos(f).orders.list(), (e: ApiError) => e.status === 403 && e.code === "forbidden");
    const { f: f2 } = fake(() => json({ error: { code: "forbidden", message: "No" } }, 403));
    await assert.rejects(() => repos(f2).coupons.save(null, {} as never, { id: "a", name: "n", role: "admin" }), ApiError);
  });
  it("a void call returns nothing", async () => {
    const { f } = fake(() => new Response(null, { status: 204 }));
    assert.equal(await repos(f).coupons.remove("1", { id: "a", name: "n", role: "admin" }), undefined);
  });
  it("uploads as multipart, without a JSON header", async () => {
    const { calls, f } = fake(() => json({ id: "m1" }));
    const r = await repos(f).media.upload({ fileName: "a.png", bytes: new Uint8Array([1, 2]), width: 5 }, { id: "a", name: "n", role: "admin" });
    assert.ok(calls[0].init.body instanceof FormData);
    assert.equal((calls[0].init.headers as Record<string, string>)["Content-Type"], undefined);
    assert.deepEqual(r, { ok: true, value: { id: "m1" } });
  });
  it("binary downloads keep their type", async () => {
    const { f } = fake(() => new Response(new Uint8Array([9]), { headers: { "Content-Type": "image/png" } }));
    const r = await repos(f).media.content("m1");
    assert.equal(r?.contentType, "image/png");
    assert.deepEqual([...r!.bytes], [9]);
  });
});
