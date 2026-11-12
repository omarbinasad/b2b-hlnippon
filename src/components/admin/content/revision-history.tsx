import type { Route } from "next";
import Link from "next/link";
import { Can } from "@/components/admin/capabilities-context";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/feedback";
import { isLive } from "@/lib/content/rules";
import { compareSnapshots, snapshotOf, type DiffPart } from "@/lib/content/revisions";
import { repositories } from "@/lib/data";
import { formatDateTime, humanize } from "@/lib/format";
import { cx } from "@/lib/cx";
import type { BlogPost, ContentKind, ContentPage, ContentSnapshot } from "@/lib/types";
import { RestoreRevisionButton } from "./restore-revision";

function Diff({ parts }: { parts: DiffPart[] }) {
  return (
    <p className="text-sm leading-6 break-words whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.type === "same" ? <span key={i}>{p.text}</span>
        : p.type === "added" ? <ins key={i} className="rounded-sm bg-success-soft text-success no-underline">{p.text}</ins>
        : <del key={i} className="rounded-sm bg-danger-soft text-danger">{p.text}</del>,
      )}
    </p>
  );
}

/**
 * Revision list and compare view for a page or post. `compare` and `against` are revision ids from the URL; `against`
 * defaults to the current content. All comparing happens on the server.
 */
export async function RevisionHistory({ kind, item, compare, against }: { kind: ContentKind; item: ContentPage | BlogPost; compare?: string; against?: string }) {
  const base = `/admin/${kind}s/${item.id}`;
  const revisions = await repositories.contentHistory.revisions(kind, item.id);
  const noun = kind === "page" ? "page" : "post";
  if (!revisions.length) {
    return <EmptyState title="No earlier versions yet" description={`A version is kept each time this ${noun} is saved with changed content. Save it once and its history starts here.`} />;
  }

  const fromId = revisions.some((r) => r.id === compare) ? compare! : (revisions[1] ?? revisions[0]).id;
  const toId = against && revisions.some((r) => r.id === against) ? against : "current";
  const [from, to] = await Promise.all([
    repositories.contentHistory.revision(kind, item.id, fromId),
    toId === "current" ? null : repositories.contentHistory.revision(kind, item.id, toId),
  ]);
  const current: ContentSnapshot = snapshotOf(kind, item);
  const after = to?.snapshot ?? current;
  const diff = from ? compareSnapshots(from.snapshot, after) : { changes: [], unchanged: [] };
  const label = (id: string) => {
    const r = revisions.find((x) => x.id === id);
    return r ? `${formatDateTime(r.createdAt)} (${r.authorName})` : "Current content";
  };
  const trashed = item.status === "trash";

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card title="History" description={`Newest first. The newest ${25} versions are kept.`}>
        <ol className="-mx-2 space-y-1">
          {revisions.map((r, i) => {
            const older = revisions[i + 1];
            const selected = r.id === fromId || r.id === toId;
            return (
              <li key={r.id} className={cx("rounded-ui p-2", selected && "bg-brand-soft")}>
                <p className="text-sm font-medium">{formatDateTime(r.createdAt)}</p>
                <p className="text-xs text-muted">
                  {r.authorName} · {r.note} · {r.words} words
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <Badge tone={r.status === "published" ? "success" : r.status === "scheduled" ? "info" : "neutral"}>{humanize(r.status)}</Badge>
                  {i === 0 && <span className="text-muted">Latest save</span>}
                  <Link href={`${base}/revisions?compare=${r.id}` as Route} className="font-medium text-brand hover:underline">Compare with current</Link>
                  {older && <Link href={`${base}/revisions?compare=${older.id}&against=${r.id}` as Route} className="font-medium text-brand hover:underline">What changed</Link>}
                </div>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="min-w-0 space-y-4">
        <Card title="Compare versions">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-ui border border-line p-3">
              <dt className="text-xs font-medium text-danger">Older (removed text)</dt>
              <dd className="mt-1">{label(fromId)}</dd>
            </div>
            <div className="rounded-ui border border-line p-3">
              <dt className="text-xs font-medium text-success">Newer (added text)</dt>
              <dd className="mt-1">{toId === "current" ? `Current content${isLive(item) ? " (live)" : ""}` : label(toId)}</dd>
            </div>
          </dl>
          {!trashed && from && diff.changes.length > 0 && (
            <Can cap={kind === "page" ? "pages.edit" : "posts.edit"}>
              <div className="mt-4">
                <RestoreRevisionButton kind={kind} id={item.id} revisionId={from.id} when={formatDateTime(from.createdAt)} live={isLive(item)} />
              </div>
            </Can>
          )}
          {trashed && <div className="mt-4"><Notice tone="warning">Restore the {noun} from the trash before restoring a version.</Notice></div>}
        </Card>

        {diff.changes.length ? (
          diff.changes.map((c) => (
            <Card key={c.label} title={c.label}>
              <Diff parts={c.parts} />
            </Card>
          ))
        ) : (
          <Notice tone="info" title="No differences">These two versions have the same content.</Notice>
        )}
        {diff.changes.length > 0 && diff.unchanged.length > 0 && <p className="text-xs text-muted">Unchanged: {diff.unchanged.join(", ")}.</p>}
      </div>
    </div>
  );
}
