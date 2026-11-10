/**
 * Writes docs/API-CONTRACTS.md and docs/openapi.yaml from the code: routes and permissions from the endpoint table, and
 * every type from the repository signatures, so the contract can't drift from what the frontend calls.
 *
 *   npm run docs:api
 *
 * Reads scripts/api-docs/preamble.md (conventions) and scripts/api-docs/extra-endpoints.json (auth, PDFs and exports,
 * which aren't repository methods). Prints a warning for any table type name that doesn't match the real signature.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { ENDPOINTS } from "../src/lib/data/http/endpoints.ts";

type Schema = Record<string, unknown>;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(join(ROOT, "tsconfig.json"), ts.sys.readFile).config, ts.sys, ROOT);
const REPO_FILE = join(ROOT, "src/lib/data/repositories.ts").replace(/\\/g, "/");
const program = ts.createProgram([REPO_FILE], { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();
const source = program.getSourceFile(REPO_FILE);
if (!source) throw new Error("repositories.ts not found");

const components = new Map<string, Schema>();
const descriptions = (symbol: ts.Symbol) => ts.displayPartsToString(symbol.getDocumentationComment(checker)).replace(/\s+/g, " ").trim();
const inProject = (symbol?: ts.Symbol) => !!symbol?.declarations?.some((d) => d.getSourceFile().fileName.replace(/\\/g, "/").includes("/src/"));
const flag = (t: ts.Type, f: ts.TypeFlags) => (t.flags & f) !== 0;

function namedSymbol(type: ts.Type) {
  const alias = type.aliasSymbol;
  if (alias && inProject(alias) && !type.aliasTypeArguments?.length) return alias;
  if (alias) return undefined;
  const symbol = type.getSymbol();
  const generic = (type as ts.TypeReference).typeArguments?.length;
  if (symbol && inProject(symbol) && !generic && !symbol.name.startsWith("__")) return symbol;
  return undefined;
}

function toSchema(type: ts.Type, depth = 0): Schema {
  if (depth > 14) return { type: "object", description: "Nested further; see the type it repeats." };
  if (type.isUnion()) {
    const parts = type.types.filter((t) => !flag(t, ts.TypeFlags.Undefined));
    const nullable = parts.some((t) => flag(t, ts.TypeFlags.Null));
    const rest = parts.filter((t) => !flag(t, ts.TypeFlags.Null));
    const name = namedSymbol(type);
    if (name && !nullable && rest.length === parts.length && parts.length === type.types.length) return ref(name, type, () => unionSchema(rest, depth));
    const out = unionSchema(rest, depth);
    return nullable ? { ...out, nullable: true } : out;
  }
  if (flag(type, ts.TypeFlags.String | ts.TypeFlags.TemplateLiteral)) return { type: "string" };
  if (flag(type, ts.TypeFlags.Number)) return { type: "number" };
  if (flag(type, ts.TypeFlags.Boolean)) return { type: "boolean" };
  if (type.isStringLiteral()) return { type: "string", enum: [type.value] };
  if (type.isNumberLiteral()) return { type: "number", enum: [type.value] };
  if (flag(type, ts.TypeFlags.BooleanLiteral)) return { type: "boolean" };
  if (flag(type, ts.TypeFlags.Null)) return { nullable: true };
  if (flag(type, ts.TypeFlags.Void | ts.TypeFlags.Undefined | ts.TypeFlags.Never)) return {};
  if (flag(type, ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return {};
  if (checker.isArrayType(type) || checker.isTupleType(type)) {
    const args = checker.getTypeArguments(type as ts.TypeReference);
    if (checker.isTupleType(type)) return { type: "array", items: {}, minItems: args.length, maxItems: args.length };
    return { type: "array", items: toSchema(args[0], depth + 1) };
  }
  const symbolName = type.getSymbol()?.name;
  if (symbolName === "Uint8Array" || symbolName === "Blob" || symbolName === "File") return { type: "string", format: "binary" };
  if (symbolName === "Date") return { type: "string", format: "date-time" };
  if (symbolName === "Set") return { type: "array" };
  const name = namedSymbol(type);
  return name ? ref(name, type, () => objectSchema(type, depth)) : objectSchema(type, depth);
}

function unionSchema(parts: ts.Type[], depth: number): Schema {
  if (parts.every((t) => t.isStringLiteral())) return { type: "string", enum: parts.map((t) => (t as ts.StringLiteralType).value) };
  if (parts.every((t) => flag(t, ts.TypeFlags.BooleanLiteral))) return { type: "boolean" };
  if (parts.length === 1) return toSchema(parts[0], depth + 1);
  return { oneOf: parts.map((t) => toSchema(t, depth + 1)) };
}

function ref(symbol: ts.Symbol, type: ts.Type, build: () => Schema): Schema {
  const name = symbol.name;
  if (!components.has(name)) {
    components.set(name, {});
    const built = build();
    const doc = descriptions(symbol);
    components.set(name, doc ? { description: doc, ...built } : built);
  }
  return { $ref: `#/components/schemas/${name}` };
}

function objectSchema(type: ts.Type, depth: number): Schema {
  const properties: Record<string, Schema> = {};
  const required: string[] = [];
  for (const prop of checker.getPropertiesOfType(type)) {
    const decl = prop.valueDeclaration ?? prop.declarations?.[0];
    const propType = checker.getTypeOfSymbolAtLocation(prop, decl ?? source!);
    if (propType.getCallSignatures().length) continue;
    const schema = toSchema(propType, depth + 1);
    const doc = descriptions(prop);
    properties[prop.name] = doc ? { ...schema, description: doc } : schema;
    if (!(prop.flags & ts.SymbolFlags.Optional)) required.push(prop.name);
  }
  const index = checker.getIndexInfoOfType(type, ts.IndexKind.String);
  const out: Schema = { type: "object" };
  if (Object.keys(properties).length) out.properties = properties;
  if (required.length) out.required = required;
  if (index) out.additionalProperties = toSchema(index.type, depth + 1);
  return out;
}

// --- The repository signatures ------------------------------------------------------------------

const reposSymbol = checker.getSymbolAtLocation((source as unknown as { symbol: ts.Symbol }).symbol.valueDeclaration as ts.Node)?.exports?.get(ts.escapeLeadingUnderscores("Repositories")) ?? checker.getExportsOfModule(checker.getSymbolAtLocation(source)!).find((s) => s.name === "Repositories");
if (!reposSymbol) throw new Error("Repositories interface not found");
const reposType = checker.getDeclaredTypeOfSymbol(reposSymbol);
const warnings: string[] = [];

function unwrapReturn(type: ts.Type): { schema: Schema; text: string } {
  let t = type;
  if (t.getSymbol()?.name === "Promise") t = checker.getTypeArguments(t as ts.TypeReference)[0];
  const text = checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation);
  // SaveResult<T>: the wire carries T on success and the error shape otherwise.
  if (t.aliasSymbol?.name === "SaveResult" && t.aliasTypeArguments?.length) {
    const inner = t.aliasTypeArguments[0];
    return { schema: toSchema(inner), text: checker.typeToString(inner, undefined, ts.TypeFormatFlags.NoTruncation) };
  }
  if (t.isUnion()) {
    const ok = t.types.find((m) => checker.getPropertyOfType(m, "ok") && checker.getPropertyOfType(m, "value"));
    if (ok && t.types.every((m) => checker.getPropertyOfType(m, "ok"))) {
      const value = checker.getPropertyOfType(ok, "value")!;
      const inner = checker.getTypeOfSymbolAtLocation(value, source!);
      return { schema: toSchema(inner), text: checker.typeToString(inner, undefined, ts.TypeFormatFlags.NoTruncation) };
    }
  }
  return { schema: toSchema(t), text };
}

interface Param { name: string; optional: boolean; type: ts.Type; text: string }

function signatureOf(repo: string, method: string) {
  const repoProp = checker.getPropertyOfType(reposType, repo);
  if (!repoProp) throw new Error(`No repository ${repo}`);
  const repoType = checker.getTypeOfSymbolAtLocation(repoProp, source!);
  const prop = checker.getPropertyOfType(repoType, method);
  if (!prop) throw new Error(`No method ${repo}.${method}`);
  const sig = checker.getTypeOfSymbolAtLocation(prop, source!).getCallSignatures()[0];
  const params: Param[] = sig.getParameters().map((p) => {
    const type = checker.getTypeOfSymbolAtLocation(p, source!);
    const optional = !!(p.flags & ts.SymbolFlags.Optional) || !!(p.valueDeclaration && ts.isParameter(p.valueDeclaration) && p.valueDeclaration.questionToken);
    return { name: p.name, optional, type, text: checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation) };
  });
  return { params, returns: sig.getReturnType(), doc: descriptions(prop) };
}

// Runs each mapper with placeholders to see which argument lands where in the request.
const SENTINEL = Symbol("arg");
function sentinel(index: number): unknown {
  return new Proxy({}, {
    get(_t, key) {
      if (key === SENTINEL) return index;
      if (key === Symbol.toPrimitive) return () => `arg${index}`;
      if (key === "join") return () => sentinel(index);
      if (key === "range" || key === "compare" || key === "from" || key === "to") return sentinel(index);
      return undefined;
    },
    ownKeys: () => [],
  });
}
const argOf = (v: unknown): number | undefined => {
  if ((typeof v === "function" || typeof v === "object") && v !== null) {
    const i = (v as Record<symbol, unknown>)[SENTINEL];
    return typeof i === "number" ? i : undefined;
  }
  return undefined;
};

interface Row {
  repo: string; method: string; verb: string; path: string; perm: string; note?: string; kind?: string; doc: string;
  pathParams: { name: string; schema: Schema }[];
  queryParams: { name: string; schema: Schema; required: boolean }[];
  body?: { schema: Schema; label: string; multipart?: boolean };
  response?: { schema: Schema; label: string };
  args: string;
  createVariant?: boolean;
}

const isActor = (p: Param) => p.name === "actor";
const typeLabel = (s: Schema, fallback: string) => (typeof s.$ref === "string" ? s.$ref.split("/").pop()! : fallback);

function buildRow(repo: string, method: string, spec: { route: string; perm: string; note?: string; req?: string; res?: string; kind?: string; map?: (...a: unknown[]) => { path?: object; query?: object; body?: unknown } }): Row {
  const { params, returns, doc } = signatureOf(repo, method);
  const usable = params.filter((p) => !isActor(p));
  const [verb, rawPath] = spec.route.split(" ");
  let parts: { path?: object; query?: object; body?: unknown } = {};
  try {
    parts = spec.map?.(...params.map((_, i) => sentinel(i))) ?? {};
  } catch (e) {
    warnings.push(`${repo}.${method}: mapper couldn't be traced (${(e as Error).message}); see the arguments listed.`);
  }
  const paramAt = (v: unknown) => { const i = argOf(v); return i === undefined ? undefined : params[i]; };
  const fieldsOf = (obj: object) => Object.entries(obj).map(([name, v]) => ({ name, param: paramAt(v) }));

  const pathParams = rawPath.match(/\{(\w+)\??\}/g)?.map((m) => {
    const name = m.replace(/[{}?]/g, "");
    const param = paramAt((parts.path as Record<string, unknown> | undefined)?.[name]) ;
    const schema = param ? toSchema(param.type) : { type: "string" };
    return { name, schema: schema.nullable ? { type: "string" } : schema };
  }) ?? [];

  const queryParams: Row["queryParams"] = [];
  const q = parts.query as object | undefined;
  if (q) {
    const whole = argOf(q);
    if (whole !== undefined) {
      // A whole object as the query: list its properties.
      const t = checker.getNonNullableType(params[whole].type);
      for (const prop of checker.getPropertiesOfType(t)) {
        const schema = toSchema(checker.getTypeOfSymbolAtLocation(prop, source!));
        const d = descriptions(prop);
        queryParams.push({ name: prop.name, schema: d ? { ...schema, description: d } : schema, required: !(prop.flags & ts.SymbolFlags.Optional) });
      }
    } else {
      for (const { name, param } of fieldsOf(q)) if (param && argOf((q as Record<string, unknown>)[name]) !== undefined) queryParams.push({ name, schema: toSchema(param.type), required: !param.optional });
    }
  }
  // Spread options ({ q: term, ...options }) can't be traced: add the option object's own fields.
  if (spec.map && q && /\.\.\.(options|query)/.test(spec.map.toString())) {
    const options = usable.find((p) => p.name === "options" || p.name === "query");
    if (options) for (const prop of checker.getPropertiesOfType(checker.getNonNullableType(options.type))) {
      // Set to undefined by the mapper means "never sent".
      if (prop.name in q && (q as Record<string, unknown>)[prop.name] === undefined) continue;
      if (!queryParams.some((r) => r.name === prop.name)) queryParams.push({ name: prop.name, schema: toSchema(checker.getTypeOfSymbolAtLocation(prop, source!)), required: false });
    }
  }

  let body: Row["body"];
  if (parts.body !== undefined) {
    const whole = paramAt(parts.body);
    if (whole) {
      const schema = toSchema(checker.getNonNullableType(whole.type));
      body = { schema, label: typeLabel(schema, whole.text), multipart: spec.kind === "multipart" };
    } else if (typeof parts.body === "object") {
      const properties: Record<string, Schema> = {};
      const required: string[] = [];
      for (const { name, param } of fieldsOf(parts.body as object)) {
        properties[name] = param ? toSchema(param.type) : {};
        if (param && !param.optional) required.push(name);
      }
      // Spread input ({ zone, ...input }) can't be traced: add its fields.
      if (spec.map && /\.\.\.input/.test(spec.map.toString())) {
        const input = usable.find((p) => p.name === "input");
        if (input) for (const prop of checker.getPropertiesOfType(checker.getNonNullableType(input.type))) {
          properties[prop.name] = toSchema(checker.getTypeOfSymbolAtLocation(prop, source!));
          if (!(prop.flags & ts.SymbolFlags.Optional)) required.push(prop.name);
        }
      }
      body = { schema: { type: "object", properties, ...(required.length ? { required } : {}) }, label: `{ ${Object.keys(properties).join(", ")} }` };
    }
  }

  let response: Row["response"];
  if (spec.kind !== "void" && spec.kind !== "binary") {
    const { schema, text } = unwrapReturn(returns);
    if (text !== "void" && text !== "undefined") response = { schema, label: typeLabel(schema, text) };
  }

  // The table's names are a reader's shorthand. Check them against the real signature.
  if (spec.res && response) {
    const base = spec.res.replace(/^Paginated<|>$|\[\]$/g, "");
    if (!checker.typeToString(checker.getAwaitedType(returns) ?? returns, undefined, ts.TypeFormatFlags.NoTruncation).includes(base)) warnings.push(`${repo}.${method}: table says ${spec.res}, signature returns ${response.label}`);
  }
  if (spec.req && body && !body.label.includes(spec.req) && !JSON.stringify(body.schema).includes(spec.req)) warnings.push(`${repo}.${method}: table says request ${spec.req}, signature gives ${body.label}`);

  return {
    repo, method, verb, path: rawPath, perm: spec.perm, note: spec.note, kind: spec.kind, doc,
    pathParams, queryParams, body, response,
    args: usable.map((p) => `${p.name}${p.optional ? "?" : ""}: ${p.text}`).join(", "),
    createVariant: /\{\w+\?\}/.test(rawPath),
  };
}

const rows: Row[] = [];
for (const [repo, methods] of Object.entries(ENDPOINTS)) {
  for (const [method, spec] of Object.entries(methods)) rows.push(buildRow(repo, method, spec as never));
}

// Pull the named input types in too, so every one is documented.
for (const [name, schema] of [...components]) if (!Object.keys(schema).length) warnings.push(`Empty type: ${name}`);

// --- Writers ------------------------------------------------------------------------------------

const TOPICS: Record<string, string> = {
  company: "Company settings and branding", media: "Media", staff: "Staff and roles", emails: "Email templates and logs", reminders: "Location-based reminders", coupons: "Coupons",
  savedLists: "Saved lists", quotations: "Quotations", adminNotifications: "Admin notifications", contact: "Contact form", posts: "Blog posts", pages: "Pages", navigation: "Navigation menus",
  siteContent: "Homepage content", products: "Products and inventory", categories: "Categories", catalogSettings: "Brands, tags, attributes and classes", pricing: "Price rules", quantityRules: "Quantity rules",
  customers: "Customers, registration, approval, addresses and groups", orders: "Orders, checkout, adjustments, delivered weight, refunds and invoices", cart: "Cart and quick order", delivery: "Delivery schedules", locations: "Postcode lookup",
  settings: "Store settings", shipping: "Shipping zones, methods, rules, classes and pickup", tax: "Tax", payments: "Payment methods", analytics: "Reports and dashboard",
};

const schemaText = (s: Schema): string => {
  if (s.$ref) { const n = String(s.$ref).split("/").pop(); return `[${n}](#${n!.toLowerCase()})`; }
  if (s.enum) return (s.enum as unknown[]).map((v) => `\`${v}\``).join(" \\| ");
  if (s.oneOf) return (s.oneOf as Schema[]).map(schemaText).join(" or ");
  if (s.type === "array") return `${schemaText((s.items as Schema) ?? {})}[]`;
  if (s.type === "object" && s.properties) return `{ ${Object.keys(s.properties as object).join(", ")} }`;
  if (s.type === "object" && s.additionalProperties) return `map of ${schemaText(s.additionalProperties as Schema)}`;
  return String(s.format ?? s.type ?? "any");
};
const withNull = (s: Schema) => schemaText(s) + (s.nullable ? " or null" : "");
const cell = (s: unknown) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");

function sample(s: Schema, depth = 0, seen: string[] = []): unknown {
  if (s.$ref) {
    const n = String(s.$ref).split("/").pop()!;
    if (seen.includes(n) || depth > 3) return `<${n}>`;
    return sample(components.get(n) ?? {}, depth, [...seen, n]);
  }
  if (s.enum) return (s.enum as unknown[])[0];
  if (s.oneOf) return sample((s.oneOf as Schema[])[0], depth, seen);
  if (s.type === "string") return s.format === "binary" ? "<file>" : "string";
  if (s.type === "number") return 0;
  if (s.type === "boolean") return true;
  if (s.type === "array") return [sample((s.items as Schema) ?? {}, depth + 1, seen)];
  if (s.type === "object" || s.properties) {
    const out: Record<string, unknown> = {};
    const req = new Set((s.required as string[]) ?? []);
    for (const [k, v] of Object.entries((s.properties as Record<string, Schema>) ?? {})) if (req.has(k)) out[k] = sample(v, depth + 1, seen);
    return out;
  }
  return null;
}

function contractMarkdown(preamble: string, extras: Extra[]) {
  const out: string[] = [preamble.trim(), ""];
  out.push("## Endpoints", "", `${rows.length + extras.length} endpoints. Generated from \`src/lib/data/http/endpoints.ts\` and the repository signatures by \`npm run docs:api\`: don't edit this part by hand. "Save" endpoints return the record on success and 422 with field errors otherwise. Every list takes \`page\`, \`perPage\`, \`sort\`, \`dir\` as described above.`, "");
  out.push("### Sign-in, sessions, documents and exports", "", "These aren't repository methods: the demo only imitates them.", "");
  for (const e of extras) {
    out.push(`#### \`${e.route}\``, "", `**Permission:** ${e.perm}`, "");
    if (e.note) out.push(e.note, "");
    if (e.body) out.push("Request JSON:", "", "```json", JSON.stringify(e.body, null, 2), "```", "");
    if (e.response) out.push(`Response ${e.status ?? 200}:`, "", "```json", JSON.stringify(e.response, null, 2), "```", "");
    if (e.responseType) out.push(`Response: \`${e.responseType}\``, "");
  }
  const byRepo = new Map<string, Row[]>();
  for (const r of rows) byRepo.set(r.repo, [...(byRepo.get(r.repo) ?? []), r]);
  for (const [repo, list] of byRepo) {
    out.push(`### ${TOPICS[repo] ?? repo}`, "");
    for (const r of list) {
      out.push(`#### \`${r.verb} ${r.path}\``, "");
      out.push(`**Permission:** ${r.perm} · **Frontend call:** \`${r.repo}.${r.method}(${cell(r.args)})\``, "");
      if (r.doc) out.push(r.doc, "");
      if (r.note) out.push(`**Rule:** ${r.note}`, "");
      if (r.createVariant) out.push(`Without the id this is \`POST ${r.path.replace(/\/\{\w+\?\}/, "")}\` (create).`, "");
      if (r.pathParams.length) out.push(`**Path:** ${r.pathParams.map((p) => `\`${p.name}\` (${withNull(p.schema)})`).join(", ")}`, "");
      if (r.queryParams.length) {
        out.push("**Query:**", "", "| Param | Type | Required | Notes |", "|---|---|---|---|");
        for (const q of r.queryParams) out.push(`| \`${q.name}\` | ${cell(withNull(q.schema))} | ${q.required ? "yes" : "no"} | ${cell(q.schema.description)} |`);
        out.push("");
      }
      if (r.body) {
        if (r.body.multipart) out.push(`**Request:** multipart/form-data, \`file\` plus the fields of ${schemaText(r.body.schema)}`, "");
        else {
          out.push(`**Request JSON:** ${schemaText(r.body.schema)}`, "", "```json", JSON.stringify(sample(r.body.schema)), "```", "");
        }
      }
      if (r.kind === "binary") out.push("**Response 200:** the file's bytes, with its Content-Type. Never publicly cached unless the file is public.", "");
      else if (r.kind === "void") out.push("**Response:** 204, no body.", "");
      else if (r.response) out.push(`**Response 200:** ${withNull(r.response.schema)}`, "");
      const errors = ["401", "403"];
      if (r.perm === "public") errors.length = 0;
      if (r.kind === "nullable" || r.pathParams.length) errors.push("404");
      if (r.kind === "save") errors.push("409", "422");
      if (r.body && r.kind !== "save") errors.push("422");
      if (errors.length) out.push(`**Errors:** ${errors.join(", ")}`, "");
    }
  }
  out.push("## Types", "", "JSON Schema for all of these is in `openapi.yaml`.", "");
  for (const [name, schema] of [...components].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(`### ${name}`, "");
    if (schema.description) out.push(String(schema.description), "");
    if (schema.properties) {
      const req = new Set((schema.required as string[]) ?? []);
      out.push("| Field | Type | Required | Notes |", "|---|---|---|---|");
      for (const [k, v] of Object.entries(schema.properties as Record<string, Schema>)) out.push(`| \`${k}\` | ${cell(withNull(v))} | ${req.has(k) ? "yes" : "no"} | ${cell(v.description)} |`);
      out.push("");
    } else out.push(`Type: ${withNull(schema)}`, "");
  }
  return `${out.join("\n")}\n`;
}

// A small YAML writer: enough for this shape, and no new dependency.
function yaml(v: unknown, indent = 0): string {
  const pad = " ".repeat(indent);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    return `\n${v.map((item) => { const y = yaml(item, indent + 2); return `${pad}- ${y.startsWith("\n") ? y.trimStart() : y}`; }).join("\n")}`;
  }
  if (v && typeof v === "object") {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined);
    if (!entries.length) return "{}";
    return `\n${entries.map(([k, x]) => { const y = yaml(x, indent + 2); return `${pad}${JSON.stringify(k)}:${y.startsWith("\n") ? y : ` ${y}`}`; }).join("\n")}`;
  }
  return JSON.stringify(v);
}

interface Extra { route: string; perm: string; note?: string; body?: unknown; response?: unknown; responseType?: string; status?: number }

function openapi(extras: Extra[]) {
  const paths: Record<string, Record<string, unknown>> = {};
  const errorRef = (description: string) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/ApiError" } } } });
  const add = (verb: string, path: string, op: Record<string, unknown>) => { (paths[path] ??= {})[verb.toLowerCase()] = op; };
  const seenOps = new Set<string>();
  const opBase = (r: Row, verb: string, path: string, withId: boolean): Record<string, unknown> => {
    const pathParams = withId ? r.pathParams : r.pathParams.filter((p) => !new RegExp(`\\{${p.name}\\?\\}`).test(r.path));
    const parameters = [
      ...pathParams.map((p) => ({ name: p.name, in: "path", required: true, schema: p.schema })),
      ...r.queryParams.map((q) => ({ name: q.name, in: "query", required: q.required, schema: q.schema })),
    ];
    const responses: Record<string, unknown> = {};
    if (r.kind === "void") responses["204"] = { description: "Done" };
    else if (r.kind === "binary") responses["200"] = { description: "The file", content: { "application/octet-stream": { schema: { type: "string", format: "binary" } } } };
    else responses["200"] = { description: "OK", ...(r.response ? { content: { "application/json": { schema: r.response.schema } } } : {}) };
    if (r.perm !== "public") { responses["401"] = errorRef("Not signed in"); responses["403"] = errorRef("Missing permission"); }
    if (r.kind === "nullable" || pathParams.length) responses["404"] = errorRef("Not found");
    if (r.kind === "save" || r.body) responses["422"] = errorRef("Validation failed");
    if (r.kind === "save") responses["409"] = errorRef("Conflict");
    let operationId = `${r.repo}_${r.method}${withId ? "" : "_create"}`;
    if (seenOps.has(operationId)) operationId += `_${verb.toLowerCase()}`;
    seenOps.add(operationId);
    return {
      operationId, tags: [TOPICS[r.repo] ?? r.repo], summary: `${r.repo}.${r.method}`,
      description: [`Permission: ${r.perm}.`, r.doc, r.note].filter(Boolean).join(" "),
      ...(parameters.length ? { parameters } : {}),
      ...(r.body ? { requestBody: { required: true, content: { [r.body.multipart ? "multipart/form-data" : "application/json"]: { schema: r.body.schema } } } } : {}),
      responses,
    };
  };
  for (const r of rows) {
    if (r.createVariant) {
      add(r.verb, r.path.replace(/\{(\w+)\?\}/, "{$1}"), opBase(r, r.verb, r.path, true));
      add("POST", r.path.replace(/\/\{\w+\?\}/, ""), opBase(r, "POST", r.path, false));
    } else add(r.verb, r.path, opBase(r, r.verb, r.path, true));
  }
  for (const e of extras) {
    const [verb, path] = e.route.split(" ");
    const pathParams = path.match(/\{(\w+)\}/g)?.map((m) => ({ name: m.replace(/[{}]/g, ""), in: "path", required: true, schema: { type: "string" } }));
    add(verb, path, {
      operationId: `extra_${verb}_${path.replace(/\W+/g, "_")}`, tags: ["Sign-in, sessions, documents and exports"], description: `Permission: ${e.perm}. ${e.note ?? ""}`.trim(),
      ...(pathParams ? { parameters: pathParams } : {}),
      ...(e.body ? { requestBody: { required: true, content: { "application/json": { schema: { type: "object" }, example: e.body } } } } : {}),
      responses: { [String(e.status ?? 200)]: { description: "OK", ...(e.response ? { content: { "application/json": { example: e.response } } } : {}) }, "401": errorRef("Not signed in"), "422": errorRef("Validation failed") },
    });
  }
  const doc = {
    openapi: "3.0.3",
    info: { title: "B2B commerce API", version: "1.0.0-draft", description: "The contract the frontend expects. Generated by npm run docs:api. No backend implements it yet." },
    servers: [{ url: "/api/v1" }],
    paths,
    components: {
      securitySchemes: { session: { type: "apiKey", in: "cookie", name: "session" } },
      schemas: {
        ApiError: {
          type: "object", required: ["error"],
          properties: { error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" }, fields: { type: "object", additionalProperties: { type: "array", items: { type: "string" } } } } } },
        },
        ...Object.fromEntries([...components].sort(([a], [b]) => a.localeCompare(b))),
      },
    },
    security: [{ session: [] }],
  };
  return `# Generated by npm run docs:api. Do not edit by hand.${yaml(doc)}\n`;
}

const dir = join(ROOT, "scripts/api-docs");
const extras = JSON.parse(readFileSync(join(dir, "extra-endpoints.json"), "utf8")) as Extra[];
const preamble = readFileSync(join(dir, "preamble.md"), "utf8");
writeFileSync(join(ROOT, "docs/API-CONTRACTS.md"), contractMarkdown(preamble, extras));
writeFileSync(join(ROOT, "docs/openapi.yaml"), openapi(extras));

console.log(`${rows.length} repository endpoints, ${extras.length} others, ${components.size} types.`);
if (warnings.length) console.log(`Warnings:\n${warnings.map((w) => `  ${w}`).join("\n")}`);
